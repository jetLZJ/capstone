from __future__ import annotations

import json
from typing import Any, Callable, Dict, List, Optional

from flask import Blueprint, jsonify, request, current_app

from utils import get_db

bp = Blueprint('orders', __name__)

try:  # optional JWT dependency to keep tests running when extension missing
    from flask_jwt_extended import get_jwt_identity as _get_jwt_identity
    from flask_jwt_extended import jwt_required as _jwt_required
except Exception:  # pragma: no cover - executed only when extension missing
    _jwt_required = None  # type: ignore[assignment]
    _get_jwt_identity = None  # type: ignore[assignment]

jwt_required: Optional[Callable[..., Any]] = _jwt_required
get_jwt_identity: Optional[Callable[[], Any]] = _get_jwt_identity


def _normalize_items(raw_items) -> List[Dict[str, int]]:
    """Validate payload and return list of {item_id, qty} dicts."""
    if not isinstance(raw_items, list) or not raw_items:
        raise ValueError('items array required')

    aggregated: Dict[int, int] = {}
    order: List[int] = []
    for entry in raw_items:
        if not isinstance(entry, dict):
            raise ValueError('each item must be an object with item_id and qty')
        item_id_raw = entry.get('item_id')
        qty_raw = entry.get('qty', 1)
        if item_id_raw is None:
            raise ValueError('item_id required')
        if qty_raw is None:
            raise ValueError('qty required')
        try:
            item_id = int(item_id_raw)
            qty = int(qty_raw)
        except (TypeError, ValueError) as exc:  # pragma: no cover - validation branch
            raise ValueError('item_id and qty must be integers') from exc
        if item_id <= 0:
            raise ValueError('item_id must be positive')
        if qty <= 0:
            raise ValueError('qty must be positive')
        if item_id not in aggregated:
            aggregated[item_id] = qty
            order.append(item_id)
        else:
            aggregated[item_id] += qty
    return [{'item_id': iid, 'qty': aggregated[iid]} for iid in order]


def _fetch_inventory_map(conn, item_ids: List[int]) -> Dict[int, Dict]:
    if not item_ids:
        return {}
    placeholders = ','.join('?' for _ in item_ids)
    cur = conn.cursor()
    cur.execute(
        f'SELECT id, name, price, description, img_link, qty_left FROM menu_items WHERE id IN ({placeholders})',
        item_ids,
    )
    rows = cur.fetchall()
    return {row['id']: dict(row) for row in rows}


def _load_order_items(conn, order_id: int) -> List[Dict[str, int]]:
    cur = conn.cursor()
    cur.execute('SELECT items FROM order_items WHERE order_id=?', (order_id,))
    row = cur.fetchone()
    if not row or not row['items']:
        return []
    try:
        raw_items = json.loads(row['items'])
    except (TypeError, json.JSONDecodeError):  # pragma: no cover - defensive
        return []

    normalized: List[Dict[str, int]] = []
    for entry in raw_items:
        if not isinstance(entry, dict):
            continue
        item_id_raw = entry.get('item_id')
        qty_raw = entry.get('qty', 0)
        if item_id_raw is None or qty_raw is None:
            continue
        try:
            item_id = int(item_id_raw)
            qty = int(qty_raw)
        except (TypeError, ValueError):
            continue
        if item_id <= 0 or qty <= 0:
            continue
        normalized.append({'item_id': item_id, 'qty': qty})
    return normalized


def _merge_items(existing: List[Dict[str, int]], additions: List[Dict[str, int]]) -> List[Dict[str, int]]:
    aggregated: Dict[int, int] = {}
    order: List[int] = []
    for entry in existing + additions:
        item_id = entry['item_id']
        qty = entry['qty']
        if item_id not in aggregated:
            aggregated[item_id] = qty
            order.append(item_id)
        else:
            aggregated[item_id] += qty
    return [{'item_id': iid, 'qty': aggregated[iid]} for iid in order]


