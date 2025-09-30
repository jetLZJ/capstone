import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from api import create_app
import pytest


@pytest.fixture
def app():
    return create_app({'TESTING': True})


@pytest.fixture
def client(app):
    return app.test_client()


def get_tokens(client, email='maya.manager@example.com', password='password'):
    rv = client.post('/api/auth/login', json={'email': email, 'password': password})
    assert rv.status_code == 200
    data = rv.get_json()
    return data['access_token'], data['refresh_token']


def test_shift_create_and_assign(client):
    access, refresh = get_tokens(client)
    headers = {'Authorization': f'Bearer {access}'}

    # create shift
    rv = client.post('/api/schedules/shifts', json={'name': 'Morning', 'role_required': 'Staff', 'start_time': '08:00', 'end_time': '12:00'}, headers=headers)
    assert rv.status_code == 201
    shift_id = rv.get_json()['id']

    # list shifts
    rv = client.get('/api/schedules/shifts')
    assert rv.status_code == 200
    shifts = rv.get_json()['shifts']
    assert any(s['id'] == shift_id for s in shifts)

    # assign shift to a staff user (id 3 seeded)
    rv = client.post('/api/schedules/assign', json={'shift_id': shift_id, 'assigned_user': 3, 'shift_date': '2025-10-01'}, headers=headers)
    assert rv.status_code == 201

    # login as staff to view my assignments
    rv = client.post('/api/auth/login', json={'email': 'sam.staff@example.com', 'password': 'password'})
    assert rv.status_code == 200
    staff_access = rv.get_json()['access_token']
    rv = client.get('/api/schedules/my', headers={'Authorization': f'Bearer {staff_access}'})
    assert rv.status_code == 200
    assigns = rv.get_json()['assignments']
    assert any(a['shift_id'] == shift_id for a in assigns)
