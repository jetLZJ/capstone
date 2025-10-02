"""
seed_data.py

Idempotent script to ensure roles include Admin/Manager/Staff/User and to create
dummy users and menu items requested by the user.

Run: python flask/seed_data.py
"""
import json
import os
import random
import sqlite3
from datetime import datetime, timedelta, date
from typing import Optional, List, Dict, Any

ROOT = os.path.dirname(__file__)
DB = os.environ.get('DB_PATH', os.path.join(ROOT, 'data', 'app.db'))

CAT_IMAGES = {
    'alice.admin@example.com': 'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?auto=format&fit=crop&w=400&q=80',
    'maya.manager@example.com': 'https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?auto=format&fit=crop&w=400&q=80',
    'sam.staff@example.com': 'https://images.unsplash.com/photo-1494256997604-768d1f608cac?auto=format&fit=crop&w=400&q=80',
    'tina.staff@example.com': 'https://images.unsplash.com/photo-1508672019048-805c876b67e2?auto=format&fit=crop&w=400&q=80',
    'raj.staff@example.com': 'https://images.unsplash.com/photo-1460904577954-8fadb262612c?auto=format&fit=crop&w=400&q=80',
    'user1@example.com': 'https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=400&q=80',
    'user2@example.com': 'https://images.unsplash.com/photo-1513360371669-4adf3dd7dff8?auto=format&fit=crop&w=400&q=80',
    'user3@example.com': 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=400&q=80',
    'user4@example.com': 'https://images.unsplash.com/photo-1472491235688-bdc81a63246e?auto=format&fit=crop&w=400&q=80',
    'user5@example.com': 'https://images.unsplash.com/photo-1543852786-1cf6624b9987?auto=format&fit=crop&w=400&q=80',
}


def _column_exists(cur: sqlite3.Cursor, table: str, column: str) -> bool:
    cur.execute(f"PRAGMA table_info({table})")
    return any(row[1] == column for row in cur.fetchall())


def _add_column(cur: sqlite3.Cursor, table: str, column_def: str) -> None:
    cur.execute(f'ALTER TABLE {table} ADD COLUMN {column_def}')

def ensure_title_column(conn):
    cur = conn.cursor()
    cur.execute("PRAGMA table_info(users)")
    cols = [r[1] for r in cur.fetchall()]
    if 'title' not in cols:
        print('Adding title column to users')
        cur.execute('ALTER TABLE users ADD COLUMN title TEXT')
        conn.commit()
    else:
        print('title column already present')


def ensure_password_hash_column(conn):
    cur = conn.cursor()
    cur.execute("PRAGMA table_info(users)")
    cols = [r[1] for r in cur.fetchall()]
    if 'password_hash' not in cols:
        print('Adding password_hash column to users')
        cur.execute('ALTER TABLE users ADD COLUMN password_hash TEXT')
        conn.commit()
    else:
        print('password_hash column already present')


def update_missing_passwords(conn, default_password='password'):
    # Set a default password hash for users missing password_hash (idempotent)
    from utils import hash_password
    cur = conn.cursor()
    cur.execute("SELECT id FROM users WHERE password_hash IS NULL OR password_hash = ''")
    rows = [r[0] for r in cur.fetchall()]
    if not rows:
        print('No users need password updates')
        return
    pw_hash = hash_password(default_password)
    for uid in rows:
        cur.execute('UPDATE users SET password_hash=? WHERE id=?', (pw_hash, uid))
        print('Updated password for user id', uid)
    conn.commit()

def ensure_roles(conn):
    cur = conn.cursor()
    roles = ['Admin','Manager','Staff','User']
    for r in roles:
        cur.execute('INSERT OR IGNORE INTO roles (name) VALUES (?)', (r,))
    conn.commit()


def ensure_shift_schema(conn: sqlite3.Connection) -> None:
    """Ensure the scheduling tables include the latest columns and indexes."""
    cur = conn.cursor()

    if not _column_exists(cur, 'shifts', 'recurrence_rule'):
        _add_column(cur, 'shifts', 'recurrence_rule TEXT')
    if not _column_exists(cur, 'shifts', 'default_status'):
        _add_column(cur, 'shifts', "default_status TEXT DEFAULT 'scheduled'")
    if not _column_exists(cur, 'shifts', 'default_duration'):
        _add_column(cur, 'shifts', 'default_duration INTEGER')

    assignment_columns = {
        'start_time': 'start_time TEXT',
        'end_time': 'end_time TEXT',
        'status': "status TEXT DEFAULT 'scheduled'",
        'notes': 'notes TEXT',
        'recurrence_parent_id': 'recurrence_parent_id INTEGER',
        'schedule_week_start': 'schedule_week_start DATE',
        'created_at': 'created_at DATETIME',
        'updated_at': 'updated_at DATETIME',
    }

    added_columns: Dict[str, bool] = {}
    for column, definition in assignment_columns.items():
        if not _column_exists(cur, 'shift_assignments', column):
            _add_column(cur, 'shift_assignments', definition)
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


