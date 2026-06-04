/**
 * Actividad mensual del socio (mes calendario actual).
 * Activo si: compras >= 360 Bs en el mes O afiliación CLASS/VIP en el mes.
 */

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

function countProductsInActivation(activation) {
  const products = activation && activation.products;
  if (!Array.isArray(products)) return 0;
  return products.reduce((sum, p) => sum + (Number(p.total) || 0), 0);
}

function countProductsInAffiliation(affiliation) {
  if (!affiliation) return 0;

  if (affiliation.plan) {
    const id = String(affiliation.plan.id != null ? affiliation.plan.id : affiliation.plan)
      .trim()
      .toLowerCase();
    const name = String(affiliation.plan.name || "").toLowerCase();

    if (id === "class" || id === "basic" || id === "business" || /class|ejecutivo|emprendedor/.test(name)) {
      return 4;
    }

    if (id === "standard" || id === "master" || id === "empresario" || /vip|distribuidor|empresario/.test(name)) {
      return 2;
    }
  }

  const products = affiliation.products;
  if (!Array.isArray(products)) return 0;
  return products.reduce((sum, p) => sum + (Number(p.total) || 0), 0);
}

function sumAffiliationProductsInMonth(affiliations, referenceDate) {
  return (affiliations || [])
    .filter((aff) => {
      if (aff.status !== "approved") return false;
      const when = aff.approved_at || aff.date;
      return isDateInMonth(when, referenceDate);
    })
    .reduce((sum, aff) => sum + countProductsInAffiliation(aff), 0);
}

function sumActivationPrice(activations) {
  return (activations || []).reduce(
    (sum, a) => sum + (Number(a.price) || 0),
    0
  );
}

function sumActivationProducts(activations) {
  return (activations || []).reduce(
    (sum, a) => sum + countProductsInActivation(a),
    0
  );
}

function filterActivationsInMonth(activations, referenceDate) {
  return (activations || []).filter((a) => {
    if (a.status && a.status !== "approved") return false;
    const when = a.approved_at || a.date;
    return isDateInMonth(when, referenceDate);
  });
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

  return (affiliations || []).some((aff) => {
    if (aff.status !== "approved") return false;
    if (!isClassOrEmpresarioPlan(aff.plan)) return false;
    const when = aff.approved_at || aff.date;
    return isDateInMonth(when, referenceDate);
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

  const monthActivations = filterActivationsInMonth(
    (activations || []).filter((a) => isUserInList(allNetworkUserIds, a.userId)),
    referenceDate
  );

  const personalActivations = monthActivations.filter((a) =>
    sameUserId(a.userId, user.id)
  );

  const networkAffiliationsFiltered = (networkAffiliations || []).filter((a) =>
    isUserInList(allNetworkUserIds, a.userId)
  );

  const personalAffiliations = networkAffiliationsFiltered.filter((a) =>
    sameUserId(a.userId, user.id)
  );

  const monthlyPurchaseBs = sumActivationPrice(personalActivations);
  
  const personalProductCount =
    sumActivationProducts(personalActivations) +
    sumAffiliationProductsInMonth(personalAffiliations, referenceDate);
    
  const groupProductCount = 
    sumActivationProducts(monthActivations) +
    sumAffiliationProductsInMonth(networkAffiliationsFiltered, referenceDate);

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
};
