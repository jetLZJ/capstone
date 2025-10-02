from flask import Blueprint, jsonify, request  # type: ignore
from utils import get_db
import json
from datetime import datetime, timedelta, date
from typing import Dict, Tuple

try:
    from .permissions import require_roles
except Exception:  # pragma: no cover
    from permissions import require_roles

bp = Blueprint('analytics', __name__)


def _resolve_timeframe(raw_value: str) -> Tuple[str, date, date]:
    normalized = (raw_value or 'this_week').lower()
    today = datetime.utcnow().date()
    start_of_week = today - timedelta(days=today.weekday())

    if normalized == 'last_week':
        start = start_of_week - timedelta(days=7)
        end = start_of_week - timedelta(days=1)
    elif normalized == 'last_30':
        start = today - timedelta(days=29)
        end = today
    else:
        normalized = 'this_week'
        start = start_of_week
        end = start_of_week + timedelta(days=6)

    return normalized, start, end


def _compute_metrics(cur, menu_prices: Dict[int, float], menu_names: Dict[int, str], start_date: date, end_date: date) -> Dict[str, object]:
    start_dt = datetime.combine(start_date, datetime.min.time())
    end_dt = datetime.combine(end_date + timedelta(days=1), datetime.min.time())
    start_str = start_dt.strftime('%Y-%m-%d %H:%M:%S')
    end_str = end_dt.strftime('%Y-%m-%d %H:%M:%S')

    cur.execute('SELECT id, order_timestamp FROM orders WHERE order_timestamp >= ? AND order_timestamp < ?', (start_str, end_str))
    order_rows = cur.fetchall()
    order_ids = []
    order_dates: Dict[int, date] = {}
    for order_id, ts in order_rows:
        order_ids.append(order_id)
        parsed_dt = None
        if isinstance(ts, datetime):
            parsed_dt = ts
        elif isinstance(ts, str):
            try:
                parsed_dt = datetime.fromisoformat(ts)
            except ValueError:
                for fmt in ('%Y-%m-%d %H:%M:%S.%f', '%Y-%m-%d %H:%M:%S', '%Y-%m-%d', '%m/%d/%Y %H:%M:%S'):
                    try:
                        parsed_dt = datetime.strptime(ts, fmt)
                        break
                    except ValueError:
                        continue
        if parsed_dt is not None:
            order_dates[order_id] = parsed_dt.date()

    total_orders = len(order_ids)

    total_revenue = 0.0
    item_counts: Dict[int, int] = {}
    daily_revenue: Dict[str, float] = {}
    daily_orders: Dict[str, int] = {}

    for order_day in order_dates.values():
        day_key = order_day.isoformat()
        daily_orders[day_key] = daily_orders.get(day_key, 0) + 1

    if order_ids:
        placeholders = ','.join('?' for _ in order_ids)
        cur.execute(f'SELECT order_id, items FROM order_items WHERE order_id IN ({placeholders})', order_ids)
        for order_id, items_json in cur.fetchall():
            try:
                parsed = json.loads(items_json)
            except Exception:
                continue
            order_revenue = 0.0
            day_key = None
            order_day = order_dates.get(order_id)
            if order_day is not None:
                day_key = order_day.isoformat()
            for entry in parsed or []:
                item_id = entry.get('item_id')
                qty = entry.get('qty') or 0
                if not item_id:
                    continue
                price = menu_prices.get(item_id, 0.0)
                line_revenue = price * qty
                total_revenue += line_revenue
                order_revenue += line_revenue
                item_counts[item_id] = item_counts.get(item_id, 0) + qty
            if day_key is not None:
                daily_revenue[day_key] = daily_revenue.get(day_key, 0.0) + order_revenue

    average_order_value = total_revenue / total_orders if total_orders else 0.0

    total_days = (end_date - start_date).days + 1
    daily_trend = []
    for offset in range(total_days):
        current_day = start_date + timedelta(days=offset)
        day_key = current_day.isoformat()
        daily_trend.append(
            {
                'date': day_key,
                'revenue': round(daily_revenue.get(day_key, 0.0), 2),
                'orders': daily_orders.get(day_key, 0),
            }
        )

    top_selling = [
        {
            'id': item_id,
            'name': menu_names.get(item_id, 'Unknown Item'),
            'count': count,
        }
        for item_id, count in sorted(item_counts.items(), key=lambda x: -x[1])[:5]
    ]

    start_date_str = start_date.strftime('%Y-%m-%d')
    end_date_str = end_date.strftime('%Y-%m-%d')
    cur.execute(
        'SELECT assigned_user, COUNT(id) FROM shift_assignments WHERE shift_date BETWEEN ? AND ? GROUP BY assigned_user',
        (start_date_str, end_date_str),
    )
    staff_utilization = [
        {'user_id': row[0], 'assignments': row[1]}
        for row in cur.fetchall()
        if row[0] is not None or row[1]
    ]

    return {
        'total_orders': total_orders,
        'total_revenue': round(total_revenue, 2),
        'average_order_value': round(average_order_value, 2),
        'daily_trend': daily_trend,
        'top_selling': top_selling,
        'staff_utilization': staff_utilization,
    }


@bp.route('/summary', methods=['GET'])
@require_roles('Manager')
def summary():
    conn = get_db()
    cur = conn.cursor()

    timeframe_param = request.args.get('timeframe', 'this_week')
    timeframe, start_date, end_date = _resolve_timeframe(timeframe_param)

    cur.execute('SELECT r.name, COUNT(u.id) FROM roles r LEFT JOIN users u ON u.role_id=r.id GROUP BY r.id')
    users_by_role = {row[0]: row[1] for row in cur.fetchall()}

    cur.execute('SELECT id, name, price FROM menu_items')
    menu_rows = cur.fetchall()
    menu_prices = {row[0]: row[2] or 0.0 for row in menu_rows}
    menu_names = {row[0]: row[1] for row in menu_rows}

    metrics = _compute_metrics(cur, menu_prices, menu_names, start_date, end_date)

    comparison = None
    if timeframe == 'this_week':
        comparison_target = 'last_week'
    elif timeframe == 'last_week':
        comparison_target = 'this_week'
    else:
        comparison_target = None

    if comparison_target:
        normalized, comp_start, comp_end = _resolve_timeframe(comparison_target)
        comparison_metrics = _compute_metrics(cur, menu_prices, menu_names, comp_start, comp_end)
        comparison = {
            'timeframe': normalized,
            'label': 'vs last week' if normalized == 'last_week' else 'vs this week',
            'total_orders': comparison_metrics['total_orders'],
            'total_revenue': comparison_metrics['total_revenue'],
            'average_order_value': comparison_metrics['average_order_value'],
        }

    response = {
        'users_by_role': users_by_role,
        'timeframe': timeframe,
        'timeframe_range': {
            'start': start_date.isoformat(),
            'end': end_date.isoformat(),
        },
        'total_orders': metrics['total_orders'],
        'total_revenue': metrics['total_revenue'],
        'average_order_value': metrics['average_order_value'],
        'daily_trend': metrics['daily_trend'],
        'top_selling': metrics['top_selling'],
        'staff_utilization': metrics['staff_utilization'],
        'customer_satisfaction': 4.7,
        'customer_satisfaction_previous': None,
    }

    if comparison:
        response['comparison'] = comparison

    return jsonify(response)