def _build_order_response(conn, order_id: int, *, order_closed: bool = False) -> Dict:
    items = _load_order_items(conn, order_id)
    inventory = _fetch_inventory_map(conn, [item['item_id'] for item in items])
    detailed = []
    for item in items:
        info = inventory.get(item['item_id'])
        if not info:
            continue
        detailed.append({
            'item_id': info['id'],
            'name': info.get('name'),
            'price': info.get('price'),
            'description': info.get('description'),
            'img_link': info.get('img_link'),
            'qty': item['qty'],
            'qty_left': info.get('qty_left'),
        })
    cur = conn.cursor()
    cur.execute('SELECT order_timestamp FROM orders WHERE id=?', (order_id,))
    ts_row = cur.fetchone()
    order_ts = ts_row['order_timestamp'] if ts_row else None
    return {
        'order_id': order_id,
        'items': detailed,
        'order_timestamp': order_ts,
        'order_closed': order_closed,
    }


def _write_order_items(conn, order_id: int, items: List[Dict[str, int]]) -> None:
    cur = conn.cursor()
    if items:
        cur.execute('INSERT OR REPLACE INTO order_items (order_id, items) VALUES (?, ?)', (order_id, json.dumps(items)))
    else:
        cur.execute('DELETE FROM order_items WHERE order_id=?', (order_id,))


def _ensure_jwt():
    if not jwt_required or not get_jwt_identity:  # pragma: no cover - executed only in unsupported envs
        return False
    return True


@bp.route('/', methods=['POST'])
def create_order():
    jwt_required_fn = jwt_required
    get_identity_fn = get_jwt_identity
    if not jwt_required_fn or not get_identity_fn:
        return jsonify({'msg': 'JWT extension not available'}), 501

    @jwt_required_fn()
    def inner():
        payload = request.get_json(silent=True) or {}
        try:
            items = _normalize_items(payload.get('items'))
        except ValueError as exc:
            return jsonify({'msg': str(exc)}), 400

        user_id = get_identity_fn()
        try:
            user_id_int = int(user_id)
        except (TypeError, ValueError):
            user_id_int = user_id

        conn = get_db()
        cur = conn.cursor()

        inventory = _fetch_inventory_map(conn, [item['item_id'] for item in items])
        missing = [str(item['item_id']) for item in items if item['item_id'] not in inventory]
        if missing:
            return jsonify({'msg': f"Menu item(s) not found: {', '.join(missing)}"}), 404

        for item in items:
            stock = inventory[item['item_id']].get('qty_left')
            if stock is not None:
                try:
                    available = int(stock)
                except (TypeError, ValueError):
                    available = 0
                if available < item['qty']:
                    return jsonify({'msg': f"Not enough stock for {inventory[item['item_id']]['name']}"}), 409

        try:
            cur.execute('INSERT INTO orders (member_id, order_timestamp) VALUES (?, datetime("now"))', (user_id_int,))
            order_id = cur.lastrowid or 0
            if not order_id:
                raise ValueError('Failed to determine order id')
            cur.execute('INSERT OR REPLACE INTO order_items (order_id, items) VALUES (?, ?)', (order_id, json.dumps(items)))

            for item in items:
                stock = inventory[item['item_id']].get('qty_left')
                if stock is not None:
                    new_stock = max(0, int(stock) - item['qty'])
                    cur.execute('UPDATE menu_items SET qty_left=? WHERE id=?', (new_stock, item['item_id']))
            conn.commit()
        except Exception as exc:  # pragma: no cover - failure path
            conn.rollback()
            current_app.logger.exception('Failed to create order: %s', exc)
            return jsonify({'msg': 'Failed to create order'}), 500

        response = _build_order_response(conn, order_id)
        return jsonify(response), 201

    return inner()


