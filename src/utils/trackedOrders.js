const TRACKED_ORDERS_KEY = 'tvx_orders';
const LAST_ORDER_KEY = 'tvx_last_order';
const ORDER_RETENTION_MS = 2 * 24 * 60 * 60 * 1000;

function isRecent(order, now = Date.now()) {
  return Number.isFinite(order?.at) && now - order.at <= ORDER_RETENTION_MS;
}

export function getTrackedOrders() {
  try {
    const stored = JSON.parse(localStorage.getItem(TRACKED_ORDERS_KEY) || '[]');
    let orders = Array.isArray(stored)
      ? stored.filter((order) => typeof order?.code === 'string' && order.code.trim())
      : [];
    orders = orders.filter(isRecent);

    const previous = JSON.parse(localStorage.getItem(LAST_ORDER_KEY) || '{}');
    const legacyOrder = { ...previous, at: previous.at || Date.now() };
    if (
      !orders.length &&
      typeof legacyOrder.code === 'string' &&
      legacyOrder.code.trim() &&
      isRecent(legacyOrder)
    ) {
      orders = [{ code: legacyOrder.code.trim(), at: legacyOrder.at }];
    }

    localStorage.setItem(TRACKED_ORDERS_KEY, JSON.stringify(orders));
    if (!orders.some(({ code }) => code === previous.code)) {
      localStorage.removeItem(LAST_ORDER_KEY);
    }
    return orders;
  } catch {
    return [];
  }
}

export function removeTrackedOrders(codes) {
  const removed = new Set(codes);
  if (!removed.size) return;
  try {
    const orders = getTrackedOrders().filter(({ code }) => !removed.has(code));
    localStorage.setItem(TRACKED_ORDERS_KEY, JSON.stringify(orders));
    const previous = JSON.parse(localStorage.getItem(LAST_ORDER_KEY) || '{}');
    if (removed.has(previous.code)) localStorage.removeItem(LAST_ORDER_KEY);
  } catch {
    // The order list can still omit expired entries if browser storage is unavailable.
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
