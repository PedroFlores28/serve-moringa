/**
 * Catálogo de planes: lectura desde Mongo y sincronización con productos.
 * La colección `plans` es la fuente de verdad (admin → Ver Planes).
 */

function normalizeId(value) {
  return String(value || "").trim().toLowerCase();
}

function slugifyId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function isAffiliationActive(plan) {
  return plan && plan.affiliation_active !== false;
}

function sortPlansByAmount(plans) {
  return [...(plans || [])].sort(
    (a, b) => Number(a.amount || 0) - Number(b.amount || 0)
  );
}

function getAffiliationPlans(plans) {
  return sortPlansByAmount((plans || []).filter(isAffiliationActive));
}

function maxAffiliationPlanAmount(plans) {
  const active = getAffiliationPlans(plans);
  if (!active.length) return null;
  return Number(active[active.length - 1].amount);
}

async function registerPlanOnProducts(Product, planId, enabledByDefault = false) {
  const products = await Product.find({});
  for (const product of products) {
    const plans = { ...(product.plans || {}) };
    if (plans[planId] === undefined) {
      plans[planId] = enabledByDefault;
      const prices = { ...(product.prices || {}) };
      if (prices[planId] === undefined) {
        prices[planId] = product.price != null ? product.price : "";
      }
      await Product.update(
        { id: product.id },
        { plans, prices }
      );
    }
  }
}

async function removePlanFromProducts(Product, planId) {
  const products = await Product.find({});
  for (const product of products) {
    if (!product.plans || product.plans[planId] === undefined) continue;
    const plans = { ...product.plans };
    delete plans[planId];
    const prices = { ...(product.prices || {}) };
    delete prices[planId];
    await Product.update({ id: product.id }, { plans, prices });
  }
}

module.exports = {
  normalizeId,
  slugifyId,
  isAffiliationActive,
  sortPlansByAmount,
  getAffiliationPlans,
  maxAffiliationPlanAmount,
  registerPlanOnProducts,
  removePlanFromProducts,
};
