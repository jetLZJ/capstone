import importlib
import sqlite3
from datetime import date, datetime, timedelta
from typing import Any, Dict, Iterable, List, Mapping, Optional, Tuple, cast

from flask import Blueprint, jsonify, request
from marshmallow import ValidationError

jwt_module = None
jwt_required = None
get_jwt_identity = None

try:  # pragma: no cover - optional dependency during tooling
    jwt_module = importlib.import_module('flask_jwt_extended')
    jwt_required = getattr(jwt_module, 'jwt_required', None)
    get_jwt_identity = getattr(jwt_module, 'get_jwt_identity', None)
except Exception:
    jwt_module = None

from utils import RqliteError, get_db
from schemas import ShiftSchema

try:
    from .permissions import require_roles
except Exception:  # pragma: no cover - fallback for local execution
    from permissions import require_roles

bp = Blueprint('schedule', __name__)

STATUS_VALUES = {'scheduled', 'confirmed', 'pending', 'open'}
WORKING_DAY_START_HOUR = 9
WORKING_DAY_END_HOUR = 22
MIN_SHIFT_DURATION_MINUTES = 6 * 60


def _normalize_date_token(value: Any) -> str:
    if value is None:
        return ''
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()

    try:
        token = str(value).strip()
    except Exception:
        return ''

    if not token:
        return ''

    candidate = token
    if candidate.endswith('Z'):
        candidate = candidate[:-1] + '+00:00'

    for fmt in (None, '%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M:%S'):
        try:
            if fmt:
                parsed = datetime.strptime(candidate[:19], fmt)
            else:
                parsed = datetime.fromisoformat(candidate)
            return parsed.date().isoformat()
        except ValueError:
            continue

    if len(token) >= 10 and token[4] == '-' and token[7] == '-':
        return token[:10]

    return token


def ensure_schedule_schema() -> None:
    """Ensure the database has the latest scheduling columns/indexes."""
    conn = get_db()
    cur = conn.cursor()

    def _safe_add_column(table: str, column_def: str) -> bool:
        try:
            cur.execute(f'ALTER TABLE {table} ADD COLUMN {column_def}')
            return True
        except Exception as exc:
            message = str(exc).lower()
            duplicate_tokens = (
                'duplicate column name',
                'duplicate column',
                'already exists',
            )
            if any(token in message for token in duplicate_tokens):
                return False
            if isinstance(exc, RqliteError) and any(token in message for token in duplicate_tokens):
                return False
            if isinstance(exc, sqlite3.OperationalError) and any(token in message for token in duplicate_tokens):
                return False
            raise

    _safe_add_column('shifts', 'recurrence_rule TEXT')
    _safe_add_column('shifts', "default_status TEXT DEFAULT 'scheduled'")
    _safe_add_column('shifts', 'default_duration INTEGER')

    shift_columns = {
        'start_time': 'start_time TEXT',
        'end_time': 'end_time TEXT',
        'status': "status TEXT DEFAULT 'scheduled'",
        'notes': 'notes TEXT',
        'recurrence_parent_id': 'recurrence_parent_id INTEGER',
        'schedule_week_start': 'schedule_week_start DATE',
        'created_at': 'created_at DATETIME',
        'updated_at': 'updated_at DATETIME'
    }
    added_columns: Dict[str, bool] = {}
    for column, definition in shift_columns.items():
        if _safe_add_column('shift_assignments', definition):
            added_columns[column] = True

    if added_columns.get('created_at'):
        cur.execute("UPDATE shift_assignments SET created_at = datetime('now') WHERE created_at IS NULL")
    if added_columns.get('status'):
        cur.execute("UPDATE shift_assignments SET status = 'scheduled' WHERE status IS NULL OR status = ''")

    cur.execute('CREATE INDEX IF NOT EXISTS idx_shift_assignments_user_date ON shift_assignments (assigned_user, shift_date)')
    cur.execute('CREATE INDEX IF NOT EXISTS idx_shift_assignments_week ON shift_assignments (schedule_week_start)')

    cur.execute(
        'CREATE TABLE IF NOT EXISTS staff_availability ('
        'id INTEGER PRIMARY KEY,'
        'user_id INTEGER NOT NULL,'
        'availability_date DATE NOT NULL,'
        'is_available INTEGER NOT NULL DEFAULT 1,'
        'notes TEXT,'
        'updated_by INTEGER,'
    'created_at DATETIME DEFAULT CURRENT_TIMESTAMP,'
        'updated_at DATETIME,'
        'FOREIGN KEY (user_id) REFERENCES users(id),'
        'FOREIGN KEY (updated_by) REFERENCES users(id),'
        'UNIQUE(user_id, availability_date)'
        ')'
    )
    cur.execute('CREATE INDEX IF NOT EXISTS idx_staff_availability_week ON staff_availability (availability_date)')

    conn.commit()

