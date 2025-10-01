"""
seed_data.py

Idempotent script to ensure roles include Admin/Manager/Staff/User and to create
dummy users and menu items requested by the user.

Run: python flask/seed_data.py
"""
import os
import sqlite3
from datetime import datetime
import random
from typing import Optional, List, Dict

ROOT = os.path.dirname(__file__)
DB = os.environ.get('DB_PATH', os.path.join(ROOT, 'data', 'app.db'))

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

    import random
    from datetime import datetime, timedelta
    import json

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
    update_missing_passwords(conn)
    seed_users(conn)
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
