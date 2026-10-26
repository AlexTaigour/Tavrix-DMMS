function normalize(value) {
  return String(value || '').trim().toLocaleLowerCase();
}

function getGroupKey(order) {
  return JSON.stringify([
    order.orderType || 'dine',
    order.table || '',
    normalize(order.name),
    normalize(order.phone),
    normalize(order.note),
  ]);
}

function aggregateItems(orders) {
  const items = new Map();
  for (const order of orders) {
    for (const item of order.items || []) {
      const key = `${item.menuItemId ?? normalize(item.name)}:${item.price}`;
      const existing = items.get(key);
      if (existing) existing.qty += item.qty;
      else items.set(key, { ...item });
    }
  }
  return [...items.values()];
}

export function groupPendingOrders(orders) {
  const groups = [];
  const pendingByKey = new Map();

  for (const order of orders) {
    if (order.status !== 'pending') {
      groups.push({ orders: [order], items: order.items || [], total: order.total });
      continue;
    }

    const key = getGroupKey(order);
    let group = pendingByKey.get(key);
    if (!group) {
      group = { orders: [], items: [], total: 0 };
      pendingByKey.set(key, group);
      groups.push(group);
    }
    group.orders.push(order);
    group.total += Number(order.total) || 0;
  }

  for (const group of groups) {
    group.orders.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const firstOrder = group.orders[0];
    Object.assign(group, firstOrder, {
      orders: group.orders,
      items: group.orders.length > 1 ? aggregateItems(group.orders) : firstOrder.items || [],
      total: group.orders.reduce((sum, order) => sum + (Number(order.total) || 0), 0),
    });
  }

  return groups;
}