def _parse_date(value: Optional[str]) -> Optional[date]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value).date()
    except ValueError:
        try:
            return datetime.strptime(value, '%Y-%m-%d').date()
        except Exception:
            return None


def _parse_time(value: Optional[str]) -> Optional[Tuple[int, int]]:
    if not value:
        return None
    try:
        parts = value.split(':')
        hour = int(parts[0])
        minute = int(parts[1]) if len(parts) > 1 else 0
        if not (0 <= hour < 24 and 0 <= minute < 60):
            return None
        return hour, minute
    except Exception:
        return None


def _start_of_week(target: Optional[date] = None) -> date:
    ref = target or date.today()
    offset = ref.weekday()
    return ref - timedelta(days=offset)


def _combine_datetime(day: date, hm: Tuple[int, int]) -> str:
    dt = datetime.combine(day, datetime.min.time()) + timedelta(hours=hm[0], minutes=hm[1])
    return dt.isoformat()


def _minutes_since_midnight(hm: Tuple[int, int]) -> int:
    return hm[0] * 60 + hm[1]


def _coerce_int(value: Any) -> Optional[int]:
    try:
        if value is None:
            return None
        return int(value)
    except (TypeError, ValueError):
        return None


def _fetch_role(user_id: Any) -> Optional[str]:
    conn = get_db()
    cur = conn.cursor()
    cur.execute('SELECT r.name FROM users u JOIN roles r ON u.role_id=r.id WHERE u.id=?', (user_id,))
    row = cur.fetchone()
    return row[0] if row else None


def _serialize_assignment(row: Dict[str, Any]) -> Dict[str, Any]:
    staff_first = row.get('first_name') or ''
    staff_last = row.get('last_name') or ''
    staff_name = (staff_first + ' ' + staff_last).strip() or row.get('staff_email') or 'Unassigned'
    shift_date = _normalize_date_token(row.get('shift_date'))
    schedule_week_start = _normalize_date_token(row.get('schedule_week_start'))
    return {
        'id': row.get('id'),
        'shift_id': row.get('shift_id'),
        'staff_id': row.get('assigned_user'),
        'staff_name': staff_name,
        'role': row.get('role') or row.get('role_required') or 'Unassigned',
        'shift_date': shift_date,
        'start': row.get('start_time'),
        'end': row.get('end_time'),
        'status': row.get('status') or 'scheduled',
        'notes': row.get('notes') or '',
        'recurrence_parent_id': row.get('recurrence_parent_id'),
        'schedule_week_start': schedule_week_start,
    }