def cleanup_legacy_schedule_data(conn: sqlite3.Connection) -> None:
    """Remove legacy schedule rows that are incompatible with the new schema."""
    cur = conn.cursor()
    cur.execute("DELETE FROM shift_assignments WHERE start_time IS NULL OR start_time = '' OR end_time IS NULL OR end_time = ''")
    conn.commit()


def reset_database(conn: sqlite3.Connection) -> None:
    """Clear dynamic tables so reseeding always starts from a clean slate."""
    cur = conn.cursor()
    print('Resetting tables: order_items, orders, staff_availability, shift_assignments, shifts, users')
    cur.execute('PRAGMA foreign_keys = OFF')
    tables = [
        'order_items',
        'orders',
        'staff_availability',
        'shift_assignments',
        'shifts',
        'users',
    ]
    for table in tables:
        cur.execute(f'DELETE FROM {table}')
    placeholders = ','.join('?' for _ in tables)
    cur.execute(f'DELETE FROM sqlite_sequence WHERE name IN ({placeholders})', tables)
    cur.execute('PRAGMA foreign_keys = ON')
    conn.commit()

def seed_users(conn):
    cur = conn.cursor()
    # Determine role ids
    cur.execute("SELECT id, name FROM roles")
    role_map = {name: id for id, name in cur.fetchall()}

    users: List[Dict[str, Optional[str]]] = []
    # 1 admin
    users.append({'first_name':'Alice','last_name':'Admin','email':'alice.admin@example.com','phone_number':'+10000000001','role':'Admin','title':'System Administrator'})
    # 1 manager
    users.append({'first_name':'Maya','last_name':'Manager','email':'maya.manager@example.com','phone_number':'+10000000002','role':'Manager','title':'Operations Manager'})
    # 3 staff
    users.append({'first_name':'Sam','last_name':'Staff','email':'sam.staff@example.com','phone_number':'+10000000003','role':'Staff','title':'Floor Staff'})
    users.append({'first_name':'Tina','last_name':'Staff','email':'tina.staff@example.com','phone_number':'+10000000004','role':'Staff','title':'Kitchen Staff'})
    users.append({'first_name':'Raj','last_name':'Staff','email':'raj.staff@example.com','phone_number':'+10000000005','role':'Staff','title':'Service Staff'})
    # 5 users
    for i in range(1,6):
        users.append({'first_name':f'User{i}','last_name':'Customer', 'email':f'user{i}@example.com','phone_number':f'+1000000001{i}','role':'User','title':None})

    # Insert users if email not present
    # Prefer secure password for seeded users (password: 'password')
    from utils import hash_password
    for u in users:
        email = u.get('email')
        u['profile_pic'] = CAT_IMAGES.get(email) if email else None
    for u in users:
        cur.execute('SELECT id, profile_pic, title FROM users WHERE email=?', (u['email'],))
        row = cur.fetchone()
        if row:
            updates = []
            params: List[Any] = []
            if u.get('profile_pic') and row[1] != u['profile_pic']:
                updates.append('profile_pic=?')
                params.append(u['profile_pic'])
            if u.get('title') and row[2] != u['title']:
                updates.append('title=?')
                params.append(u['title'])
            if updates:
                params.append(u['email'])
                cur.execute(f"UPDATE users SET {', '.join(updates)} WHERE email=?", params)
                print('User exists, updating profile:', u['email'])
            else:
                print('User exists, skipping:', u['email'])
            continue
        role_id = role_map.get(u['role'])
        pw_hash = hash_password('password')
        cur.execute('INSERT INTO users (first_name,last_name,email,phone_number,role_id,title,signup_date,password_hash,profile_pic) VALUES (?,?,?,?,?,?,?,?,?)', (
            u['first_name'], u['last_name'], u['email'], u['phone_number'], role_id, u['title'], datetime.utcnow(), pw_hash, u.get('profile_pic')
        ))
        print('Inserted user:', u['email'])
    conn.commit()


