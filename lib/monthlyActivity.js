/**
 * Actividad mensual del socio (mes calendario actual).
 * Activo si: compras >= 360 Bs en el mes O afiliación CLASS/VIP en el mes.
 */

const {
  countProductsInRecord,
  recordInMonthScope,
  calendarMonthKey,
  startOfCalendarMonth,
  endOfCalendarMonth,
} = require("./productTotals");

const MIN_ACTIVE_PURCHASE_BS = 360;

function startOfMonth(date) {
  const d = date || new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(date) {
  const d = date || new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

function isDateInMonth(value, referenceDate) {
  if (!value) return false;
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return false;
  return d >= startOfMonth(referenceDate) && d <= endOfMonth(referenceDate);
}

function isClassOrEmpresarioPlan(planRef) {
  if (!planRef) return false;
  const id = String(planRef.id != null ? planRef.id : planRef)
    .trim()
    .toLowerCase();
  const name = String(planRef.name || "").toLowerCase();
  const amount = Number(planRef.amount);

  if (
    id === "class" ||
    id === "basic" ||
    id === "business" ||
    /class|ejecutivo|emprendedor/.test(name) ||
    (amount > 0 && amount <= 480)
  ) {
    return true;
  }

  if (
    id === "standard" ||
    id === "master" ||
    id === "empresario" ||
    /vip|distribuidor|empresario/.test(name) ||
    amount >= 500
  ) {
    return true;
  }

  return false;
}

function buildMonthScope(referenceDate = new Date()) {
  const ref = referenceDate || new Date();
  return {
    start: startOfCalendarMonth(ref),
    end: endOfCalendarMonth(ref),
    periodKeys: [calendarMonthKey(ref)],
  };
}

function recordUserId(record) {
  if (!record) return null;
  if (record.userId != null) return record.userId;
  if (record.user_id != null) return record.user_id;
  return null;
}

function isApprovedRecord(record) {
  return !record?.status || record.status === "approved";
}

function filterRecordsInMonth(records, referenceDate) {
  const scope = buildMonthScope(referenceDate);
  return (records || []).filter((record) => {
    if (!isApprovedRecord(record)) return false;
    return recordInMonthScope(record, scope);
  });
}

function sumRecordProductsInMonth(records, referenceDate) {
  const scope = buildMonthScope(referenceDate);
  let total = 0;
  for (const record of records || []) {
    if (!isApprovedRecord(record)) continue;
    if (!recordInMonthScope(record, scope)) continue;
    total += countProductsInRecord(record);
  }
  return total;
}

function sumActivationPrice(activations) {
  return (activations || []).reduce(
    (sum, a) => sum + (Number(a.price) || 0),
    0
  );
}

function filterActivationsInMonth(activations, referenceDate) {
  return filterRecordsInMonth(activations, referenceDate);
}

function sameUserId(a, b) {
  if (a == null || b == null) return false;
  return String(a) === String(b);
}

function isUserInList(userIds, userId) {
  return (userIds || []).some((id) => sameUserId(id, userId));
}

function buildTreeMap(allTree) {
  const treeMap = {};
  for (const n of allTree || []) {
    if (n && n.id != null) treeMap[String(n.id)] = n;
  }
  return treeMap;
}

function collectDescendantUserIds(treeMap, rootId) {
  const ids = [];

  function walk(id) {
    const node = treeMap[String(id)];
    if (!node || !Array.isArray(node.childs)) return;
    node.childs.forEach((childId) => {
      ids.push(childId);
      walk(childId);
    });
  }

  walk(rootId);
  return ids;
}

function hasClassOrEmpresarioAffiliationThisMonth(
  user,
  affiliations,
  referenceDate
) {
  if (user && user.affiliation_date && isClassOrEmpresarioPlan({ id: user.plan })) {
    if (isDateInMonth(user.affiliation_date, referenceDate)) return true;
  }

  const scope = buildMonthScope(referenceDate);
  return (affiliations || []).some((aff) => {
    if (!isApprovedRecord(aff)) return false;
    if (!isClassOrEmpresarioPlan(aff.plan)) return false;
    return recordInMonthScope(aff, scope);
  });
}

/**
 * @param {object} user
 * @param {Array} allTree - nodos tree
 * @param {Array} networkAffiliations - afiliaciones del usuario y la red
 * @param {Array} activations - activaciones (red + personal), ya filtradas por query o todas
 */
function computeMonthlyActivity(
  user,
  allTree,
  networkAffiliations,
  activations,
  referenceDate = new Date()
) {
  const treeMap = buildTreeMap(allTree);

  const networkIds = collectDescendantUserIds(treeMap, user.id);
  const allNetworkUserIds = [user.id, ...networkIds];

  const networkActivations = (activations || []).filter((a) =>
    isUserInList(allNetworkUserIds, recordUserId(a))
  );
  const monthActivations = filterActivationsInMonth(networkActivations, referenceDate);

  const personalActivations = monthActivations.filter((a) =>
    sameUserId(recordUserId(a), user.id)
  );

  const networkAffiliationsFiltered = (networkAffiliations || []).filter((a) =>
    isUserInList(allNetworkUserIds, recordUserId(a))
  );

  const personalAffiliations = networkAffiliationsFiltered.filter((a) =>
    sameUserId(recordUserId(a), user.id)
  );

  const monthlyPurchaseBs = sumActivationPrice(personalActivations);

  const personalProductCount =
    sumRecordProductsInMonth(personalActivations, referenceDate) +
    sumRecordProductsInMonth(personalAffiliations, referenceDate);

  const groupProductCount =
    sumRecordProductsInMonth(monthActivations, referenceDate) +
    sumRecordProductsInMonth(networkAffiliationsFiltered, referenceDate);

  const affiliatedThisMonth = hasClassOrEmpresarioAffiliationThisMonth(
    user,
    personalAffiliations,
    referenceDate
  );

  const monthlyActive =
    monthlyPurchaseBs >= MIN_ACTIVE_PURCHASE_BS || affiliatedThisMonth;

  return {
    monthlyPurchaseBs,
    personalProductCount,
    groupProductCount,
    monthlyActive,
    affiliatedThisMonth,
    minActivePurchaseBs: MIN_ACTIVE_PURCHASE_BS,
  };
}

function collectNetworkUserIds(userId, allTree) {
  const treeMap = buildTreeMap(allTree);
  return [userId, ...collectDescendantUserIds(treeMap, userId)];
}

module.exports = {
  MIN_ACTIVE_PURCHASE_BS,
  computeMonthlyActivity,
  isClassOrEmpresarioPlan,
  collectNetworkUserIds,
  buildTreeMap,
  buildMonthScope,
  filterRecordsInMonth,
};