def _load_week_assignments(week_start: date, include_all: bool, user_id: Any) -> List[Dict[str, Any]]:
    week_end = week_start + timedelta(days=6)
    conn = get_db()
    conn.row_factory = sqlite3.Row  # type: ignore[attr-defined]
    cur = conn.cursor()
    params: List[Any] = [week_start.isoformat(), week_end.isoformat()]
    query = (
        'SELECT sa.*, u.first_name, u.last_name, u.email as staff_email, s.name as shift_name, s.role_required '
        'FROM shift_assignments sa '
        'LEFT JOIN users u ON sa.assigned_user = u.id '
        'LEFT JOIN shifts s ON sa.shift_id = s.id '
        'WHERE sa.shift_date BETWEEN ? AND ?'
    )
    if not include_all:
        query += ' AND sa.assigned_user = ?'
        params.append(user_id)
    query += ' ORDER BY sa.shift_date, sa.start_time, sa.end_time'
    cur.execute(query, params)
    rows = cur.fetchall()
    return [_serialize_assignment(dict(row)) for row in rows]


def _compute_coverage(assignments: Iterable[Dict[str, Any]]) -> Dict[str, Any]:
    counts = {'confirmed': 0, 'scheduled': 0, 'pending': 0, 'open': 0}
    staff_ids = set()
    for entry in assignments:
        status = (entry.get('status') or 'scheduled').lower()
        if status not in counts:
            status = 'pending'
        counts[status] += 1
        if entry.get('staff_id'):
            staff_ids.add(entry['staff_id'])
    return {
        'confirmed': counts['confirmed'],
        'pending': counts['pending'],
        'scheduled': counts['scheduled'],
        'open': counts['open'],
        'active_staff': len(staff_ids),
    }


def _find_conflicts(assignment: Dict[str, Any], ignore_id: Optional[int] = None) -> List[Dict[str, Any]]:
    staff_id = assignment.get('staff_id')
    if not staff_id:
        return []

    shift_date = assignment['shift_date']
    start = assignment['start']
    end = assignment['end']

    conn = get_db()
    conn.row_factory = sqlite3.Row  # type: ignore[attr-defined]
    cur = conn.cursor()
    params: List[Any] = [staff_id, shift_date, start, end]
    query = (
        'SELECT sa.id, sa.start_time, sa.end_time, s.name as shift_name '
        'FROM shift_assignments sa '
        'LEFT JOIN shifts s ON sa.shift_id = s.id '
        'WHERE sa.assigned_user=? AND sa.shift_date=? '
        'AND NOT (sa.end_time <= ? OR sa.start_time >= ?)' 
    )
    if ignore_id is not None:
        query += ' AND sa.id <> ?'
        params.append(ignore_id)
    cur.execute(query, params)
    rows = cur.fetchall()
    conflicts = []
    for row in rows:
        conflicts.append({
            'id': row['id'],
            'shift_name': row['shift_name'],
            'start': row['start_time'],
            'end': row['end_time'],
        })
    return conflicts