def _lookup_user_ids(conn: sqlite3.Connection, emails: List[str]) -> Dict[str, Optional[int]]:
    if not emails:
        return {}
    cur = conn.cursor()
    placeholders = ','.join('?' for _ in emails)
    cur.execute(f'SELECT email, id FROM users WHERE email IN ({placeholders})', tuple(emails))
    rows = cur.fetchall()
    mapping: Dict[str, Optional[int]] = {email: None for email in emails}
    for email, uid in rows:
        mapping[email] = uid
    return mapping


def seed_shift_templates(conn: sqlite3.Connection) -> Dict[str, int]:
    """Seed reusable shift templates and return a name-to-id mapping."""
    ensure_shift_schema(conn)
    cur = conn.cursor()

    admin_email = 'alice.admin@example.com'
    admin_id = _lookup_user_ids(conn, [admin_email]).get(admin_email)

    templates: List[Dict[str, Any]] = [
        {
            'name': 'Morning Prep',
            'role_required': 'Kitchen',
            'start_time': '09:00',
            'end_time': '15:00',
            'default_duration': 360,
            'recurrence_rule': 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
        },
        {
            'name': 'Lunch Service',
            'role_required': 'Server',
            'start_time': '12:00',
            'end_time': '18:00',
            'default_duration': 360,
            'recurrence_rule': 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
        },
        {
            'name': 'Dinner Service',
            'role_required': 'Server',
            'start_time': '16:00',
            'end_time': '22:00',
            'default_duration': 360,
            'recurrence_rule': 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR,SA',
        },
        {
            'name': 'Closing Shift',
            'role_required': 'Support',
            'start_time': '14:00',
            'end_time': '20:00',
            'default_duration': 360,
            'recurrence_rule': 'FREQ=WEEKLY;BYDAY=FR,SA',
        },
    ]

    name_to_id: Dict[str, int] = {}
    for template in templates:
        cur.execute('SELECT id FROM shifts WHERE name=?', (template['name'],))
        row = cur.fetchone()
        if row:
            cur.execute(
                'UPDATE shifts SET role_required=?, start_time=?, end_time=?, created_by=?, recurrence_rule=?, default_status=?, default_duration=? WHERE id=?',
                (
                    template['role_required'],
                    template['start_time'],
                    template['end_time'],
                    admin_id,
                    template['recurrence_rule'],
                    'scheduled',
                    template['default_duration'],
                    row[0],
                ),
            )
            name_to_id[template['name']] = row[0]
            print('Updated shift template:', template['name'])
            continue
        cur.execute(
            'INSERT INTO shifts (name, role_required, start_time, end_time, created_by, recurrence_rule, default_status, default_duration)\n'
            'VALUES (?,?,?,?,?,?,?,?)',
            (
                template['name'],
                template['role_required'],
                template['start_time'],
                template['end_time'],
                admin_id,
                template['recurrence_rule'],
                'scheduled',
                template['default_duration'],
            ),
        )
        last_id = cur.lastrowid
        if last_id is None:
            raise RuntimeError('Failed to insert shift template')
        name_to_id[template['name']] = int(last_id)
        print('Inserted shift template:', template['name'])

    conn.commit()
    return name_to_id


def _start_of_week(target: Optional[date] = None) -> date:
    ref = target or datetime.utcnow().date()
    return ref - timedelta(days=ref.weekday())


def _combine_iso(day: date, time_str: str) -> str:
    return f"{day.isoformat()}T{time_str}:00"


