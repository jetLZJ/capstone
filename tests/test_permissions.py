import pytest
from flask import Flask
from flask_jwt_extended import create_access_token
import sqlite3
from flask.permissions import expand_allowed_roles


def test_expand_allowed_roles():
    # Manager should expand to include Admin
    allowed = expand_allowed_roles(['Manager'])
    assert 'Manager' in allowed
    assert 'Admin' in allowed

*** End Patch