@bp.route('/<int:order_id>/items', methods=['PATCH'])
def add_items(order_id: int):
    jwt_required_fn = jwt_required
    get_identity_fn = get_jwt_identity
    if not jwt_required_fn or not get_identity_fn:
        return jsonify({'msg': 'JWT extension not available'}), 501

    @jwt_required_fn()
    def inner(order_id: int):
        payload = request.get_json(silent=True) or {}
        try:
            additions = _normalize_items(payload.get('items'))
        except ValueError as exc:
            return jsonify({'msg': str(exc)}), 400

        user_id = get_identity_fn()
        try:
            user_id_int = int(user_id)
        except (TypeError, ValueError):
            user_id_int = user_id

        conn = get_db()
        cur = conn.cursor()

        cur.execute('SELECT member_id FROM orders WHERE id=?', (order_id,))
        owner_row = cur.fetchone()
        if not owner_row:
            return jsonify({'msg': 'Order not found'}), 404
        if owner_row['member_id'] != user_id_int:
            return jsonify({'msg': 'Forbidden'}), 403

        existing = _load_order_items(conn, order_id)
        merged = _merge_items(existing, additions)

        inventory = _fetch_inventory_map(conn, [item['item_id'] for item in additions])
        missing = [str(item['item_id']) for item in additions if item['item_id'] not in inventory]
        if missing:
            return jsonify({'msg': f"Menu item(s) not found: {', '.join(missing)}"}), 404

        for item in additions:
            stock = inventory[item['item_id']].get('qty_left')
            if stock is not None:
                try:
                    available = int(stock)
                except (TypeError, ValueError):
                    available = 0
                if available < item['qty']:
                    return jsonify({'msg': f"Not enough stock for {inventory[item['item_id']]['name']}"}), 409

        try:
            cur.execute('UPDATE orders SET order_timestamp=datetime("now") WHERE id=?', (order_id,))
            _write_order_items(conn, order_id, merged)
            for item in additions:
                stock = inventory[item['item_id']].get('qty_left')
                if stock is not None:
                    new_stock = max(0, int(stock) - item['qty'])
                    cur.execute('UPDATE menu_items SET qty_left=? WHERE id=?', (new_stock, item['item_id']))
            conn.commit()
        except Exception as exc:  # pragma: no cover - failure path
            conn.rollback()
            current_app.logger.exception('Failed to update order %s: %s', order_id, exc)
            return jsonify({'msg': 'Failed to update order'}), 500

        response = _build_order_response(conn, order_id)
        return jsonify(response), 200

    return inner(order_id)


@bp.route('/<int:order_id>/items/<int:item_id>', methods=['PATCH'])
def update_item(order_id: int, item_id: int):
    jwt_required_fn = jwt_required
    get_identity_fn = get_jwt_identity
    if not jwt_required_fn or not get_identity_fn:
        return jsonify({'msg': 'JWT extension not available'}), 501

    @jwt_required_fn()
    def inner(order_id: int, item_id: int):
        payload = request.get_json(silent=True) or {}
        operation = (payload.get('operation') or 'set').lower()
        if operation not in {'set', 'increment', 'decrement'}:
            return jsonify({'msg': 'operation must be one of set, increment, decrement'}), 400

        try:
            qty_input = payload.get('qty', 1)
            step = int(qty_input)
        except (TypeError, ValueError):
            return jsonify({'msg': 'qty must be an integer'}), 400

        if operation in {'increment', 'decrement'} and step <= 0:
            step = 1
        if operation == 'set' and step < 0:
            return jsonify({'msg': 'qty must be zero or positive for set operation'}), 400

        user_id = get_identity_fn()
        try:
            user_id_int = int(user_id)
        except (TypeError, ValueError):
            user_id_int = user_id

        conn = get_db()
        cur = conn.cursor()

        cur.execute('SELECT member_id FROM orders WHERE id=?', (order_id,))
        owner_row = cur.fetchone()
        if not owner_row:
            return jsonify({'msg': 'Order not found'}), 404
        if owner_row['member_id'] != user_id_int:
            return jsonify({'msg': 'Forbidden'}), 403

        existing = _load_order_items(conn, order_id)
        current_qty = 0
        for entry in existing:
            if entry['item_id'] == item_id:
                current_qty = entry['qty']
                break

        if operation == 'decrement' and current_qty == 0:
            return jsonify({'msg': 'Item is not in the order'}), 409

        if operation == 'increment':
            delta = step
            new_qty = current_qty + delta
        elif operation == 'decrement':
            if step > current_qty:
                delta = -current_qty
                new_qty = 0
            else:
                delta = -step
                new_qty = current_qty + delta
        else:  # set
            delta = step - current_qty
            new_qty = step

        if new_qty < 0:
            return jsonify({'msg': 'Resulting quantity cannot be negative'}), 400
        if delta == 0:
            response = _build_order_response(conn, order_id)
            return jsonify(response), 200

        inventory = _fetch_inventory_map(conn, [item_id])
        info = inventory.get(item_id)
        if not info:
            return jsonify({'msg': 'Menu item not found'}), 404

        stock_val = info.get('qty_left')
        if delta > 0 and stock_val is not None:
            try:
                available = int(stock_val)
            except (TypeError, ValueError):
                available = 0
            if available < delta:
                return jsonify({'msg': f"Not enough stock for {info.get('name')}"}), 409

        try:
            updated_items: List[Dict[str, int]] = []
            replaced = False
            for entry in existing:
                if entry['item_id'] == item_id:
                    if new_qty > 0:
                        updated_items.append({'item_id': item_id, 'qty': new_qty})
                        replaced = True
                else:
                    updated_items.append(entry)
            if not replaced and new_qty > 0:
                updated_items.append({'item_id': item_id, 'qty': new_qty})

            if stock_val is not None:
                try:
                    current_stock = int(stock_val)
                except (TypeError, ValueError):
                    current_stock = 0
                new_stock = current_stock - delta
                cur.execute('UPDATE menu_items SET qty_left=? WHERE id=?', (new_stock, item_id))

            if updated_items:
                _write_order_items(conn, order_id, updated_items)
                cur.execute('UPDATE orders SET order_timestamp=datetime("now") WHERE id=?', (order_id,))
                conn.commit()
                response = _build_order_response(conn, order_id)
                return jsonify(response), 200

            _write_order_items(conn, order_id, [])
            cur.execute('DELETE FROM orders WHERE id=?', (order_id,))
            conn.commit()
            response = _build_order_response(conn, order_id, order_closed=True)
            return jsonify(response), 200
        except Exception as exc:  # pragma: no cover - failure path
            conn.rollback()
            current_app.logger.exception('Failed to update order item %s on order %s: %s', item_id, order_id, exc)
            return jsonify({'msg': 'Failed to update order item'}), 500

    return inner(order_id, item_id)


