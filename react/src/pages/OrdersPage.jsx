import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ActiveOrderPanel from '../components/orders/ActiveOrderPanel';
import OrderHistoryList from '../components/orders/OrderHistoryList';
import useCustomerOrder from '../hooks/useCustomerOrder';
import useOrderHistory from '../hooks/useOrderHistory';

const OrdersPage = () => {
  const navigate = useNavigate();
  const {
    orderId,
    orderItems,
    orderLoading,
    orderSaving,
    orderSubmitting,
    pendingOrderItemId,
    totalOrderQuantity,
    orderSubtotal,
    handleIncrementOrderItem,
    handleDecrementOrderItem,
    handleSubmitOrder,
    refreshOrder,
  } = useCustomerOrder();

  const {
    orders: pastOrders,
    loading: pastOrdersLoading,
    error: pastOrdersError,
    refresh: refreshHistory,
  } = useOrderHistory();

  const filteredPastOrders = useMemo(() => {
    if (!Array.isArray(pastOrders)) return [];
    if (!orderId) return pastOrders;
    return pastOrders.filter((entry) => entry?.order_id !== orderId);
  }, [pastOrders, orderId]);

  const handleBrowseMenu = useCallback(() => {
    navigate('/menu');
  }, [navigate]);

  const handleSubmitOrderWithRefresh = useCallback(async () => {
    await handleSubmitOrder();
    await refreshOrder();
    await refreshHistory();
  }, [handleSubmitOrder, refreshOrder, refreshHistory]);

  return (
    <div className="min-h-full bg-[var(--app-bg)] py-10">
      <div className="mx-auto w-full max-w-5xl space-y-8 px-4 sm:px-6 lg:px-8">
        <header className="space-y-3">
          <h1 className="text-3xl font-semibold text-[var(--app-text)]">Track your order</h1>
          <p className="text-sm text-[var(--app-muted)]">
            Review your active cart, adjust quantities, and revisit previous submissions.
          </p>
        </header>

        <ActiveOrderPanel
          loading={orderLoading}
          items={orderItems}
          totalQuantity={totalOrderQuantity}
          subtotal={orderSubtotal}
          saving={orderSaving}
          submitting={orderSubmitting}
          pendingItemId={pendingOrderItemId}
          onIncrement={handleIncrementOrderItem}
          onDecrement={handleDecrementOrderItem}
          onSubmit={handleSubmitOrderWithRefresh}
          showEmptyState
          includeBrowseCta
          onBrowse={handleBrowseMenu}
        />

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-[var(--app-text)]">Past orders</h2>
            <button
              type="button"
              onClick={refreshHistory}
              className="inline-flex items-center gap-2 rounded-full border border-[rgba(15,23,42,0.12)] bg-[var(--app-surface)] px-4 py-2 text-xs font-semibold text-[var(--app-text)] transition hover:border-[var(--app-primary)]"
            >
              Refresh
            </button>
          </div>
          <OrderHistoryList
            orders={filteredPastOrders}
            loading={pastOrdersLoading}
            error={pastOrdersError}
            onRefresh={refreshHistory}
            emptyMessage="No previous orders yet. Once you submit an order it will appear here."
          />
        </section>
      </div>
    </div>
  );
};

export default OrdersPage;