def seed_shift_assignments(conn: sqlite3.Connection, shift_ids: Dict[str, int]) -> None:
    ensure_shift_schema(conn)
    cur = conn.cursor()

    cur.execute('DELETE FROM shift_assignments')

    staff_emails = [
        'maya.manager@example.com',
        'sam.staff@example.com',
        'tina.staff@example.com',
        'raj.staff@example.com',
    ]
    user_map = _lookup_user_ids(conn, staff_emails)

    current_week_start = _start_of_week()
    week_offsets = [-2, -1, 0, 1]
    window_start = current_week_start + timedelta(weeks=min(week_offsets))
    window_end = current_week_start + timedelta(weeks=max(week_offsets), days=6)
    print('Regenerating shift assignments from', window_start, 'through', window_end)

    base_items: List[Dict[str, Any]] = [
        {
            'shift': 'Morning Prep',
            'staff_email': 'tina.staff@example.com',
            'day_offset': 0,
            'start_time': '09:00',
            'end_time': '15:00',
            'role': 'Kitchen',
            'note_variants': [
                'Seasonal soup and pastry prep',
                'Supplier tasting mise en place',
                'Brunch buffet mise en place',
                'Chef tasting menu prep',
            ],
        },
        {
            'shift': 'Lunch Service',
            'staff_email': 'sam.staff@example.com',
            'day_offset': 0,
            'start_time': '12:00',
            'end_time': '18:00',
            'role': 'Server',
            'note_variants': [
                'Corporate group reservations',
                'Tour bus drop-in block',
                'Local office luncheon',
                'Convention mid-day crowd',
            ],
        },
        {
            'shift': 'Dinner Service',
            'staff_email': 'raj.staff@example.com',
            'day_offset': 2,
            'start_time': '16:00',
            'end_time': '22:00',
            'role': 'Server',
            'note_variants': [
                'Wine pairing dinner service',
                'Family reunion seating',
                'Neighborhood loyalty night',
                'Date-night prix fixe',
            ],
        },
        {
            'shift': 'Lunch Service',
            'staff_email': 'sam.staff@example.com',
            'day_offset': 3,
            'start_time': '11:00',
            'end_time': '17:00',
            'role': 'Server',
            'note_variants': [
                'Extra coverage for tasting event',
                'Back patio private party',
                'Catering pickup staging',
                'Team training overlap',
            ],
        },
        {
            'shift': 'Closing Shift',
            'staff_email': 'maya.manager@example.com',
            'day_offset': 4,
            'start_time': '14:00',
            'end_time': '20:00',
            'role': 'Support',
            'note_variants': [
                'Front-of-house inventory sync',
                'Weekly vendor coordination window',
                'Service standards refresher',
                'Guest feedback follow-up calls',
            ],
        },
        {
            'shift': 'Morning Prep',
            'staff_email': 'tina.staff@example.com',
            'day_offset': 5,
            'start_time': '09:00',
            'end_time': '15:00',
            'role': 'Kitchen',
            'note_variants': [
                'Weekend brunch mise en place',
                'Farmer market produce prep',
                'Holiday brunch prep list',
                'Seafood delivery breakdown',
            ],
        },
        {
            'shift': 'Dinner Service',
            'staff_email': 'raj.staff@example.com',
            'day_offset': 5,
            'start_time': '16:00',
            'end_time': '22:00',
            'role': 'Server',
            'note_variants': [
                'Saturday night double seating',
                'Sommelier pairing support',
                'VIP lounge rotation',
                'Tasting menu support',
            ],
        },
        {
            'shift': 'Closing Shift',
            'staff_email': 'maya.manager@example.com',
            'day_offset': 6,
            'start_time': '14:00',
            'end_time': '20:00',
            'role': 'Support',
            'note_variants': [
                'Inventory audit and vendor notes',
                'Weekly maintenance checklist',
                'Month-end cash audit',
                'Policy review with closers',
            ],
        },
    ]

    status_patterns = [
        ['confirmed', 'scheduled', 'pending', 'open', 'scheduled', 'confirmed', 'scheduled', 'confirmed'],
        ['confirmed', 'confirmed', 'scheduled', 'open', 'pending', 'confirmed', 'pending', 'confirmed'],
        ['scheduled', 'scheduled', 'pending', 'open', 'confirmed', 'confirmed', 'scheduled', 'confirmed'],
        ['confirmed', 'scheduled', 'open', 'open', 'scheduled', 'confirmed', 'scheduled', 'confirmed'],
    ]

    now_iso = datetime.utcnow().isoformat()
    for week_index, offset in enumerate(week_offsets):
        week_start = current_week_start + timedelta(weeks=offset)
        week_label = f"Week of {week_start.strftime('%b %d')}"
        statuses = status_patterns[week_index % len(status_patterns)]

        for item_index, base in enumerate(base_items):
            status = statuses[item_index % len(statuses)]
            shift_id = shift_ids.get(base['shift'])
            if not shift_id:
                continue

            shift_date = week_start + timedelta(days=base['day_offset'])
            start_iso = _combine_iso(shift_date, base['start_time'])
            end_iso = _combine_iso(shift_date, base['end_time'])
            assigned_email = base['staff_email'] if status != 'open' else None
            assigned_user = user_map.get(assigned_email) if assigned_email else None

            note_variants = base['note_variants']
            note_text = note_variants[(week_index + item_index) % len(note_variants)]
            note = f"{week_label} • {note_text}"

            cur.execute(
                'INSERT INTO shift_assignments (shift_id, assigned_user, shift_date, start_time, end_time, role, status, notes, schedule_week_start, created_at, updated_at) '
                'VALUES (?,?,?,?,?,?,?,?,?,?,?)',
                (
                    shift_id,
                    assigned_user,
                    shift_date.isoformat(),
                    start_iso,
                    end_iso,
                    base['role'],
                    status,
                    note,
                    week_start.isoformat(),
                    now_iso,
                    now_iso,
                ),
            )
            print('Inserted shift assignment:', week_label, shift_date, '->', status)

    conn.commit()


