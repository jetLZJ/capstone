import os
import sys
from datetime import date, timedelta

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


def get_week_schedule(client, token, week_start=None):
    query_string = {}
    if week_start:
        query_string['week_start'] = week_start
    rv = client.get('/api/schedules/week', headers={'Authorization': f'Bearer {token}'}, query_string=query_string)
    assert rv.status_code == 200
    return rv.get_json()


def create_assignment(client, token, payload):
    rv = client.post('/api/schedules/assignments', headers={'Authorization': f'Bearer {token}'}, json=payload)
    assert rv.status_code == 201
    return rv.get_json()['created_ids']


def delete_assignment(client, token, assignment_id):
    rv = client.delete(f'/api/schedules/assignments/{assignment_id}', headers={'Authorization': f'Bearer {token}'})
    assert rv.status_code == 204


def list_notifications(client, token, include_ack=False):
    query_string = {'include_acknowledged': 'true'} if include_ack else {}
    rv = client.get(
        '/api/schedules/notifications',
        headers={'Authorization': f'Bearer {token}'},
        query_string=query_string,
    )
    assert rv.status_code == 200
    return rv.get_json()['notifications']


def acknowledge_notification(client, token, notification_id):
    return client.post(
        f'/api/schedules/notifications/{notification_id}/ack',
        headers={'Authorization': f'Bearer {token}'},
    )


def _next_monday(base=None, weeks_ahead=0):
    base = base or date.today()
    days_until_monday = (7 - base.weekday()) % 7
    if days_until_monday == 0:
        days_until_monday = 7
    target = base + timedelta(days=days_until_monday) + timedelta(weeks=weeks_ahead)
    return target


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


def test_staff_can_view_open_coverage(client):
    staff_token = login(client, 'sam.staff@example.com')
    manager_token = login(client, 'maya.manager@example.com')

    target_date = _next_monday()
    week_start = target_date - timedelta(days=target_date.weekday())

    created_ids = create_assignment(
        client,
        manager_token,
        {
            'week_start': week_start.isoformat(),
            'shift_date': target_date.isoformat(),
            'start_time': '09:00',
            'end_time': '15:00',
            'status': 'open',
            'role': 'Server',
        },
    )
    assignment_id = created_ids[0]

    try:
        payload = get_week_schedule(client, staff_token, week_start=week_start.isoformat())
        open_assignments = [
            assignment
            for day in payload['days']
            for assignment in day['assignments']
            if (assignment.get('status') or '').lower() == 'open'
        ]
        assert any(int(assignment['id']) == assignment_id for assignment in open_assignments)
    finally:
        delete_assignment(client, manager_token, assignment_id)


def test_staff_can_claim_open_shift(client):
    staff_token = login(client, 'sam.staff@example.com')
    staff_profile = get_profile(client, staff_token)
    manager_token = login(client, 'maya.manager@example.com')

    target_date = _next_monday(weeks_ahead=1)
    week_start = target_date - timedelta(days=target_date.weekday())

    created_ids = create_assignment(
        client,
        manager_token,
        {
            'week_start': week_start.isoformat(),
            'shift_date': target_date.isoformat(),
            'start_time': '12:00',
            'end_time': '18:00',
            'status': 'open',
            'role': 'Server',
        },
    )
    assignment_id = created_ids[0]

    try:
        rv = client.post(
            f'/api/schedules/assignments/{assignment_id}/claim',
            headers={'Authorization': f'Bearer {staff_token}'},
        )
        assert rv.status_code == 200
        claimed = rv.get_json()['assignment']
        assert claimed['staff_id'] == staff_profile['id']
        assert (claimed['status'] or '').lower() == 'scheduled'

        payload = get_week_schedule(client, staff_token, week_start=week_start.isoformat())
        matching = [
            assignment
            for day in payload['days']
            for assignment in day['assignments']
            if int(assignment['id']) == assignment_id
        ]
        assert matching
        assert matching[0]['staff_id'] == staff_profile['id']
    finally:
        delete_assignment(client, manager_token, assignment_id)


