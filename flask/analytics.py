from flask import Blueprint, jsonify
from utils import get_db
import json

bp = Blueprint('analytics', __name__)


@bp.route('/summary', methods=['GET'])
def summary():
    conn = get_db()
    cur = conn.cursor()
    # total users per role
    cur.execute('SELECT r.name, COUNT(u.id) FROM roles r LEFT JOIN users u ON u.role_id=r.id GROUP BY r.id')
    users_by_role = {row[0]: row[1] for row in cur.fetchall()}

    # total orders and revenue (approximate: sum of item price * qty from menu_items + order_items JSON)
    cur.execute('SELECT COUNT(id) FROM orders')
    total_orders = cur.fetchone()[0] or 0

    # calculate revenue by iterating orders -> order_items json
    cur.execute('SELECT items FROM order_items')
    rows = cur.fetchall()
    total_revenue = 0.0
    for (items_json,) in rows:
        try:
            items = json.loads(items_json)
            for it in items:
                cur.execute('SELECT price FROM menu_items WHERE id=?', (it.get('item_id'),))
                r = cur.fetchone()
                if r:
                    total_revenue += (r[0] or 0.0) * (it.get('qty') or 0)
        except Exception:
            continue

    # top selling items by count
    cur.execute('SELECT mi.id, mi.name FROM menu_items mi')
    items = cur.fetchall()
    sales = {}
    cur.execute('SELECT items FROM order_items')
    for (items_json,) in cur.fetchall():
        try:
            parsed = json.loads(items_json)
            for it in parsed:
                iid = it.get('item_id')
                qty = it.get('qty') or 0
                sales[iid] = sales.get(iid, 0) + qty
        except Exception:
            continue
    # map ids to names
    top = []
    for iid, cnt in sorted(sales.items(), key=lambda x: -x[1])[:5]:
        cur.execute('SELECT name FROM menu_items WHERE id=?', (iid,))
        r = cur.fetchone()
        top.append({'id': iid, 'name': (r[0] if r else 'unknown'), 'count': cnt})

    # staff utilization (assignments per user)
    cur.execute('SELECT assigned_user, COUNT(id) FROM shift_assignments GROUP BY assigned_user')
    util = [{'user_id': row[0], 'assignments': row[1]} for row in cur.fetchall()]

    return jsonify({
        'users_by_role': users_by_role,
        'total_orders': total_orders,
        'total_revenue': round(total_revenue, 2),
        'top_selling': top,
        'staff_utilization': util,
    })