def _parse_assignment_payload(data: Dict[str, Any], week_start: date) -> Tuple[List[Dict[str, Any]], Optional[str]]:
    staff_id = data.get('staff_id') or data.get('assigned_user')
    role = data.get('role') or data.get('role_required')
    day_index = data.get('day_of_week')
    shift_date_value = data.get('shift_date')
    start_time_value = data.get('start_time')
    end_time_value = data.get('end_time')
    status = (data.get('status') or ('open' if not staff_id else 'scheduled')).lower()
    notes = data.get('notes') or ''
    repeat_weeks = int(data.get('repeat_weeks') or 0)
    template_id = data.get('shift_template_id')

    if shift_date_value:
        shift_date = _parse_date(shift_date_value)
    elif day_index is not None:
        try:
            offset = int(day_index)
        except Exception:
            return [], 'day_of_week must be an integer between 0(Monday) and 6(Sunday)'
        if not (0 <= offset <= 6):
            return [], 'day_of_week must be within 0-6'
        shift_date = week_start + timedelta(days=offset)
    else:
        return [], 'Either shift_date or day_of_week is required'

    if not shift_date:
        return [], 'Invalid shift date provided'

    start_tuple = _parse_time(start_time_value)
    end_tuple = _parse_time(end_time_value)
    if not start_tuple or not end_tuple:
        return [], 'start_time and end_time must be in HH:MM format'

    if start_tuple >= end_tuple:
        return [], 'end_time must be after start_time'

    start_minutes = _minutes_since_midnight(start_tuple)
    end_minutes = _minutes_since_midnight(end_tuple)

    if start_minutes < WORKING_DAY_START_HOUR * 60 or start_minutes >= WORKING_DAY_END_HOUR * 60:
        return [], 'Shifts must start between 9:00 AM and 10:00 PM'

    if end_minutes <= WORKING_DAY_START_HOUR * 60 or end_minutes > WORKING_DAY_END_HOUR * 60:
        return [], 'Shifts must end between 9:00 AM and 10:00 PM'

    if end_minutes - start_minutes < MIN_SHIFT_DURATION_MINUTES:
        return [], 'Shifts must be at least 6 hours long'

    if status not in STATUS_VALUES:
        status = 'scheduled'

    repeat_weeks = max(0, min(repeat_weeks, 26))

    assignments: List[Dict[str, Any]] = []
    for week_offset in range(repeat_weeks + 1):
        current_date = shift_date + timedelta(weeks=week_offset)
        assignments.append({
            'shift_id': template_id,
            'staff_id': staff_id,
            'role': role,
            'shift_date': current_date.isoformat(),
            'start': _combine_datetime(current_date, start_tuple),
            'end': _combine_datetime(current_date, end_tuple),
            'status': status,
            'notes': notes,
            'schedule_week_start': _start_of_week(current_date).isoformat(),
        })

    return assignments, None


def _simulate_notification(action: str, assignment: Dict[str, Any], staff_name: str) -> str:
    shift_date = assignment.get('shift_date')
    start = assignment.get('start')
    readable = datetime.fromisoformat(start).strftime('%b %d, %Y %I:%M %p') if start else shift_date
    return f"[Simulated notification] {staff_name or 'Team'} {action} shift on {readable}."


@bp.route('/week', methods=['GET'])
def weekly_schedule():
    if jwt_required is None or get_jwt_identity is None:
        return jsonify({'msg': 'JWT not available'}), 501

    jwt_req = cast(Any, jwt_required)
    get_identity = cast(Any, get_jwt_identity)

    @jwt_req()
    def inner():
        uid = get_identity()
        role = _fetch_role(uid)
        requested_week = _parse_date(request.args.get('week_start'))
        week_start = requested_week or _start_of_week()
        include_all = role in {'Manager', 'Admin'}
        assignments = _load_week_assignments(week_start, include_all, uid)

        days_map: Dict[str, Dict[str, Any]] = {}
        for i in range(7):
            day_date = week_start + timedelta(days=i)
            iso = day_date.isoformat()
            days_map[iso] = {
                'date': iso,
                'label': day_date.strftime('%A'),
                'assignments': [],
            }

        for entry in assignments:
            key = _normalize_date_token(entry.get('shift_date'))

            if key not in days_map:
                label = 'Unknown'
                if key:
                    try:
                        label = datetime.fromisoformat(key).strftime('%A')
                    except ValueError:
                        label = key
                days_map[key] = {
                    'date': key,
                    'label': label,
                    'assignments': [],
                }
            days_map[key]['assignments'].append(entry)

        for value in days_map.values():
            value['assignments'].sort(key=lambda x: (x.get('start') or '', x.get('staff_name') or ''))

        coverage = _compute_coverage(assignments)

        return jsonify({
            'week_start': week_start.isoformat(),
            'week_end': (week_start + timedelta(days=6)).isoformat(),
            'role': role,
            'days': [days_map[day] for day in sorted(days_map.keys())],
            'coverage': coverage,
        })

    return inner()


