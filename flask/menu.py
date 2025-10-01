from __future__ import annotations

import os
from typing import Any, Dict, Optional

from flask import Blueprint, jsonify, request, send_from_directory
from werkzeug.utils import secure_filename

from utils import allowed_image, get_db

try:  # pragma: no cover - used when running as a package
    from .permissions import require_roles
except Exception:  # pragma: no cover - fallback for direct execution
    from permissions import require_roles

bp = Blueprint('menu', __name__)

UPLOAD_FOLDER = os.path.join('static', 'uploads')


def _normalize_img_link(raw: Optional[str]) -> Optional[str]:
    """Return a sanitized path or URL for an image reference."""
    if raw is None:
        return None

    value = str(raw).strip()
    if not value:
        return None

    lowered = value.lower()
    if lowered.startswith('blob:'):
        return value
    if lowered.startswith('http://') or lowered.startswith('https://'):
        return value
    if lowered.startswith('data:'):
        return value

    normalized = value.replace('\\', '/').lstrip()
    if normalized.startswith('/api/'):
        normalized = normalized[5:]
    normalized = normalized.lstrip('/')

    lowered_norm = normalized.lower()
    prefixes = (
        'static/uploads/',
        'menu/uploads/',
        'uploads/',
    )
    for prefix in prefixes:
        if lowered_norm.startswith(prefix):
            file_part = normalized[len(prefix):].lstrip('/')
            if file_part:
                return f"static/uploads/{file_part}"
            return None

    if '/' not in normalized and '.' in normalized:
        return f"static/uploads/{normalized}"

    return normalized


def _resolve_type_id(cur, type_name: Optional[str]) -> Optional[int]:
    if type_name is None:
        return None
    name = str(type_name).strip()
    if not name:
        return None

    cur.execute('SELECT id FROM types WHERE name=?', (name,))
    row = cur.fetchone()
    if row:
        return row['id'] if isinstance(row, dict) else row[0]

    cur.execute('INSERT INTO types (name) VALUES (?)', (name,))
    return cur.lastrowid


def _row_to_item(row: Any) -> Dict[str, Any]:
    item = dict(row)
    item['img_link'] = _normalize_img_link(item.get('img_link'))
    return item


@bp.route('/', methods=['GET'])
def list_items():
    conn = get_db()
    cur = conn.cursor()

    q = request.args.get('q', type=str)
    type_filter = request.args.get('type', type=str)

    sql = (
        'SELECT m.id, m.name, m.price, m.description, m.img_link, '
        'm.qty_left, m.discount, m.type_id, t.name AS type_name '
        'FROM menu_items m '
        'LEFT JOIN types t ON m.type_id = t.id'
    )
    params = []
    filters = []

    if q:
        like = f"%{q}%"
        filters.append('(m.name LIKE ? OR m.description LIKE ?)')
        params.extend([like, like])

    if type_filter:
        filters.append('t.name = ?')
        params.append(type_filter)

    if filters:
        sql += ' WHERE ' + ' AND '.join(filters)

    sql += ' ORDER BY m.id DESC'

    cur.execute(sql, params)
    rows = cur.fetchall()
    items = [_row_to_item(row) for row in rows]
    return jsonify({'items': items})


@bp.route('/<int:item_id>', methods=['GET'])
def get_item(item_id: int):
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        'SELECT m.id, m.name, m.price, m.description, m.img_link, '
        'm.qty_left, m.discount, m.type_id, t.name AS type_name '
        'FROM menu_items m '
        'LEFT JOIN types t ON m.type_id = t.id '
        'WHERE m.id=?',
        (item_id,),
    )
    row = cur.fetchone()
    if not row:
        return jsonify({'msg': 'item not found'}), 404
    return jsonify(_row_to_item(row))


@bp.route('/', methods=['POST'])
@require_roles('Manager')
def create_item():
    data = request.get_json(silent=True) or {}

    name = str(data.get('name', '')).strip()
    if not name:
        return jsonify({'msg': 'name required'}), 400

    try:
        price = float(data.get('price', 0))
    except (TypeError, ValueError):
        return jsonify({'msg': 'price must be a number'}), 400

    description = data.get('description')
    if description is not None:
        description = str(description).strip()
        if not description:
            description = None

    try:
        discount = float(data.get('discount', 0))
    except (TypeError, ValueError):
        return jsonify({'msg': 'discount must be a number'}), 400
    if discount < 0:
        discount = 0.0

    try:
        qty_left = max(0, int(data.get('qty_left', 0)))
    except (TypeError, ValueError):
        return jsonify({'msg': 'qty_left must be an integer'}), 400

    available = data.get('available')
    if available is False:
        qty_left = 0
    elif available is True and qty_left <= 0:
        qty_left = 1

    img_link = _normalize_img_link(data.get('img_link'))

    conn = get_db()
    cur = conn.cursor()

    type_id = _resolve_type_id(cur, data.get('type'))

    columns = ['name', 'price', 'description', 'img_link', 'qty_left', 'discount']
    values = [name, price, description, img_link, qty_left, discount]

    if type_id is not None:
        columns.append('type_id')
        values.append(type_id)

    placeholders = ','.join('?' for _ in columns)
    cur.execute(
        f"INSERT INTO menu_items ({', '.join(columns)}) VALUES ({placeholders})",
        values,
    )
    conn.commit()

    return jsonify({'id': cur.lastrowid}), 201