def test_staff_claim_blocked_when_conflict(client):
    staff_token = login(client, 'sam.staff@example.com')
    staff_profile = get_profile(client, staff_token)
    manager_token = login(client, 'maya.manager@example.com')

    target_date = _next_monday(weeks_ahead=2)
    week_start = target_date - timedelta(days=target_date.weekday())

    existing_shift_id = create_assignment(
        client,
        manager_token,
        {
            'week_start': week_start.isoformat(),
            'shift_date': target_date.isoformat(),
            'start_time': '09:00',
            'end_time': '15:00',
            'staff_id': staff_profile['id'],
            'role': 'Server',
            'status': 'scheduled',
        },
    )[0]

    conflicting_open_id = create_assignment(
        client,
        manager_token,
        {
            'week_start': week_start.isoformat(),
            'shift_date': target_date.isoformat(),
            'start_time': '12:00',
            'end_time': '18:00',
            'status': 'open',
            'role': 'Server',
        },
    )[0]

    try:
        rv = client.post(
            f'/api/schedules/assignments/{conflicting_open_id}/claim',
            headers={'Authorization': f'Bearer {staff_token}'},
        )
        assert rv.status_code == 409
        data = rv.get_json()
        assert 'conflicts' in data
    finally:
        delete_assignment(client, manager_token, conflicting_open_id)
        delete_assignment(client, manager_token, existing_shift_id)


def test_staff_receives_notification_on_assignment_create(client):
    staff_token = login(client, 'sam.staff@example.com')
    staff_profile = get_profile(client, staff_token)
    manager_token = login(client, 'maya.manager@example.com')

    # Clear any existing notifications for a predictable baseline
    for note in list_notifications(client, staff_token, include_ack=True):
        acknowledge_notification(client, staff_token, note['id'])

    target_date = _next_monday(weeks_ahead=3)
    week_start = target_date - timedelta(days=target_date.weekday())

    created_ids = create_assignment(
        client,
        manager_token,
        {
            'week_start': week_start.isoformat(),
            'shift_date': target_date.isoformat(),
            'start_time': '09:00',
            'end_time': '15:00',
            'staff_id': staff_profile['id'],
            'role': 'Server',
            'status': 'scheduled',
        },
    )
    assignment_id = created_ids[0]

    try:
        notifications = list_notifications(client, staff_token)
        matching = [note for note in notifications if int(note.get('assignment_id') or 0) == assignment_id]
        assert matching
        note_id = matching[0]['id']
        ack_response = acknowledge_notification(client, staff_token, note_id)
        assert ack_response.status_code == 200
        remaining = list_notifications(client, staff_token)
        assert all(note['id'] != note_id for note in remaining)
    finally:
        delete_assignment(client, manager_token, assignment_id)
        for note in list_notifications(client, staff_token, include_ack=True):
            if int(note.get('assignment_id') or 0) == assignment_id:
                acknowledge_notification(client, staff_token, note['id'])


def test_staff_receives_notification_on_assignment_update(client):
    staff_token = login(client, 'sam.staff@example.com')
    staff_profile = get_profile(client, staff_token)
    manager_token = login(client, 'maya.manager@example.com')

    for note in list_notifications(client, staff_token, include_ack=True):
        acknowledge_notification(client, staff_token, note['id'])

    target_date = _next_monday(weeks_ahead=4)
    week_start = target_date - timedelta(days=target_date.weekday())

    assignment_id = create_assignment(
        client,
        manager_token,
        {
            'week_start': week_start.isoformat(),
            'shift_date': target_date.isoformat(),
            'start_time': '10:00',
            'end_time': '16:00',
            'staff_id': staff_profile['id'],
            'role': 'Server',
            'status': 'scheduled',
        },
    )[0]

    try:
        # Dismiss the initial creation notification so we can isolate the update event
        for note in list_notifications(client, staff_token):
            acknowledge_notification(client, staff_token, note['id'])

        update_payload = {
            'shift_date': target_date.isoformat(),
            'start_time': '11:00',
            'end_time': '17:00',
            'role': 'Server',
            'status': 'confirmed',
        }

        rv = client.patch(
            f'/api/schedules/assignments/{assignment_id}',
            headers={'Authorization': f'Bearer {manager_token}'},
            json=update_payload,
        )
        assert rv.status_code == 200

        notifications = list_notifications(client, staff_token)
        matching = [note for note in notifications if int(note.get('assignment_id') or 0) == assignment_id]
        assert matching
        assert any('update' in (note.get('title') or '').lower() or 'update' in (note.get('message') or '').lower() for note in matching)

        for note in matching:
            acknowledge_notification(client, staff_token, note['id'])
    finally:
        delete_assignment(client, manager_token, assignment_id)
        for note in list_notifications(client, staff_token, include_ack=True):
            if int(note.get('assignment_id') or 0) == assignment_id:
                acknowledge_notification(client, staff_token, note['id'])