@bp.route('/staff', methods=['GET'])
@require_roles('Manager')
def list_staff():
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        'SELECT u.id, u.first_name, u.last_name, r.name as role, u.email '
        'FROM users u JOIN roles r ON u.role_id=r.id '
        'WHERE r.name IN ("Admin", "Manager", "Staff") '
        'ORDER BY r.name, u.first_name'
    )
    rows = cur.fetchall()
    result = []
    for row in rows:
        name = ((row[1] or '') + ' ' + (row[2] or '')).strip() or row[4]
        result.append({
            'id': row[0],
            'name': name,
            'role': row[3],
            'email': row[4],
        })
    return jsonify({'staff': result})


@bp.route('/assignments', methods=['POST'])
@require_roles('Manager')
def create_assignment():
    data = request.get_json() or {}
    requested_week = _parse_date(data.get('week_start')) or _start_of_week()
    assignments, error = _parse_assignment_payload(data, requested_week)
    if error:
        return jsonify({'msg': error}), 400

    conn = get_db()
    cur = conn.cursor()
    created_ids = []
    notification_messages: List[str] = []
    parent_id: Optional[int] = None

    for assignment in assignments:
        conflicts = _find_conflicts(assignment)
        if conflicts:
            return jsonify({'msg': 'Shift conflicts with an existing assignment', 'conflicts': conflicts}), 409

        now_iso = datetime.utcnow().isoformat()
        cur.execute(
            'INSERT INTO shift_assignments '
            '(shift_id, assigned_user, shift_date, start_time, end_time, role, status, notes, recurrence_parent_id, schedule_week_start, created_at, updated_at) '
            'VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
            (
                assignment.get('shift_id'),
                assignment.get('staff_id'),
                assignment.get('shift_date'),
                assignment.get('start'),
                assignment.get('end'),
                assignment.get('role'),
                assignment.get('status'),
                assignment.get('notes'),
                parent_id,
                assignment.get('schedule_week_start'),
                now_iso,
                now_iso,
            )
        )
        assignment_id = cur.lastrowid
        if parent_id is None:
            parent_id = assignment_id
            cur.execute('UPDATE shift_assignments SET recurrence_parent_id=? WHERE id=?', (parent_id, assignment_id))
        created_ids.append(assignment_id)

        staff_name = ''
        if assignment.get('staff_id'):
            cur.execute('SELECT first_name, last_name FROM users WHERE id=?', (assignment['staff_id'],))
            row = cur.fetchone()
            if row:
                staff_name = ((row[0] or '') + ' ' + (row[1] or '')).strip()

        notification_messages.append(_simulate_notification('assigned a new', assignment, staff_name))

    conn.commit()

    return jsonify({'created_ids': created_ids, 'notifications': notification_messages}), 201


