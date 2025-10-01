import { FiClock, FiCheckCircle } from 'react-icons/fi';
import { formatPrice } from '../../utils/formatters';
import { getOrderTotals, formatOrderDate } from '../../utils/orderHelpers';

const OrderHistoryList = ({
  orders = [],
  loading,
  error,
  onRefresh,
  variant = 'full',
  emptyMessage,
}) => {
  if (loading) {
    return (
      <section className="rounded-3xl border border-[rgba(15,23,42,0.08)] bg-[var(--app-surface)] p-6 text-sm text-[var(--app-muted)] shadow-sm">
        Loading your past orders…
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-600 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>{error}</span>
          {onRefresh ? (
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--app-primary)] px-4 py-2 text-xs font-semibold text-[var(--app-primary-contrast)] transition hover:opacity-90"
            >
              Try again
            </button>
          ) : null}
        </div>
      </section>
    );
  }

  if (!orders.length) {
    return (
      <section className="rounded-3xl border border-dashed border-[rgba(15,23,42,0.15)] bg-[var(--app-bg)] p-8 text-center text-sm text-[var(--app-muted)]">
        {emptyMessage || 'You have not placed any orders yet.'}
      </section>
    );
  }

  return (
    <div className="space-y-4">
      {orders.map((order) => {
        const { quantity, total } = getOrderTotals(order);
        const items = Array.isArray(order?.items) ? order.items : [];
        const previewLimit = variant === 'compact' ? 2 : 4;
        const previewItems = items.slice(0, previewLimit);
        const remaining = Math.max(0, items.length - previewItems.length);
        const statusLabel = order?.status
          ? String(order.status)
          : order?.order_closed
            ? 'Submitted'
            : 'In progress';

        return (
          <article
            key={order.order_id}
            className="rounded-3xl border border-[rgba(15,23,42,0.08)] bg-[var(--app-surface)] p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-[var(--app-text)]">Order #{order.order_id}</p>
                <p className="text-xs text-[var(--app-muted)]">{formatOrderDate(order.order_timestamp)}</p>
              </div>
              <div className="text-right text-xs text-[var(--app-muted)]">
                <span className="inline-flex items-center gap-2 rounded-full bg-[rgba(15,23,42,0.05)] px-3 py-1 font-medium text-[var(--app-text)]">
                  {statusLabel}
                </span>
                <p className="mt-2 font-semibold text-[var(--app-text)]">{formatPrice(total)}</p>
                <p>{quantity} item{quantity === 1 ? '' : 's'}</p>
              </div>
            </div>
            <ul className="mt-4 space-y-2">
              {previewItems.map((entry) => (
                <li key={`${order.order_id}-${entry.item_id || entry.id}`} className="flex items-center justify-between text-sm text-[var(--app-muted)]">
                  <span>{entry.name}</span>
                  <span>{entry.qty ?? entry.quantity} × {formatPrice(entry.price)}</span>
                </li>
              ))}
              {remaining > 0 ? (
                <li className="text-xs text-[var(--app-muted)]">+{remaining} more item{remaining === 1 ? '' : 's'}</li>
              ) : null}
            </ul>
          </article>
        );
      })}
    </div>
  );
};

export default OrderHistoryList;
