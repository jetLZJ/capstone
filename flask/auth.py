from flask import Blueprint, request, jsonify, current_app
from utils import get_db, hash_password, verify_password

bp = Blueprint('auth', __name__)


def role_required(role_name):
    def decorator(fn):
        from functools import wraps

        @wraps(fn)
        def wrapper(*args, **kwargs):
            try:
                # local import to avoid hard dependency during test collection
                from flask_jwt_extended import get_jwt_identity
                identity = get_jwt_identity()
                try:
                    identity = int(identity)
                except Exception:
                    pass
                if not identity:
                    return jsonify({'msg': 'Missing identity'}), 401
                conn = get_db()
                cur = conn.cursor()
                cur.execute('SELECT r.name FROM users u JOIN roles r ON u.role_id=r.id WHERE u.id=?', (identity,))
                row = cur.fetchone()
                if not row or row[0] != role_name:
                    return jsonify({'msg': 'Insufficient permissions'}), 403
            except Exception:
                return jsonify({'msg': 'Auth error'}), 401
            return fn(*args, **kwargs)

        return wrapper

    return decorator


@bp.route('/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    email = data.get('email')
    password = data.get('password')
    first_name = data.get('first_name', '')
    last_name = data.get('last_name', '')
    role = data.get('role', 'User')

    if not email or not password:
        return jsonify({'msg': 'email and password required'}), 400

    conn = get_db()
    cur = conn.cursor()
    # ensure role exists
    cur.execute('SELECT id FROM roles WHERE name=?', (role,))
    row = cur.fetchone()
    role_id = row[0] if row else None
    if role_id is None:
        return jsonify({'msg': 'Invalid role'}), 400

    # check existing
    cur.execute('SELECT id FROM users WHERE email=?', (email,))
    if cur.fetchone():
        return jsonify({'msg': 'Email already registered'}), 400

    pw_hash = hash_password(password)
    cur.execute('INSERT INTO users (first_name,last_name,email,role_id,signup_date,password_hash) VALUES (?,?,?,?,datetime("now"),?)', (
        first_name, last_name, email, role_id, pw_hash
    ))
    conn.commit()
    user_id = cur.lastrowid
    try:
        from flask_jwt_extended import create_access_token, create_refresh_token
        access = create_access_token(identity=str(user_id))
        refresh = create_refresh_token(identity=str(user_id))
    except Exception:
        access = refresh = None
    return jsonify({'access_token': access, 'refresh_token': refresh}), 201


@bp.route('/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    email = data.get('email')
    password = data.get('password')
    if not email or not password:
        return jsonify({'msg': 'email and password required'}), 400
    conn = get_db()
    cur = conn.cursor()
    cur.execute('SELECT id, email FROM users WHERE email=?', (email,))
    row = cur.fetchone()
    if not row:
        return jsonify({'msg': 'Invalid credentials'}), 401
    user_id = row[0]
    # Verify the stored password_hash
    cur.execute('SELECT password_hash FROM users WHERE id=?', (user_id,))
    row2 = cur.fetchone()
    if not row2 or not row2[0]:
        return jsonify({'msg': 'Invalid credentials'}), 401
    stored = row2[0]
    if not verify_password(password, stored):
        return jsonify({'msg': 'Invalid credentials'}), 401

    try:
        from flask_jwt_extended import create_access_token, create_refresh_token
        access = create_access_token(identity=str(user_id))
        refresh = create_refresh_token(identity=str(user_id))
    except Exception as e:
        if current_app and current_app.config.get('TESTING'):
            return jsonify({'msg': 'token creation error', 'error': str(e)}), 500
        access = refresh = None
    return jsonify({'access_token': access, 'refresh_token': refresh}), 200


@bp.route('/refresh', methods=['POST'])
def refresh_token():
    try:
        from flask_jwt_extended import jwt_required, get_jwt_identity, create_access_token
    except Exception:
        return jsonify({'msg': 'JWT not available'}), 501

    @jwt_required(refresh=True)
    def inner():
        uid = get_jwt_identity()
        access = create_access_token(identity=str(uid))
        return jsonify({'access_token': access})

    return inner()


@bp.route('/logout', methods=['DELETE'])
def logout():
    try:
        from flask_jwt_extended import jwt_required, get_jwt
    except Exception:
        return jsonify({'msg': 'JWT not available'}), 501

    @jwt_required()
    def inner():
        jti = get_jwt()['jti']
        token_type = get_jwt().get('type')
        uid = get_jwt().get('sub')
        conn = get_db()
        cur = conn.cursor()
        cur.execute('INSERT OR REPLACE INTO revoked_tokens (jti, token_type, user_identity) VALUES (?,?,?)', (jti, token_type, uid))
        conn.commit()
        return jsonify({'msg': 'token revoked'})

    return inner()


@bp.route('/me', methods=['GET'])
def me():
    # Use local jwt_required/get_jwt_identity so import is optional
    try:
        from flask_jwt_extended import jwt_required, get_jwt_identity
    except Exception:
        return jsonify({'msg': 'JWT not available in environment'}), 501
    @jwt_required()
    def inner():
        uid = get_jwt_identity()
        conn = get_db()
        cur = conn.cursor()
        cur.execute('SELECT id, first_name, last_name, email FROM users WHERE id=?', (uid,))
        row = cur.fetchone()
        if not row:
            return jsonify({'msg': 'User not found'}), 404
        return jsonify({'id': row[0], 'first_name': row[1], 'last_name': row[2], 'email': row[3]})
    return inner()
