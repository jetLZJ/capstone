import os
import sys
from datetime import date

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from api import create_app


@pytest.fixture
def app():
    return create_app({'TESTING': True})


@pytest.fixture
def client(app):
    return app.test_client()


def login(client, email, password='password'):
    rv = client.post('/api/auth/login', json={'email': email, 'password': password})
    assert rv.status_code == 200
    return rv.get_json()['access_token']


def get_profile(client, token):
    rv = client.get('/api/auth/me', headers={'Authorization': f'Bearer {token}'})
    assert rv.status_code == 200
    return rv.get_json()


def test_staff_can_view_and_update_own_availability(client):
    staff_token = login(client, 'sam.staff@example.com')
    staff_profile = get_profile(client, staff_token)

    rv = client.get('/api/schedules/availability', headers={'Authorization': f'Bearer {staff_token}'})
    assert rv.status_code == 200
    payload = rv.get_json()
    entries = payload['entries']
    assert len(entries) == 7
    assert all(entry['user_id'] == staff_profile['id'] for entry in entries)

    target_entry = next((entry for entry in entries if entry['is_available'] is not None), entries[-1])
    update_payload = {
        'entries': [
            {
                'date': target_entry['date'],
                'is_available': False,
                'notes': 'Unavailable for personal appointment',
            }
        ]
    }

    rv = client.put('/api/schedules/availability', json=update_payload, headers={'Authorization': f'Bearer {staff_token}'})
    assert rv.status_code == 200
    updated = rv.get_json()['entries'][0]
    assert updated['is_available'] is False

    rv = client.get('/api/schedules/availability', headers={'Authorization': f'Bearer {staff_token}'})
    assert rv.status_code == 200
    refreshed = [entry for entry in rv.get_json()['entries'] if entry['date'] == target_entry['date']][0]
    assert refreshed['is_available'] is False

    # reset availability back to true to keep data stable for other tests
    reset_payload = {
        'entries': [
            {
                'date': target_entry['date'],
                'is_available': True,
                'notes': 'Back on the schedule',
            }
        ]
    }
    rv = client.put('/api/schedules/availability', json=reset_payload, headers={'Authorization': f'Bearer {staff_token}'})
    assert rv.status_code == 200


def test_staff_cannot_update_other_users(client):
    staff_token = login(client, 'sam.staff@example.com')
    staff_profile = get_profile(client, staff_token)
    other_user_id = staff_profile['id'] + 99

    payload = {
        'user_id': other_user_id,
        'entries': [
            {
                'date': date.today().isoformat(),
                'is_available': True,
            }
        ],
    }

    rv = client.put('/api/schedules/availability', json=payload, headers={'Authorization': f'Bearer {staff_token}'})
    assert rv.status_code == 403


def test_manager_can_update_staff_availability(client):
    manager_token = login(client, 'maya.manager@example.com')
    rv = client.get('/api/schedules/staff', headers={'Authorization': f'Bearer {manager_token}'})
    assert rv.status_code == 200
    staff_members = rv.get_json()['staff']
    target = next((member for member in staff_members if member['role'] == 'Staff'), staff_members[0])

    payload = {
        'user_id': target['id'],
        'entries': [
            {
                'date': date.today().isoformat(),
                'is_available': True,
                'notes': 'Approved by manager',
            }
        ],
    }

    rv = client.put('/api/schedules/availability', json=payload, headers={'Authorization': f'Bearer {manager_token}'})
    assert rv.status_code == 200


def test_analytics_requires_manager_role(client):
    staff_token = login(client, 'sam.staff@example.com')
    rv = client.get('/api/analytics/summary', headers={'Authorization': f'Bearer {staff_token}'})
    assert rv.status_code == 403

    manager_token = login(client, 'maya.manager@example.com')
    rv = client.get('/api/analytics/summary', headers={'Authorization': f'Bearer {manager_token}'})
    assert rv.status_code == 200
