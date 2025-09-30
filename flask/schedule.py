from flask import Blueprint, request, jsonify
from utils import get_db
from schemas import ShiftSchema, AssignmentSchema
from marshmallow import ValidationError
from typing import Any, Dict
try:
    from .permissions import require_roles
except Exception:
    from permissions import require_roles

bp = Blueprint('schedule', __name__)


@bp.route('/shifts', methods=['POST'])
def create_shift():
    # manager-only
    try:
        from flask_jwt_extended import jwt_required, get_jwt_identity
    except Exception:
        return jsonify({'msg': 'JWT not available'}), 501

    @require_roles('Manager')
    def inner():
        from flask_jwt_extended import get_jwt_identity
        uid = get_jwt_identity()
        data = request.get_json() or {}
        try:
            # Marshmallow may return dict or other mapping-like types; cast to a plain dict for type checker
            from typing import cast
            payload = cast(Dict[str, Any], ShiftSchema().load(data))
        except ValidationError as e:
            return jsonify({'errors': e.messages}), 400
        conn = get_db()
        cur = conn.cursor()
        cur.execute('INSERT INTO shifts (name,role_required,start_time,end_time,created_by) VALUES (?,?,?,?,?)', (
            payload.get('name'), payload.get('role_required'), payload.get('start_time'), payload.get('end_time'), int(uid)
        ))
        conn.commit()
        return jsonify({'id': cur.lastrowid}), 201

    return inner()


@bp.route('/shifts', methods=['GET'])
def list_shifts():
    conn = get_db()
    cur = conn.cursor()
    cur.execute('SELECT id, name, role_required, start_time, end_time, created_by FROM shifts')
    rows = cur.fetchall()
    return jsonify({'shifts': [dict(r) for r in rows]})


@bp.route('/assign', methods=['POST'])
def assign_shift():
    try:
        from flask_jwt_extended import jwt_required, get_jwt_identity
    except Exception:
        return jsonify({'msg': 'JWT not available'}), 501

    @require_roles('Manager')
    def inner():
        from flask_jwt_extended import get_jwt_identity
        uid = get_jwt_identity()
        data = request.get_json() or {}
        try:
            from typing import cast
            payload = cast(Dict[str, Any], AssignmentSchema().load(data))
        except ValidationError as e:
            return jsonify({'errors': e.messages}), 400
        conn = get_db()
        cur = conn.cursor()
        sd = payload.get('shift_date')
        if sd is None:
            return jsonify({'msg': 'shift_date is required'}), 400
        shift_date_str = sd.isoformat() if hasattr(sd, 'isoformat') else str(sd)
        shift_id = payload.get('shift_id')
        assigned_user = payload.get('assigned_user')
        if shift_id is None or assigned_user is None:
            return jsonify({'msg': 'shift_id and assigned_user are required'}), 400
        cur.execute('INSERT INTO shift_assignments (shift_id,assigned_user,shift_date,role) VALUES (?,?,?,?)', (
            shift_id, assigned_user, shift_date_str, payload.get('role')
        ))
        conn.commit()
        return jsonify({'id': cur.lastrowid}), 201

    return inner()


@bp.route('/my', methods=['GET'])
def my_assignments():
    try:
        from flask_jwt_extended import jwt_required, get_jwt_identity
    except Exception:
        return jsonify({'msg': 'JWT not available'}), 501

    @jwt_required()
    def inner():
        uid = get_jwt_identity()
        try:
            uid = int(uid)
        except Exception:
            pass
        conn = get_db()
        cur = conn.cursor()
        cur.execute('SELECT sa.id, sa.shift_id, sa.shift_date, sa.role, s.name AS shift_name FROM shift_assignments sa JOIN shifts s ON sa.shift_id=s.id WHERE sa.assigned_user=?', (uid,))
        rows = cur.fetchall()
        return jsonify({'assignments': [dict(r) for r in rows]})

    return inner()
