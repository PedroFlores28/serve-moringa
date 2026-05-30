/**
 * Total de unidades de producto en activaciones / afiliaciones.
 */

function addProductLine(sumRef, product) {
  if (!product || typeof product !== "object") return;
  const total = Number(product.total);
  if (!isNaN(total) && total > 0) {
    sumRef.n += total;
    return;
  }
  const qty = Number(
    product.qty != null ? product.qty : product.quantity != null ? product.quantity : 0
  );
  if (!isNaN(qty) && qty > 0) {
    sumRef.n += qty;
    return;
  }
  if (product.id != null || product.name) sumRef.n += 1;
}

function countProductsInRecord(record) {
  if (!record) return 0;
  const sumRef = { n: 0 };

  if (Array.isArray(record.products)) {
    for (const p of record.products) {
      if (p && Array.isArray(p.list)) {
        for (const sub of p.list) addProductLine(sumRef, sub);
      } else {
        addProductLine(sumRef, p);
      }
    }
  }

  if (record.plan && Array.isArray(record.plan.products)) {
    for (const group of record.plan.products) {
      if (!group || !Array.isArray(group.list)) continue;
      for (const sub of group.list) addProductLine(sumRef, sub);
    }
  }

  if (sumRef.n > 0) return sumRef.n;

  // Afiliación CLASS/VIP sin array `products` guardado: cupo del paquete (max_products / n)
  const plan = record.plan;
  if (plan) {
    const hasNoLines =
      !Array.isArray(record.products) || record.products.length === 0;
    const isAffiliation =
      record.type === "affiliation" ||
      record.type === "upgrade" ||
      (hasNoLines && plan.max_products != null);
    if (isAffiliation && hasNoLines) {
      const max =
        Number(plan.max_products) ||
        Number(plan.n) ||
        0;
      if (max > 0) return max;
    }
  }

  return sumRef.n;
}

function startOfCalendarMonth(ref) {
  const d = ref || new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function endOfCalendarMonth(ref) {
  const d = ref || new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

function calendarMonthKey(ref) {
  const d = ref || new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${m}`;
}

function recordInMonthScope(record, scope) {
  if (!record || !scope) return false;
  const when = record.approved_at || record.date;
  if (when) {
    const d = when instanceof Date ? when : new Date(when);
    if (!isNaN(d.getTime()) && d >= scope.start && d <= scope.end) {
      return true;
    }
  }
  if (scope.periodKeys && scope.periodKeys.length && record.period_key) {
    return scope.periodKeys.includes(String(record.period_key));
  }
  return false;
}

function sumProductsInMonthScope(records, scope) {
  let total = 0;
  for (const record of records || []) {
    if (!recordInMonthScope(record, scope)) continue;
    total += countProductsInRecord(record);
  }
  return total;
}

function userIdMatches(recordUserId, userId) {
  return String(recordUserId) === String(userId);
}

module.exports = {
  countProductsInRecord,
  startOfCalendarMonth,
  endOfCalendarMonth,
  calendarMonthKey,
  recordInMonthScope,
  sumProductsInMonthScope,
  userIdMatches,
};
