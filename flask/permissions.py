from functools import wraps
from typing import Set
from flask import jsonify, current_app
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
from utils import get_db


def _expand_allowed(roles) -> Set[str]:
    # Always allow Admins to perform manager-level actions
    return set(roles) | {'Admin'}


def require_roles(*roles):
    allowed = _expand_allowed(roles)

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            try:
                # ensure JWT present and valid
                verify_jwt_in_request()
                uid = get_jwt_identity()
            except Exception as e:
                current_app.logger.info(f"permissions.require_roles auth failure: {e}")
                return jsonify({'msg': 'auth required'}), 401

            try:
                conn = get_db()
                cur = conn.cursor()
                cur.execute('SELECT r.name FROM users u JOIN roles r ON u.role_id=r.id WHERE u.id=?', (uid,))
                row = cur.fetchone()
                role = row[0] if row else None
            except Exception as e:
                current_app.logger.exception('permissions.require_roles DB error')
                return jsonify({'msg': 'internal error'}), 500

            current_app.logger.info(f"permissions.require_roles: uid={uid}, role={role}, allowed={allowed}")
            if role not in allowed:
                return jsonify({'msg': 'manager role required'}), 403

            return fn(*args, **kwargs)

        return wrapper

    return decorator


def expand_allowed_roles(roles):
    """Utility used by tests to compute the expanded allowed set."""
    return _expand_allowed(roles)
