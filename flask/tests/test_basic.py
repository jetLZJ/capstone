import sys
import os
import pytest
# Ensure the flask package directory is importable when tests run from repo root
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from api import create_app


@pytest.fixture
def app():
    app = create_app({'TESTING': True})
    return app


@pytest.fixture
def client(app):
    return app.test_client()


def test_menu_list(client):
    resp = client.get('/api/menu/')
    assert resp.status_code == 200
    data = resp.get_json()
    assert 'items' in data
