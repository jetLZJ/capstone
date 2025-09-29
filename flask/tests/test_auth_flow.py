import sys
import os
import pytest

# Ensure local flask package is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from api import create_app


@pytest.fixture
def app():
    app = create_app({'TESTING': True})
    return app


@pytest.fixture
def client(app):
    return app.test_client()


def test_login_refresh_logout_flow(client):
    # Use seeded manager user from seed_data.py
    email = 'maya.manager@example.com'
    password = 'password'

    # login
    rv = client.post('/api/auth/login', json={'email': email, 'password': password})
    assert rv.status_code == 200
    data = rv.get_json()
    assert 'access_token' in data and data['access_token']
    assert 'refresh_token' in data and data['refresh_token']
    access = data['access_token']
    refresh = data['refresh_token']

    # access protected endpoint
    rv = client.get('/api/auth/me', headers={'Authorization': f'Bearer {access}'})
    assert rv.status_code == 200
    me = rv.get_json()
    assert me.get('email') == email

    # logout (revoke access token)
    rv = client.delete('/api/auth/logout', headers={'Authorization': f'Bearer {access}'})
    assert rv.status_code == 200

    # access protected endpoint should now fail (token revoked)
    rv = client.get('/api/auth/me', headers={'Authorization': f'Bearer {access}'})
    assert rv.status_code in (401, 422)

    # use refresh token to get a new access token
    rv = client.post('/api/auth/refresh', headers={'Authorization': f'Bearer {refresh}'})
    assert rv.status_code == 200
    new_access = rv.get_json().get('access_token')
    assert new_access and new_access != access

    # new access should work
    rv = client.get('/api/auth/me', headers={'Authorization': f'Bearer {new_access}'})
    assert rv.status_code == 200
    me2 = rv.get_json()
    assert me2.get('email') == email