def seed_staff_availability(conn: sqlite3.Connection) -> None:
    ensure_shift_schema(conn)
    cur = conn.cursor()

    week_start = _start_of_week()
    week_end = week_start + timedelta(days=6)
    cur.execute('DELETE FROM staff_availability WHERE availability_date BETWEEN ? AND ?', (week_start.isoformat(), week_end.isoformat()))

    staff_patterns = {
        'sam.staff@example.com': {0: True, 1: True, 2: False, 4: True},
        'tina.staff@example.com': {0: True, 2: True, 3: True},
        'raj.staff@example.com': {1: False, 2: True, 5: True},
    }

    updater_id = _lookup_user_ids(conn, ['maya.manager@example.com']).get('maya.manager@example.com')
    staff_ids = _lookup_user_ids(conn, list(staff_patterns.keys()))
    now_iso = datetime.utcnow().isoformat()

    for email, pattern in staff_patterns.items():
        user_id = staff_ids.get(email)
        if not user_id:
            continue
        for offset, available in pattern.items():
            day = week_start + timedelta(days=offset)
            notes = 'Available for shift' if available else 'Requesting time off'
            cur.execute(
                'INSERT OR REPLACE INTO staff_availability (user_id, availability_date, is_available, notes, updated_by, updated_at) '
                'VALUES (?,?,?,?,?,?)',
                (user_id, day.isoformat(), 1 if available else 0, notes, updater_id, now_iso),
            )

    conn.commit()