@bp.route('/<int:order_id>/submit', methods=['POST'])
def submit_order(order_id: int):
    jwt_required_fn = jwt_required
    get_identity_fn = get_jwt_identity
    if not jwt_required_fn or not get_identity_fn:
        return jsonify({'msg': 'JWT extension not available'}), 501

    @jwt_required_fn()
    def inner(order_id: int):
        user_id = get_identity_fn()
        try:
            user_id_int = int(user_id)
        except (TypeError, ValueError):
            user_id_int = user_id

        conn = get_db()
        cur = conn.cursor()
        cur.execute('SELECT member_id FROM orders WHERE id=?', (order_id,))
        row = cur.fetchone()
        if not row:
            return jsonify({'msg': 'Order not found'}), 404
        if row['member_id'] != user_id_int:
            return jsonify({'msg': 'Forbidden'}), 403

        items = _load_order_items(conn, order_id)
        if not items:
            return jsonify({'msg': 'Cannot submit an empty order'}), 400

        try:
            cur.execute('UPDATE orders SET order_timestamp=datetime("now") WHERE id=?', (order_id,))
            conn.commit()
        except Exception as exc:  # pragma: no cover - failure path
            conn.rollback()
            current_app.logger.exception('Failed to submit order %s: %s', order_id, exc)
            return jsonify({'msg': 'Failed to submit order'}), 500

        response = _build_order_response(conn, order_id, order_closed=True)
        response['status'] = 'submitted'
        response['msg'] = 'Order submitted successfully'
        return jsonify(response), 200

    return inner(order_id)


@bp.route('/<int:order_id>', methods=['GET'])
def get_order(order_id: int):
    jwt_required_fn = jwt_required
    get_identity_fn = get_jwt_identity
    if not jwt_required_fn or not get_identity_fn:
        return jsonify({'msg': 'JWT extension not available'}), 501

    @jwt_required_fn()
    def inner(order_id: int):
        user_id = get_identity_fn()
        try:
            user_id_int = int(user_id)
        except (TypeError, ValueError):
            user_id_int = user_id

        conn = get_db()
        cur = conn.cursor()
        cur.execute('SELECT member_id FROM orders WHERE id=?', (order_id,))
        row = cur.fetchone()
        if not row:
            return jsonify({'msg': 'Order not found'}), 404
        if row['member_id'] != user_id_int:
            return jsonify({'msg': 'Forbidden'}), 403

        response = _build_order_response(conn, order_id)
        return jsonify(response), 200

    return inner(order_id)