@bp.route('/assignments/<int:assignment_id>', methods=['PATCH'])
@require_roles('Manager')
def update_assignment(assignment_id: int):
    data = request.get_json() or {}
    conn = get_db()
    cur = conn.cursor()
    cur.execute('SELECT shift_date, start_time, end_time, assigned_user FROM shift_assignments WHERE id=?', (assignment_id,))
    row = cur.fetchone()
    if not row:
        return jsonify({'msg': 'Shift assignment not found'}), 404

    current = {
        'shift_date': row[0],
        'start': row[1],
        'end': row[2],
        'staff_id': row[3],
    }

    def _coerce_time_value(value: Any) -> Optional[str]:
        if value is None:
            return None
        if isinstance(value, str):
            trimmed = value.strip()
            return trimmed or None
        return str(value)

    start_value = _coerce_time_value(data.get('start_time'))
    if start_value is None:
        start_value = _coerce_time_value(data.get('start'))
    if start_value is None:
        start_value = _coerce_time_value(current['start'])

    end_value = _coerce_time_value(data.get('end_time'))
    if end_value is None:
        end_value = _coerce_time_value(data.get('end'))
    if end_value is None:
        end_value = _coerce_time_value(current['end'])

    shift_date_value = data.get('shift_date') or current['shift_date']
    shift_date = _parse_date(shift_date_value)
    if not shift_date:
        return jsonify({'msg': 'Invalid shift_date'}), 400

    if start_value is None or end_value is None:
        return jsonify({'msg': 'Shift is missing start or end time; edit the shift to add timing details before moving it.'}), 400

    def _extract_tuple(value: str) -> Optional[Tuple[int, int]]:
        token = value
        if 'T' in token:
            token = token.split('T')[-1]
        return _parse_time(token)

    start_tuple = _extract_tuple(start_value)
    end_tuple = _extract_tuple(end_value)
    if not start_tuple or not end_tuple:
        return jsonify({'msg': 'start_time and end_time must be in HH:MM format'}), 400
    if start_tuple >= end_tuple:
        return jsonify({'msg': 'end_time must be after start_time'}), 400

    start_minutes = _minutes_since_midnight(start_tuple)
    end_minutes = _minutes_since_midnight(end_tuple)

    if start_minutes < WORKING_DAY_START_HOUR * 60 or start_minutes >= WORKING_DAY_END_HOUR * 60:
        return jsonify({'msg': 'Shifts must start between 9:00 AM and 10:00 PM'}), 400

    if end_minutes <= WORKING_DAY_START_HOUR * 60 or end_minutes > WORKING_DAY_END_HOUR * 60:
        return jsonify({'msg': 'Shifts must end between 9:00 AM and 10:00 PM'}), 400

    if end_minutes - start_minutes < MIN_SHIFT_DURATION_MINUTES:
        return jsonify({'msg': 'Shifts must be at least 6 hours long'}), 400

    start_iso = _combine_datetime(shift_date, start_tuple)
    end_iso = _combine_datetime(shift_date, end_tuple)

    staff_id = data.get('staff_id') if 'staff_id' in data else current['staff_id']

    assignment = {
        'shift_date': shift_date.isoformat(),
        'start': start_iso,
        'end': end_iso,
        'staff_id': staff_id,
    }

    conflicts = _find_conflicts(assignment, ignore_id=assignment_id)
    if conflicts:
        return jsonify({'msg': 'Shift conflicts with an existing assignment', 'conflicts': conflicts}), 409

    fields = {
        'assigned_user': staff_id,
        'role': data.get('role'),
        'status': data.get('status'),
        'notes': data.get('notes'),
        'shift_date': assignment['shift_date'],
        'start_time': start_iso,
        'end_time': end_iso,
        'schedule_week_start': _start_of_week(shift_date).isoformat(),
    }

    updates = []
    params: List[Any] = []
    for column, value in fields.items():
        if value is not None:
            updates.append(f'{column}=?')
            params.append(value)
    params.append(datetime.utcnow().isoformat())
    params.append(assignment_id)

    cur.execute(f"UPDATE shift_assignments SET {', '.join(updates)}, updated_at=? WHERE id=?", params)
    conn.commit()

    return jsonify({'msg': 'Shift updated'})


@bp.route('/assignments/<int:assignment_id>', methods=['DELETE'])
@require_roles('Manager')
def delete_assignment(assignment_id: int):
    conn = get_db()
    cur = conn.cursor()
    cur.execute('DELETE FROM shift_assignments WHERE id=?', (assignment_id,))
    conn.commit()
    return '', 204


@bp.route('/shifts', methods=['POST'])
@require_roles('Manager')
def create_shift_template():
    uid = get_jwt_identity() if get_jwt_identity else None
    data = request.get_json() or {}
    try:
        payload = ShiftSchema().load(data)
    except ValidationError as exc:
        return jsonify({'errors': exc.messages}), 400
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        'INSERT INTO shifts (name, role_required, start_time, end_time, created_by, recurrence_rule, default_status, default_duration) '
        'VALUES (?,?,?,?,?,?,?,?)',
        (
            payload.get('name'),
            payload.get('role_required'),
            payload.get('start_time'),
            payload.get('end_time'),
            uid,
            data.get('recurrence_rule'),
            data.get('default_status', 'scheduled'),
            data.get('default_duration'),
        )
    )
    conn.commit()
    return jsonify({'id': cur.lastrowid}), 201


