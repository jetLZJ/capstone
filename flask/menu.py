from flask import Blueprint, request, jsonify, send_from_directory, current_app
from utils import get_db, allowed_image
from werkzeug.utils import secure_filename
import os
from typing import Optional
# Import permissions decorator robustly: prefer relative import when running as a package,
# but fall back to absolute import when running app as a script in Docker.
try:
    from .permissions import require_roles
except Exception:
    from permissions import require_roles

bp = Blueprint('menu', __name__)


def is_manager(user_id: int) -> bool:
    conn = get_db()
    cur = conn.cursor()
    try:
        user_id = int(user_id)
    except Exception:
        pass
    cur.execute('SELECT r.name FROM users u JOIN roles r ON u.role_id=r.id WHERE u.id=?', (user_id,))
    row = cur.fetchone()
    # Allow Admins to have manager-level permissions as well
    return bool(row and row[0] in ('Manager', 'Admin'))


@bp.route('/', methods=['GET'])
def list_menu():
    q = request.args.get('q')
    t = request.args.get('type')
    conn = get_db()
    cur = conn.cursor()
    # include the type name via LEFT JOIN so frontend can display and filter by it
    sql = 'SELECT m.id, m.name, m.price, m.description, m.img_link, m.qty_left, m.discount, t.name as type_name FROM menu_items m LEFT JOIN types t ON m.type_id=t.id'
    params = []
    clauses = []
    if q:
        clauses.append('(m.name LIKE ? OR m.description LIKE ?)')
        like = f"%{q}%"
        params.extend([like, like])
    if t:
        # filter by joined type name
        clauses.append('t.name = ?')
        params.append(t)
    if clauses:
        sql += ' WHERE ' + ' AND '.join(clauses)
    cur.execute(sql, params)
    rows = cur.fetchall()
    items = [dict(row) for row in rows]
    return jsonify({'items': items})


@bp.route('/', methods=['POST'])
def create_item():
    try:
        from flask_jwt_extended import jwt_required, get_jwt_identity
    except Exception:
        return jsonify({'msg': 'JWT extension not available'}), 501
    @require_roles('Manager')
    def inner():
        data = request.get_json() or {}
        name = data.get('name')
        price = data.get('price', 0.0)
        desc = data.get('description')
        type_name = data.get('type')
        if not name:
            return jsonify({'msg': 'name required'}), 400
        conn = get_db()
        cur = conn.cursor()
        type_id: Optional[int] = None
        if type_name:
            cur.execute('SELECT id FROM types WHERE name=?', (type_name,))
            r = cur.fetchone()
            type_id = r[0] if r else None
        cur.execute('INSERT INTO menu_items (name,price,description,type_id) VALUES (?,?,?,?)', (name, price, desc, type_id))
        conn.commit()
        return jsonify({'id': cur.lastrowid}), 201

    return inner()


@bp.route('/<int:item_id>', methods=['GET'])
def get_item(item_id):
    conn = get_db()
    cur = conn.cursor()
    cur.execute('SELECT m.id, m.name, m.price, m.description, m.img_link, m.qty_left, m.discount, t.name as type_name FROM menu_items m LEFT JOIN types t ON m.type_id=t.id WHERE m.id=?', (item_id,))
    row = cur.fetchone()
    if not row:
        return jsonify({'msg': 'not found'}), 404
    return jsonify(dict(row))


@bp.route('/<int:item_id>', methods=['PUT'])
def update_item(item_id):
    try:
        from flask_jwt_extended import jwt_required, get_jwt_identity
    except Exception:
        return jsonify({'msg': 'JWT extension not available'}), 501

    @require_roles('Manager')
    def inner():
        data = request.get_json() or {}
        fields = []
        params = []
        for k in ('name', 'price', 'description', 'qty_left', 'discount'):
            if k in data:
                fields.append(f"{k}=?")
                params.append(data[k])
        if not fields:
            return jsonify({'msg': 'no fields to update'}), 400
        params.append(item_id)
        sql = f"UPDATE menu_items SET {', '.join(fields)} WHERE id=?"
        conn = get_db()
        cur = conn.cursor()
        cur.execute(sql, params)
        conn.commit()
        return jsonify({'updated': cur.rowcount})

    return inner()


@bp.route('/<int:item_id>', methods=['DELETE'])
def delete_item(item_id):
    try:
        from flask_jwt_extended import jwt_required, get_jwt_identity
    except Exception:
        return jsonify({'msg': 'JWT extension not available'}), 501

    @require_roles('Manager')
    def inner():
        conn = get_db()
        cur = conn.cursor()
        cur.execute('DELETE FROM menu_items WHERE id=?', (item_id,))
        conn.commit()
        return jsonify({'deleted': cur.rowcount})

    return inner()


@bp.route('/<int:item_id>/image', methods=['POST'])
def upload_image(item_id):
    try:
        from flask_jwt_extended import jwt_required, get_jwt_identity
    except Exception:
        return jsonify({'msg': 'JWT extension not available'}), 501

    @require_roles('Manager')
    def inner():
        if 'file' not in request.files:
            return jsonify({'msg': 'file required'}), 400
        f = request.files['file']
        filename = getattr(f, 'filename', '') or ''
        if filename == '':
            return jsonify({'msg': 'file required'}), 400

        # sanitize filename and validate extension
        safe_name = secure_filename(filename)
        if not safe_name:
            return jsonify({'msg': 'invalid file name'}), 400
        if not allowed_image(safe_name):
            return jsonify({'msg': 'invalid file type'}), 400

        # Validate MIME type reported by the client (basic check)
        mimetype = getattr(f, 'mimetype', '') or getattr(f, 'content_type', '')
        if not isinstance(mimetype, str) or not mimetype.startswith('image/'):
            return jsonify({'msg': 'invalid mime type'}), 400

        upload_dir = os.path.join(os.path.dirname(__file__), 'static', 'uploads')
        os.makedirs(upload_dir, exist_ok=True)
        save_path = os.path.join(upload_dir, safe_name)
        try:
            f.save(save_path)
        except Exception:
            return jsonify({'msg': 'failed to save file'}), 500

        # update DB with relative web path
        conn = get_db()
        cur = conn.cursor()
        rel = os.path.join('static', 'uploads', safe_name)
        cur.execute('UPDATE menu_items SET img_link=? WHERE id=?', (rel, item_id))
        conn.commit()
        return jsonify({'img_link': rel}), 201

    return inner()


@bp.route('/uploads/<path:filename>')
def uploaded_file(filename):
    upload_dir = os.path.join(os.path.dirname(__file__), 'static', 'uploads')
    return send_from_directory(upload_dir, filename)


@bp.route('/types', methods=['GET'])
def list_types():
    conn = get_db()
    cur = conn.cursor()
    cur.execute('SELECT id, name FROM types ORDER BY name')
    rows = cur.fetchall()
    types = [dict(row) for row in rows]
    return jsonify({'types': types})

