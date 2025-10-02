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
        cur.execute('SELECT id FROM users WHERE email=?', (u['email'],))
        if cur.fetchone():
            print('User exists, skipping:', u['email'])
            continue
        role_id = role_map.get(u['role'])
        pw_hash = hash_password('password')
        cur.execute('INSERT INTO users (first_name,last_name,email,phone_number,role_id,title,signup_date,password_hash) VALUES (?,?,?,?,?,?,?,?)', (
            u['first_name'], u['last_name'], u['email'], u['phone_number'], role_id, u['title'], datetime.utcnow(), pw_hash
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
            'start_time': '07:00',
            'end_time': '11:00',
            'default_duration': 240,
            'recurrence_rule': 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
        },
        {
            'name': 'Lunch Service',
            'role_required': 'Server',
            'start_time': '11:00',
            'end_time': '16:00',
            'default_duration': 300,
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
            'start_time': '20:00',
            'end_time': '23:00',
            'default_duration': 180,
            'recurrence_rule': 'FREQ=WEEKLY;BYDAY=FR,SA',
        },
    ]

    name_to_id: Dict[str, int] = {}
    for template in templates:
        cur.execute('SELECT id FROM shifts WHERE name=?', (template['name'],))
        row = cur.fetchone()
        if row:
            name_to_id[template['name']] = row[0]
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

    staff_emails = [
        'maya.manager@example.com',
        'sam.staff@example.com',
        'tina.staff@example.com',
        'raj.staff@example.com',
    ]
    user_map = _lookup_user_ids(conn, staff_emails)

    current_week_start = _start_of_week()
    previous_week_start = current_week_start - timedelta(weeks=1)

    # Remove any assignments within the two-week window so reseeding is deterministic even if
    # older rows were missing schedule_week_start values.
    window_start = previous_week_start
    window_end = current_week_start + timedelta(days=6)
    cur.execute(
        'DELETE FROM shift_assignments WHERE shift_date BETWEEN ? AND ?',
        (window_start.isoformat(), window_end.isoformat()),
    )
    cur.execute(
        'DELETE FROM shift_assignments WHERE schedule_week_start IN (?, ?)',
        (previous_week_start.isoformat(), current_week_start.isoformat()),
    )
    print('Regenerating shift assignments for weeks starting', previous_week_start, 'and', current_week_start)

    weekly_templates: List[Dict[str, Any]] = [
        {
            'label': 'Previous week mix of statuses',
            'week_start': previous_week_start,
            'items': [
                {
                    'shift': 'Morning Prep',
                    'staff_email': 'tina.staff@example.com',
                    'day_offset': 0,
                    'start_time': '07:00',
                    'end_time': '11:00',
                    'role': 'Kitchen',
                    'status': 'confirmed',
                    'notes': 'Prepped breakfast menu and cold stations',
                },
                {
                    'shift': 'Lunch Service',
                    'staff_email': 'sam.staff@example.com',
                    'day_offset': 0,
                    'start_time': '11:30',
                    'end_time': '16:00',
                    'role': 'Server',
                    'status': 'scheduled',
                    'notes': 'Handled patio and bar seating',
                },
                {
                    'shift': 'Dinner Service',
                    'staff_email': 'raj.staff@example.com',
                    'day_offset': 2,
                    'start_time': '16:00',
                    'end_time': '22:00',
                    'role': 'Server',
                    'status': 'pending',
                    'notes': 'Swap requested, awaiting confirmation',
                },
                {
                    'shift': 'Lunch Service',
                    'staff_email': None,
                    'day_offset': 3,
                    'start_time': '12:00',
                    'end_time': '15:00',
                    'role': 'Server',
                    'status': 'open',
                    'notes': 'Need extra set of hands for event group',
                },
                {
                    'shift': 'Dinner Service',
                    'staff_email': 'sam.staff@example.com',
                    'day_offset': 5,
                    'start_time': '17:00',
                    'end_time': '22:00',
                    'role': 'Server',
                    'status': 'scheduled',
                    'notes': 'Covering main dining room rotation',
                },
                {
                    'shift': 'Closing Shift',
                    'staff_email': 'maya.manager@example.com',
                    'day_offset': 6,
                    'start_time': '20:00',
                    'end_time': '23:00',
                    'role': 'Support',
                    'status': 'confirmed',
                    'notes': 'Weekly inventory sign-off and vendor notes',
                },
            ],
        },
        {
            'label': 'Current week coverage snapshot',
            'week_start': current_week_start,
            'items': [
                {
                    'shift': 'Morning Prep',
                    'staff_email': 'tina.staff@example.com',
                    'day_offset': 0,
                    'start_time': '06:30',
                    'end_time': '10:30',
                    'role': 'Kitchen',
                    'status': 'confirmed',
                    'notes': 'Seasonal soups and pastry prep',
                },
                {
                    'shift': 'Lunch Service',
                    'staff_email': 'sam.staff@example.com',
                    'day_offset': 1,
                    'start_time': '11:00',
                    'end_time': '15:30',
                    'role': 'Server',
                    'status': 'scheduled',
                    'notes': 'Corporate luncheon coverage',
                },
                {
                    'shift': 'Dinner Service',
                    'staff_email': 'raj.staff@example.com',
                    'day_offset': 2,
                    'start_time': '16:00',
                    'end_time': '22:00',
                    'role': 'Server',
                    'status': 'pending',
                    'notes': 'Awaiting childcare confirmation',
                },
                {
                    'shift': 'Lunch Service',
                    'staff_email': None,
                    'day_offset': 3,
                    'start_time': '12:30',
                    'end_time': '16:00',
                    'role': 'Server',
                    'status': 'open',
                    'notes': 'Community tasting event support',
                },
                {
                    'shift': 'Dinner Service',
                    'staff_email': 'sam.staff@example.com',
                    'day_offset': 4,
                    'start_time': '17:00',
                    'end_time': '22:00',
                    'role': 'Server',
                    'status': 'scheduled',
                    'notes': 'High-volume reservation block',
                },
                {
                    'shift': 'Morning Prep',
                    'staff_email': 'tina.staff@example.com',
                    'day_offset': 5,
                    'start_time': '07:00',
                    'end_time': '11:00',
                    'role': 'Kitchen',
                    'status': 'confirmed',
                    'notes': 'Weekend brunch mise en place',
                },
                {
                    'shift': 'Closing Shift',
                    'staff_email': 'maya.manager@example.com',
                    'day_offset': 6,
                    'start_time': '20:00',
                    'end_time': '23:00',
                    'role': 'Support',
                    'status': 'confirmed',
                    'notes': 'Close-out audit and maintenance check',
                },
            ],
        },
    ]

    now_iso = datetime.utcnow().isoformat()
    for template in weekly_templates:
        for item in template['items']:
            shift_id = shift_ids.get(item['shift'])
            if not shift_id:
                continue

            shift_date = template['week_start'] + timedelta(days=item['day_offset'])
            start_iso = _combine_iso(shift_date, item['start_time'])
            end_iso = _combine_iso(shift_date, item['end_time'])
            assigned_user = user_map.get(item['staff_email']) if item['staff_email'] else None

            cur.execute(
                'INSERT INTO shift_assignments (shift_id, assigned_user, shift_date, start_time, end_time, role, status, notes, schedule_week_start, created_at, updated_at)\n'
                'VALUES (?,?,?,?,?,?,?,?,?,?,?)',
                (
                    shift_id,
                    assigned_user,
                    shift_date.isoformat(),
                    start_iso,
                    end_iso,
                    item['role'],
                    item['status'],
                    item['notes'],
                    template['week_start'].isoformat(),
                    now_iso,
                    now_iso,
                ),
            )
            print('Inserted shift assignment:', template['label'], shift_date, '->', item['status'])

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
    # Get user ids for customers (role 'User')
    cur.execute("SELECT id FROM roles WHERE name='User'")
    row = cur.fetchone()
    user_role_id = row[0] if row else None
    cur.execute('SELECT id FROM users WHERE role_id=?', (user_role_id,))
    user_ids = [r[0] for r in cur.fetchall()]

    # Get all menu item ids
    cur.execute('SELECT id FROM menu_items')
    item_ids = [r[0] for r in cur.fetchall()]
    if not user_ids or not item_ids:
        print('No users or menu items to create orders')
        return

    # Create one order per user (or up to 5), but only if that user has no orders yet
    orders_to_create = user_ids[:5]
    extra = 2
    for uid in orders_to_create:
        # skip if user already has an order
        cur.execute('SELECT id FROM orders WHERE member_id=? LIMIT 1', (uid,))
        if cur.fetchone():
            print(f'User {uid} already has order, skipping')
            continue
        ts = datetime.utcnow() - timedelta(days=random.randint(0,7), hours=random.randint(0,23))
        cur.execute('INSERT INTO orders (member_id, order_timestamp) VALUES (?,?)', (uid, ts))
        order_id = cur.lastrowid
        # add 1-3 items per order and store as JSON array in order_items table
        items = []
        for _ in range(random.randint(1,3)):
            item = random.choice(item_ids)
            qty = random.randint(1,3)
            items.append({'item_id': item, 'qty': qty})
        cur.execute('INSERT OR REPLACE INTO order_items (order_id, items) VALUES (?,?)', (order_id, json.dumps(items)))

    # extra orders by random users
    for _ in range(extra):
        uid = random.choice(user_ids)
        ts = datetime.utcnow() - timedelta(days=random.randint(0,7), hours=random.randint(0,23))
        cur.execute('INSERT INTO orders (member_id, order_timestamp) VALUES (?,?)', (uid, ts))
        order_id = cur.lastrowid
        items = []
        for _ in range(random.randint(1,3)):
            item = random.choice(item_ids)
            qty = random.randint(1,4)
            items.append({'item_id': item, 'qty': qty})
        cur.execute('INSERT OR REPLACE INTO order_items (order_id, items) VALUES (?,?)', (order_id, json.dumps(items)))

    conn.commit()
    print('Seeded orders and order_items')

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
