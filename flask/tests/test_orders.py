import json
import os
import sqlite3
import sys
from pathlib import Path

import pytest  # type: ignore

# Ensure the flask package is importable when tests run from repo root
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from api import create_app  # noqa: E402
from utils import get_db, hash_password  # noqa: E402


@pytest.fixture
def app(tmp_path):
    db_path = tmp_path / 'orders.db'
    app = create_app({'TESTING': True, 'DB_PATH': str(db_path)})

    schema_path = Path(os.path.dirname(__file__)).parent / 'db_schema.sql'
    with app.app_context():
        conn = get_db()
        with open(schema_path, 'r', encoding='utf-8') as handle:
            conn.executescript(handle.read())
        conn.commit()

    return app


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def order_context(app, client):
    password = 'test-password'
    email = 'tester@example.com'

    with app.app_context():
        conn = get_db()
        cur = conn.cursor()

        cur.execute("SELECT id FROM roles WHERE name='User'")
        row = cur.fetchone()
        if row:
            user_role_id = row['id'] if isinstance(row, sqlite3.Row) else row[0]
        else:
            cur.execute('INSERT INTO roles (name) VALUES (?)', ('User',))
            user_role_id = cur.lastrowid

        pw_hash = hash_password(password)
        cur.execute(
            'INSERT INTO users (first_name,last_name,email,role_id,password_hash) VALUES (?,?,?,?,?)',
            ('Test', 'User', email, user_role_id, pw_hash),
        )
        user_id = cur.lastrowid

        cur.execute(
            'INSERT INTO menu_items (name, price, description, qty_left) VALUES (?,?,?,?)',
            ('Test Dish', 12.5, 'Server-side test dish', 5),
        )
        item_id = cur.lastrowid
        conn.commit()

    resp = client.post('/api/auth/login', json={'email': email, 'password': password})
    assert resp.status_code == 200
    data = resp.get_json()
    assert 'access_token' in data
    headers = {'Authorization': f"Bearer {data['access_token']}"}

    return {'headers': headers, 'item_id': item_id, 'user_id': user_id}


def test_create_and_update_order(app, client, order_context):
    headers = order_context['headers']
    item_id = order_context['item_id']

    # Create an order with two items
    payload = {'items': [{'item_id': item_id, 'qty': 2}]}
    resp = client.post('/api/orders/', json=payload, headers=headers)
    assert resp.status_code == 201
    data = resp.get_json()
    assert data['order_id'] > 0
    order_id = data['order_id']

    created_entry = next((entry for entry in data['items'] if entry['item_id'] == item_id), None)
    assert created_entry is not None
    assert created_entry['qty'] == 2

    with app.app_context():
        conn = get_db()
        cur = conn.cursor()
        cur.execute('SELECT qty_left FROM menu_items WHERE id=?', (item_id,))
        qty_after_create = cur.fetchone()['qty_left']
        assert qty_after_create == 3

    # Add one more item to the existing order
    resp_patch = client.patch(
        f'/api/orders/{order_id}/items',
        json={'items': [{'item_id': item_id, 'qty': 1}]},
        headers=headers,
    )
    assert resp_patch.status_code == 200
    data_patch = resp_patch.get_json()
    patched_entry = next((entry for entry in data_patch['items'] if entry['item_id'] == item_id), None)
    assert patched_entry is not None
    assert patched_entry['qty'] == 3

    # Fetch the order and ensure quantities match
    resp_get = client.get(f'/api/orders/{order_id}', headers=headers)
    assert resp_get.status_code == 200
    data_get = resp_get.get_json()
    assert data_get['order_id'] == order_id
    fetched_entry = next((entry for entry in data_get['items'] if entry['item_id'] == item_id), None)
    assert fetched_entry is not None
    assert fetched_entry['qty'] == 3

    with app.app_context():
        conn = get_db()
        cur = conn.cursor()
        cur.execute('SELECT qty_left FROM menu_items WHERE id=?', (item_id,))
        qty_after_patch = cur.fetchone()['qty_left']
        assert qty_after_patch == 2
