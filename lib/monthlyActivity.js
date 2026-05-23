/**
 * Actividad mensual del socio (mes calendario actual).
 * Activo si: compras >= 360 Bs en el mes O afiliación CLASS/EMPRESARIO en el mes.
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
    id === "empresario" ||
    id === "master" ||
    /empresario/.test(name) ||
    amount >= 500
  ) {
    return true;
  }

  if (
    id === "class" ||
    id === "basic" ||
    id === "standard" ||
    id === "business" ||
    /class/.test(name) ||
    (amount > 0 && amount <= 480)
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
  const products = affiliation && affiliation.products;
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

function collectDescendantUserIds(treeMap, rootId) {
  const ids = [];

  function walk(id) {
    const node = treeMap[id];
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
 * @param {Array} userAffiliations - afiliaciones del usuario
 * @param {Array} activations - activaciones (red + personal), ya filtradas por query o todas
 */
function computeMonthlyActivity(
  user,
  allTree,
  userAffiliations,
  activations,
  referenceDate = new Date()
) {
  const treeMap = (allTree || []).reduce((acc, n) => {
    acc[n.id] = n;
    return acc;
  }, {});

  const networkIds = collectDescendantUserIds(treeMap, user.id);
  const allNetworkUserIds = [user.id, ...networkIds];

  const monthActivations = filterActivationsInMonth(
    (activations || []).filter((a) =>
      allNetworkUserIds.includes(a.userId)
    ),
    referenceDate
  );

  const personalActivations = monthActivations.filter(
    (a) => a.userId === user.id
  );

  const monthlyPurchaseBs = sumActivationPrice(personalActivations);
  const personalProductCount =
    sumActivationProducts(personalActivations) +
    sumAffiliationProductsInMonth(userAffiliations, referenceDate);
  const groupProductCount = sumActivationProducts(monthActivations);

  const affiliatedThisMonth = hasClassOrEmpresarioAffiliationThisMonth(
    user,
    userAffiliations,
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

module.exports = {
  MIN_ACTIVE_PURCHASE_BS,
  computeMonthlyActivity,
  isClassOrEmpresarioPlan,
};