def seed_menu_items(conn):
    cur = conn.cursor()
    # Get type ids
    cur.execute('SELECT id, name FROM types')
    types = [r[0] for r in cur.fetchall()]
    sample_items = [
        ('Spring Rolls', 5.5, 'Crispy spring rolls', 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=800&q=80', 10),
        ('Beef Burger', 9.5, 'Grilled beef burger', 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=800&q=80', 8),
        ('Cheesecake', 6.0, 'Creamy cheesecake', 'https://images.unsplash.com/photo-1505253758473-96b7015fcd40?auto=format&fit=crop&w=800&q=80', 6),
        ('Lemonade', 3.0, 'Fresh lemonade', 'https://images.unsplash.com/photo-1558640472-9d2a7deb7f62?auto=format&fit=crop&w=800&q=80', 20),
        ('Caesar Salad', 7.0, 'Fresh greens', 'https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=800&q=80', 12),
        ('Grilled Salmon', 14.5, 'Served with veggies', 'https://images.unsplash.com/photo-1514516345957-556ca7d90aaf?auto=format&fit=crop&w=800&q=80', 5),
        ('Chocolate Mousse', 5.5, 'Rich chocolate mousse', 'https://images.unsplash.com/photo-1488900128323-21503983a07e?auto=format&fit=crop&w=800&q=80', 7),
        ('Iced Tea', 2.5, 'Brewed iced tea', 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80', 15),
        ('Spaghetti', 10.0, 'Pasta with tomato sauce', 'https://images.unsplash.com/photo-1525755662778-989d0524087e?auto=format&fit=crop&w=800&q=80', 9),
        ('Garlic Bread', 3.5, 'Toasted garlic bread', 'https://images.unsplash.com/photo-1604908178086-d1a112d7e1bd?auto=format&fit=crop&w=800&q=80', 11)
    ]

    # Insert only if name not present
    for name, price, desc, img, qty in sample_items:
        cur.execute('SELECT id FROM menu_items WHERE name=?', (name,))
        if cur.fetchone():
            print('Menu item exists, skipping:', name)
            continue
        type_id = random.choice(types) if types else None
        cur.execute('INSERT INTO menu_items (name,price,description,img_link,qty_left,type_id,discount) VALUES (?,?,?,?,?,?,?)', (
            name, price, desc, img, qty, type_id, 0
        ))
        print('Inserted menu item:', name)
    conn.commit()


def seed_orders(conn):
    cur = conn.cursor()
    cur.execute("SELECT id FROM roles WHERE name='User'")
    row = cur.fetchone()
    user_role_id = row[0] if row else None
    cur.execute('SELECT id FROM users WHERE role_id=? ORDER BY id', (user_role_id,))
    user_ids = [r[0] for r in cur.fetchall()]

    cur.execute('SELECT id FROM menu_items ORDER BY id')
    item_ids = [r[0] for r in cur.fetchall()]
    if not user_ids or not item_ids:
        print('No users or menu items to create orders')
        return

    base_time = datetime.utcnow().replace(hour=11, minute=30, second=0, microsecond=0)
    week_offsets = [-3, -2, -1, 0]
    created_orders = 0

    def build_items(seed_index: int) -> List[Dict[str, int]]:
        selections: List[Dict[str, int]] = []
        for offset in range(2):
            item_id = item_ids[(seed_index + offset) % len(item_ids)]
            quantity = (seed_index + offset) % 3 + 1
            selections.append({'item_id': item_id, 'qty': quantity})
        if seed_index % 2 == 0 and len(item_ids) > 2:
            item_id = item_ids[(seed_index + 2) % len(item_ids)]
            selections.append({'item_id': item_id, 'qty': 1})
        return selections

    for user_index, uid in enumerate(user_ids[:5]):
        for week_index, offset in enumerate(week_offsets):
            order_time = base_time + timedelta(weeks=offset, days=user_index % 3, hours=week_index * 2)
            cur.execute('INSERT INTO orders (member_id, order_timestamp) VALUES (?,?)', (uid, order_time))
            order_id = cur.lastrowid
            items = build_items(user_index + week_index)
            cur.execute('INSERT OR REPLACE INTO order_items (order_id, items) VALUES (?,?)', (order_id, json.dumps(items)))
            created_orders += 1

    weekend_users = user_ids[:3] if len(user_ids) >= 3 else user_ids
    for week_index, offset in enumerate(week_offsets):
        for uid in weekend_users:
            order_time = base_time + timedelta(weeks=offset, days=5, hours=18 + week_index)
            cur.execute('INSERT INTO orders (member_id, order_timestamp) VALUES (?,?)', (uid, order_time))
            order_id = cur.lastrowid
            seed_index = (uid + week_index) % len(item_ids)
            items = build_items(seed_index)
            cur.execute('INSERT OR REPLACE INTO order_items (order_id, items) VALUES (?,?)', (order_id, json.dumps(items)))
            created_orders += 1

    conn.commit()
    print(f'Seeded {created_orders} orders spanning {len(week_offsets)} weeks')

def main():
    if not os.path.exists(DB):
        print('DB not found, run init_db.py first')
        return
    conn = sqlite3.connect(DB)
    ensure_title_column(conn)
    ensure_password_hash_column(conn)
    ensure_roles(conn)
    ensure_shift_schema(conn)
    cleanup_legacy_schedule_data(conn)
    reset_database(conn)
    update_missing_passwords(conn)
    seed_users(conn)
    shift_ids = seed_shift_templates(conn)
    seed_shift_assignments(conn, shift_ids)
    seed_staff_availability(conn)
    seed_menu_items(conn)
    seed_orders(conn)
    conn.close()
    print('Seeding complete')
    # Print one user per role for quick login testing
    try:
        print_test_users()
    except Exception:
        pass

if __name__ == '__main__':
    main()


def print_test_users():
    """Print one user email and the default password for each role.
    This uses the seeded users in the database and assumes the seeded
    password is 'password' which is what `seed_users` uses when creating
    users.
    """
    conn = sqlite3.connect(DB)
    cur = conn.cursor()
    roles = ['Admin', 'Manager', 'Staff', 'User']
    results = {}
    for r in roles:
        cur.execute('SELECT u.email FROM users u JOIN roles ro ON u.role_id=ro.id WHERE ro.name=? LIMIT 1', (r,))
        row = cur.fetchone()
        results[r] = row[0] if row else None
    conn.close()

    print('\nTest credentials (password for all is: "password")')
    for role in roles:
        print(f"{role}: {results.get(role)}")
