const TRACKED_ORDERS_KEY = 'tvx_orders';
const LAST_ORDER_KEY = 'tvx_last_order';

export function getTrackedOrders() {
  try {
    const stored = JSON.parse(localStorage.getItem(TRACKED_ORDERS_KEY) || '[]');
    const orders = Array.isArray(stored)
      ? stored.filter((order) => typeof order?.code === 'string' && order.code.trim())
      : [];

    if (orders.length) return orders;

    const previous = JSON.parse(localStorage.getItem(LAST_ORDER_KEY) || '{}');
    return typeof previous.code === 'string' && previous.code.trim()
      ? [{ code: previous.code.trim(), at: previous.at || Date.now() }]
      : [];
  } catch {
    return [];
  }
}

export function rememberOrder(code, at = Date.now()) {
  if (typeof code !== 'string' || !code.trim()) return;
  const normalizedCode = code.trim();
  const orders = getTrackedOrders();
  if (orders.some((order) => order.code === normalizedCode)) return;
  orders.push({ code: normalizedCode, at });

  try {
    localStorage.setItem(TRACKED_ORDERS_KEY, JSON.stringify(orders));
    localStorage.setItem(LAST_ORDER_KEY, JSON.stringify({ code: normalizedCode, at }));
  } catch {
    // The current tracking page still works if browser storage is unavailable.
  }
}