@bp.route('/<int:item_id>', methods=['PUT'])
@require_roles('Manager')
def update_item(item_id: int):
    data = request.get_json(silent=True) or {}

    conn = get_db()
    cur = conn.cursor()
    cur.execute('SELECT id, qty_left FROM menu_items WHERE id=?', (item_id,))
    existing = cur.fetchone()
    if not existing:
        return jsonify({'msg': 'item not found'}), 404

    fields = []
    params = []

    if 'name' in data:
        name = str(data.get('name', '')).strip()
        if not name:
            return jsonify({'msg': 'name required'}), 400
        fields.append('name=?')
        params.append(name)

    if 'price' in data:
        try:
            price = float(data['price'])
        except (TypeError, ValueError):
            return jsonify({'msg': 'price must be a number'}), 400
        fields.append('price=?')
        params.append(price)

    if 'description' in data:
        description = data.get('description')
        if description is not None:
            description = str(description).strip()
            if not description:
                description = None
        fields.append('description=?')
        params.append(description)

    if 'discount' in data:
        try:
            discount = float(data['discount'])
        except (TypeError, ValueError):
            return jsonify({'msg': 'discount must be a number'}), 400
        if discount < 0:
            discount = 0.0
        fields.append('discount=?')
        params.append(discount)

    qty_override: Optional[int] = None
    if 'qty_left' in data:
        try:
            qty_override = max(0, int(data['qty_left']))
        except (TypeError, ValueError):
            return jsonify({'msg': 'qty_left must be an integer'}), 400

    if 'available' in data:
        make_available = bool(data['available'])
        if make_available:
            qty_value = qty_override
            if qty_value is None:
                qty_value = max(0, int(existing['qty_left'])) if existing else 0
            if qty_value <= 0:
                qty_value = 1
            qty_override = qty_value
        else:
            qty_override = 0

    if qty_override is not None:
        fields.append('qty_left=?')
        params.append(qty_override)

    if 'img_link' in data:
        fields.append('img_link=?')
        params.append(_normalize_img_link(data['img_link']))

    if 'type' in data:
        type_name = data.get('type')
        if type_name is None or str(type_name).strip() == '':
            fields.append('type_id=?')
            params.append(None)
        else:
            type_id = _resolve_type_id(cur, type_name)
            fields.append('type_id=?')
            params.append(type_id)

    if not fields:
        return jsonify({'msg': 'no fields to update'}), 400

    params.append(item_id)
    sql = f"UPDATE menu_items SET {', '.join(fields)} WHERE id=?"
    cur.execute(sql, params)
    conn.commit()

    cur.execute(
        'SELECT m.id, m.name, m.price, m.description, m.img_link, '
        'm.qty_left, m.discount, m.type_id, t.name AS type_name '
        'FROM menu_items m LEFT JOIN types t ON m.type_id = t.id '
        'WHERE m.id=?',
        (item_id,),
    )
    row = cur.fetchone()
    if not row:
        return jsonify({'msg': 'item not found'}), 404
    return jsonify(_row_to_item(row))


@bp.route('/<int:item_id>', methods=['DELETE'])
@require_roles('Manager')
def delete_item(item_id: int):
    conn = get_db()
    cur = conn.cursor()
    cur.execute('DELETE FROM menu_items WHERE id=?', (item_id,))
    conn.commit()
    if cur.rowcount == 0:
        return jsonify({'msg': 'item not found'}), 404
    return jsonify({'deleted': cur.rowcount})


@bp.route('/<int:item_id>/image', methods=['POST'])
@require_roles('Manager')
def upload_image(item_id: int):
    if 'file' not in request.files:
        return jsonify({'msg': 'file required'}), 400

    file = request.files['file']
    filename = getattr(file, 'filename', '') or ''
    if not filename:
        return jsonify({'msg': 'file required'}), 400

    safe_name = secure_filename(filename)
    if not safe_name:
        return jsonify({'msg': 'invalid file name'}), 400

    if not allowed_image(safe_name):
        return jsonify({'msg': 'invalid file type'}), 400

    upload_root = os.path.join(os.path.dirname(__file__), UPLOAD_FOLDER)
    os.makedirs(upload_root, exist_ok=True)

    save_path = os.path.join(upload_root, safe_name)
    try:
        file.save(save_path)
    except Exception:
        return jsonify({'msg': 'failed to save file'}), 500

    rel_path = f"static/uploads/{safe_name}"

    conn = get_db()
    cur = conn.cursor()
    cur.execute('UPDATE menu_items SET img_link=? WHERE id=?', (rel_path, item_id))
    conn.commit()
    if cur.rowcount == 0:
        return jsonify({'msg': 'item not found'}), 404

    return jsonify({'img_link': rel_path}), 201


@bp.route('/uploads/<path:filename>')
def uploaded_file(filename: str):
    upload_root = os.path.join(os.path.dirname(__file__), UPLOAD_FOLDER)
    return send_from_directory(upload_root, filename)


@bp.route('/types', methods=['GET'])
def list_types():
    conn = get_db()
    cur = conn.cursor()
    cur.execute('SELECT id, name FROM types ORDER BY name')
    rows = cur.fetchall()
    types = [dict(row) for row in rows]
    return jsonify({'types': types})

