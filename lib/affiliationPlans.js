/**
 * Reglas de afiliación según el catálogo en BD (admin → Ver Planes).
 * Mejoras de plan: solo planes activos con monto mayor al actual.
 */

const {
  getAffiliationPlans,
  maxAffiliationPlanAmount,
  normalizeId,
} = require("./planCatalog");

const CLASS_PLAN_IDS = new Set(["class", "basic", "business"]);
const VIP_PLAN_IDS = new Set(["master", "standard", "empresario"]);

function planTierFromRef(ref, catalog) {
  if (!ref) return null;

  const active = getAffiliationPlans(catalog || []);
  const amount =
    Number(ref.amount) ||
    Number((findPlanInCatalog(active, ref) || {}).amount) ||
    0;

  if (active.length >= 2) {
    const min = Number(active[0].amount);
    const max = Number(active[active.length - 1].amount);
    if (amount >= max) return "empresario";
    if (amount <= min) return "class";
    return "mid";
  }

  const id = normalizeId(ref.id != null ? ref.id : ref);
  const name = normalizeId(ref.name || "");

  if (
    VIP_PLAN_IDS.has(id) ||
    /empresario|vip/.test(name) ||
    amount >= 500
  ) {
    return "empresario";
  }

  if (
    CLASS_PLAN_IDS.has(id) ||
    /class/.test(name) ||
    (amount > 0 && amount <= 480)
  ) {
    return "class";
  }

  return null;
}

function tierRank(tier) {
  if (tier === "empresario") return 2;
  if (tier === "class") return 1;
  if (tier === "mid") return 1.5;
  return 0;
}

function isTruthyAffiliated(value) {
  return value === true || value === 1 || value === "1" || value === "true";
}

function isAffiliatedMember(user, affiliations) {
  if (isTruthyAffiliated(user && user.affiliated)) return true;

  const planId = normalizeId(user && user.plan);
  if (planId && planId !== "none" && planId !== "default") return true;

  if (affiliations && affiliations.length > 0) return true;

  return false;
}

function findPlanInCatalog(plans, ref) {
  if (!ref || !plans || !plans.length) return null;

  const id = normalizeId(ref.id != null ? ref.id : ref);
  if (!id) return null;

  return plans.find((p) => normalizeId(p.id) === id) || null;
}

function resolveCurrentPlanRef(user, affiliation, affiliations, plans) {
  const catalog = getAffiliationPlans(plans);
  const fromUser = findPlanInCatalog(catalog, { id: user && user.plan });
  if (fromUser) return fromUser;

  if (affiliation && affiliation.plan) {
    const fromAff = findPlanInCatalog(catalog, affiliation.plan);
    if (fromAff) return fromAff;
    return affiliation.plan;
  }

  if (affiliations && affiliations.length) {
    const last = affiliations[affiliations.length - 1];
    if (last && last.plan) {
      const fromHistory = findPlanInCatalog(catalog, last.plan);
      if (fromHistory) return fromHistory;
      return last.plan;
    }
  }

  if (user && user.plan) return { id: user.plan };
  return null;
}

function resolveCurrentTier(user, affiliation, affiliations, plans) {
  const catalog = getAffiliationPlans(plans);
  const currentRef = resolveCurrentPlanRef(
    user,
    affiliation,
    affiliations,
    plans
  );
  let tier = planTierFromRef(currentRef, catalog);

  if (
    affiliation &&
    affiliation.status === "approved" &&
    affiliation.plan
  ) {
    const affTier = planTierFromRef(affiliation.plan, catalog);
    if (tierRank(affTier) > tierRank(tier)) tier = affTier;
  }

  if (!tier && isAffiliatedMember(user, affiliations)) {
    tier = "class";
  }

  return tier;
}

function resolveCurrentAmount(user, affiliation, affiliations, plans) {
  const catalog = getAffiliationPlans(plans);
  const currentRef = resolveCurrentPlanRef(
    user,
    affiliation,
    affiliations,
    plans
  );
  if (currentRef && currentRef.amount != null) {
    return Number(currentRef.amount);
  }

  const fromCatalog = findPlanInCatalog(catalog, currentRef);
  if (fromCatalog && fromCatalog.amount != null) {
    return Number(fromCatalog.amount);
  }

  const tier = resolveCurrentTier(user, affiliation, affiliations, plans);
  const amounts = catalog.map((p) => Number(p.amount)).filter((n) => !isNaN(n));
  if (amounts.length) {
    if (tier === "empresario") return Math.max(...amounts);
    if (tier === "class") return Math.min(...amounts);
  }

  if (tier === "empresario") return 500;
  if (tier === "class") return 480;
  return null;
}

function filterAffiliationPlansForUser(plans, user, affiliation, affiliations) {
  const sorted = getAffiliationPlans(plans);

  if (!isAffiliatedMember(user, affiliations)) return sorted;

  const currentRef = resolveCurrentPlanRef(
    user,
    affiliation,
    affiliations,
    plans
  );
  const currentAmount = resolveCurrentAmount(
    user,
    affiliation,
    affiliations,
    plans
  );
  const currentId = normalizeId(
    (currentRef && currentRef.id) || (user && user.plan)
  );
  const maxAmount = maxAffiliationPlanAmount(plans);

  if (
    maxAmount != null &&
    currentAmount != null &&
    !isNaN(currentAmount) &&
    currentAmount >= maxAmount
  ) {
    return [];
  }

  return sorted.filter((p) => {
    const pId = normalizeId(p.id);
    const pAmount = Number(p.amount);

    if (currentId && pId === currentId) return false;

    if (currentAmount != null && !isNaN(currentAmount)) {
      return pAmount > currentAmount;
    }

    const pTier = planTierFromRef(p, sorted);
    const currentTier = resolveCurrentTier(
      user,
      affiliation,
      affiliations,
      plans
    );
    if (currentTier === "class") {
      return pTier === "empresario" || tierRank(pTier) > tierRank("class");
    }

    return tierRank(pTier) > tierRank(currentTier);
  });
}

module.exports = {
  planTierFromRef,
  filterAffiliationPlansForUser,
  getAffiliationPlans,
};
