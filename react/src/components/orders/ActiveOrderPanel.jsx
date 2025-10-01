import {
  FiMinus,
  FiPlus,
  FiShoppingBag,
  FiSend,
} from 'react-icons/fi';
import { formatPrice } from '../../utils/formatters';

const ActiveOrderPanel = ({
  loading,
  items,
  totalQuantity,
  subtotal,
  saving,
  submitting,
  pendingItemId,
  onIncrement,
  onDecrement,
  onSubmit,
  showEmptyState = false,
  includeBrowseCta = false,
  onBrowse,
}) => {
  if (loading) {
    return (
      <section className="rounded-3xl border border-[rgba(15,23,42,0.08)] bg-[var(--app-surface)] p-6 shadow-sm">
        <p className="text-sm text-[var(--app-muted)]">We're loading your active order…</p>
      </section>
    );
  }

  if (!totalQuantity) {
    if (!showEmptyState) return null;

    return (
      <section className="rounded-3xl border border-dashed border-[rgba(15,23,42,0.12)] bg-[var(--app-surface)] p-6 text-center shadow-sm">
        <h2 className="text-lg font-semibold text-[var(--app-text)]">You're all set!</h2>
        <p className="mt-2 text-sm text-[var(--app-muted)]">
          You haven't added any dishes yet. Browse the menu to start building your order.
        </p>
        {includeBrowseCta ? (
          <div className="mt-4">
            <button
              type="button"
              onClick={onBrowse}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--app-primary)] px-5 py-2 text-sm font-semibold text-[var(--app-primary-contrast)] transition hover:opacity-90"
            >
              <FiShoppingBag className="text-sm" /> Browse the menu
            </button>
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-[rgba(15,23,42,0.08)] bg-[var(--app-surface)] p-6 shadow-sm">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--app-text)]">Active Order</h2>
          <span className="text-sm text-[var(--app-muted)]">{totalQuantity} item{totalQuantity > 1 ? 's' : ''}</span>
        </div>
        <ul className="space-y-3">
          {items.map((entry) => {
            const entryQty = Number(entry.quantity) || 0;
            const stockRemaining = typeof entry.qty_left === 'number' ? entry.qty_left : null;
            const isPending = saving && pendingItemId === entry.id;
            const disableDecrement = saving || submitting || entryQty <= 0;
            const disableIncrement = saving || submitting || (stockRemaining !== null && stockRemaining <= 0);

            return (
              <li
                key={entry.id}
                className="flex flex-col gap-2 rounded-2xl bg-[rgba(15,23,42,0.02)] p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex-1">
                  <p className="font-medium text-[var(--app-text)]">{entry.name}</p>
                  <p className="text-xs text-[var(--app-muted)]">{formatPrice(entry.price)} each</p>
                  {stockRemaining !== null ? (
                    <p className="text-xs text-[var(--app-muted)]">
                      {stockRemaining > 0 ? `${stockRemaining} left in stock` : 'No more available'}
                    </p>
                  ) : null}
                  {isPending ? <p className="text-xs text-[var(--app-muted)]">Saving…</p> : null}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onDecrement(entry.id)}
                    disabled={disableDecrement || entryQty <= 0}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(15,23,42,0.12)] bg-[var(--app-surface)] text-[var(--app-text)] transition disabled:cursor-not-allowed disabled:opacity-50 hover:border-[var(--app-primary)]"
                    aria-label={`Remove one ${entry.name}`}
                  >
                    <FiMinus />
                  </button>
                  <span className="inline-flex w-8 justify-center text-sm font-semibold text-[var(--app-text)]">{entryQty}</span>
                  <button
                    type="button"
                    onClick={() => onIncrement(entry.id)}
                    disabled={disableIncrement}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(15,23,42,0.12)] bg-[var(--app-primary)] text-[var(--app-primary-contrast)] transition disabled:cursor-not-allowed disabled:opacity-50 hover:opacity-90"
                    aria-label={`Add one more ${entry.name}`}
                  >
                    <FiPlus />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center justify-between border-t border-[rgba(15,23,42,0.08)] pt-3 text-sm text-[var(--app-text)]">
          <span className="font-semibold">Subtotal</span>
          <span className="font-semibold">{formatPrice(subtotal)}</span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
          {includeBrowseCta ? (
            <button
              type="button"
              onClick={onBrowse}
              className="inline-flex items-center gap-2 rounded-full border border-[rgba(15,23,42,0.12)] bg-[var(--app-surface)] px-4 py-2 text-sm font-semibold text-[var(--app-text)] transition hover:border-[var(--app-primary)]"
            >
              <FiShoppingBag className="text-sm" /> Add more items
            </button>
          ) : null}
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting || saving || !items.length}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--app-primary)] px-5 py-2 text-sm font-semibold text-[var(--app-primary-contrast)] transition disabled:cursor-not-allowed disabled:opacity-60 hover:opacity-90"
          >
            <FiSend className="text-sm" />
            {submitting ? 'Submitting…' : 'Submit Order'}
          </button>
        </div>
      </div>
    </section>
  );
};

export default ActiveOrderPanel;