@bp.route('/shifts', methods=['GET'])
def list_shift_templates():
    conn = get_db()
    cur = conn.cursor()
    cur.execute('SELECT id, name, role_required, start_time, end_time, created_by, recurrence_rule, default_status, default_duration FROM shifts')
    rows = cur.fetchall()
    result = []
    for row in rows:
        result.append({
            'id': row[0],
            'name': row[1],
            'role_required': row[2],
            'start_time': row[3],
            'end_time': row[4],
            'created_by': row[5],
            'recurrence_rule': row[6],
            'default_status': row[7],
            'default_duration': row[8],
        })
    return jsonify({'shifts': result})


@bp.route('/my', methods=['GET'])
def my_assignments():
    if jwt_required is None or get_jwt_identity is None:
        return jsonify({'msg': 'JWT not available'}), 501

    jwt_req = cast(Any, jwt_required)
    get_identity = cast(Any, get_jwt_identity)

    @jwt_req()
    def inner():
        uid = get_identity()
        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            'SELECT sa.id, sa.shift_date, sa.start_time, sa.end_time, sa.status, sa.role, s.name '
            'FROM shift_assignments sa LEFT JOIN shifts s ON sa.shift_id = s.id '
            'WHERE sa.assigned_user=? ORDER BY sa.shift_date, sa.start_time',
            (uid,)
        )
        rows = cur.fetchall()
        assignments = []
        for row in rows:
            assignments.append({
                'id': row[0],
                'shift_date': row[1],
                'start_time': row[2],
                'end_time': row[3],
                'status': row[4],
                'role': row[5],
                'shift_name': row[6],
            })
        return jsonify({'assignments': assignments})

    return inner()


def _serialize_availability_row(row: Mapping[str, Any]) -> Dict[str, Any]:
    full_name = ' '.join(filter(None, [(row['first_name'] or '').strip(), (row['last_name'] or '').strip()])).strip() or None
    flag = _normalize_availability_flag(row['is_available'])
    is_available: Optional[bool]
    if flag is None:
        is_available = None
    else:
        is_available = bool(flag)
    date_value = _normalize_date_token(row.get('availability_date'))
    return {
        'id': row['id'],
        'user_id': row['user_id'],
        'date': date_value,
        'is_available': is_available,
        'notes': row['notes'] or '',
        'staff_name': full_name,
        'updated_at': row['updated_at'],
    }


def _fill_missing_days(week_start: date, entries: List[Dict[str, Any]], user_id: int) -> List[Dict[str, Any]]:
    day_map = {entry['date']: entry for entry in entries}
    result: List[Dict[str, Any]] = []
    for offset in range(7):
        current = week_start + timedelta(days=offset)
        iso = current.isoformat()
        if iso in day_map:
            result.append(day_map[iso])
        else:
            result.append({'id': None, 'user_id': user_id, 'date': iso, 'is_available': True, 'notes': '', 'staff_name': None, 'updated_at': None})
    return result


