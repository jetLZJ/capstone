export const getOrderTotals = (order) => {
  if (!order || typeof order !== 'object') {
    return { quantity: 0, total: 0 };
  }
  const items = Array.isArray(order.items) ? order.items : [];
  return items.reduce(
    (acc, entry) => {
      const qty = Number(entry?.qty ?? entry?.quantity) || 0;
      const price = Number(entry?.price) || 0;
      return {
        quantity: acc.quantity + qty,
        total: acc.total + qty * price,
      };
    },
    { quantity: 0, total: 0 },
  );
};

export const formatOrderDate = (timestamp) => {
  if (!timestamp) return 'Pending';
  try {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return String(timestamp);
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  } catch (err) {
    console.warn('Failed to format order date', err);
    return String(timestamp);
  }
};