@bp.route('/availability', methods=['GET'])
def availability_overview():
    if jwt_required is None or get_jwt_identity is None:
        return jsonify({'msg': 'JWT not available'}), 501

    jwt_req = cast(Any, jwt_required)
    get_identity = cast(Any, get_jwt_identity)

    @jwt_req()
    def inner():
        uid_raw = get_identity()
        uid = _coerce_int(uid_raw)
        if uid is None:
            return jsonify({'msg': 'Invalid user identity'}), 401

        role = _fetch_role(uid)
        requested_week = _parse_date(request.args.get('week_start')) or _start_of_week()
        week_end = requested_week + timedelta(days=6)
        target_user = _coerce_int(request.args.get('user_id'))

        if role not in {'Manager', 'Admin'}:
            target_user = uid

        conn = get_db()
        conn.row_factory = sqlite3.Row  # type: ignore[attr-defined]
        cur = conn.cursor()

        params: List[Any] = [requested_week.isoformat(), week_end.isoformat()]
        query = (
            'SELECT sa.id, sa.user_id, sa.availability_date, sa.is_available, sa.notes, sa.updated_at, '
            'u.first_name, u.last_name '
            'FROM staff_availability sa JOIN users u ON sa.user_id = u.id '
            'WHERE sa.availability_date BETWEEN ? AND ?'
        )
        if target_user is not None:
            query += ' AND sa.user_id=?'
            params.append(target_user)
        query += ' ORDER BY sa.availability_date, u.first_name, u.last_name'

        cur.execute(query, params)
        rows = cur.fetchall()
        entries = [_serialize_availability_row(row) for row in rows]

        if target_user is not None:
            entries = _fill_missing_days(requested_week, entries, target_user)

        return jsonify({
            'week_start': requested_week.isoformat(),
            'week_end': week_end.isoformat(),
            'role': role,
            'entries': entries,
        })

    return inner()


def _normalize_availability_flag(value: Any) -> Optional[int]:
    if value is None:
        return None
    if isinstance(value, bool):
        return 1 if value else 0
    if isinstance(value, (int, float)):
        return 1 if value else 0
    if isinstance(value, str):
        token = value.strip().lower()
        if token in {'', 'null'}:
            return None
        if token in {'1', 'true', 'yes', 'available', 'open'}:
            return 1
        if token in {'0', 'false', 'no', 'unavailable', 'closed', 'off'}:
            return 0
    return None


@bp.route('/availability', methods=['PUT'])
def update_availability():
    if jwt_required is None or get_jwt_identity is None:
        return jsonify({'msg': 'JWT not available'}), 501

    jwt_req = cast(Any, jwt_required)
    get_identity = cast(Any, get_jwt_identity)

    @jwt_req()
    def inner():
        uid_raw = get_identity()
        uid = _coerce_int(uid_raw)
        if uid is None:
            return jsonify({'msg': 'Invalid user identity'}), 401

        role = _fetch_role(uid)
        data = request.get_json() or {}
        entries_payload = data.get('entries')
        if not isinstance(entries_payload, list) or not entries_payload:
            return jsonify({'msg': 'entries must be a non-empty list'}), 400

        target_user = data.get('user_id')
        coerced_target = _coerce_int(target_user) if target_user is not None else uid
        if coerced_target is None:
            return jsonify({'msg': 'user_id must be an integer'}), 400

        if role not in {'Manager', 'Admin'} and coerced_target != uid:
            return jsonify({'msg': 'Insufficient permissions to update other users'}), 403

        conn = get_db()
        cur = conn.cursor()

        saved: List[Dict[str, Any]] = []
        now_iso = datetime.utcnow().isoformat()

        for entry in entries_payload:
            availability_date = _parse_date(entry.get('date'))
            if not availability_date:
                return jsonify({'msg': 'Each entry must include a valid date in YYYY-MM-DD format'}), 400

            flag = _normalize_availability_flag(entry.get('is_available'))
            if flag is None:
                return jsonify({'msg': 'Each entry must include is_available as true/false'}), 400

            notes = (entry.get('notes') or '').strip()

            cur.execute(
                'INSERT INTO staff_availability (user_id, availability_date, is_available, notes, updated_by, updated_at) '
                'VALUES (?,?,?,?,?,?) '
                'ON CONFLICT(user_id, availability_date) DO UPDATE SET '
                'is_available=excluded.is_available, notes=excluded.notes, updated_by=excluded.updated_by, updated_at=excluded.updated_at',
                (coerced_target, availability_date.isoformat(), flag, notes, uid, now_iso)
            )

            saved.append({
                'user_id': coerced_target,
                'date': availability_date.isoformat(),
                'is_available': bool(flag),
                'notes': notes,
            })

        conn.commit()

        return jsonify({'updated': len(saved), 'entries': saved})

    return inner()
