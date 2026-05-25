/**
 * Paquetes de afiliación Class Moringa: solo CLASS (480) y EMPRESARIO (500).
 * Si el socio ya tiene CLASS, solo puede ver/mejorar a EMPRESARIO.
 */

const CLASS_PLAN_IDS = new Set(["class", "basic", "standard", "business"]);
const EMPRESARIO_PLAN_IDS = new Set(["empresario", "master"]);

function normalizeId(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function planTierFromRef(ref) {
  if (!ref) return null;

  const id = normalizeId(ref.id != null ? ref.id : ref);
  const name = normalizeId(ref.name || "");
  const amount = Number(ref.amount);

  if (
    EMPRESARIO_PLAN_IDS.has(id) ||
    /empresario/.test(name) ||
    amount >= 500
  ) {
    return "empresario";
  }

  if (
    CLASS_PLAN_IDS.has(id) ||
    id === "business" ||
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
  const fromUser = findPlanInCatalog(plans, { id: user && user.plan });
  if (fromUser) return fromUser;

  if (affiliation && affiliation.plan) {
    const fromAff = findPlanInCatalog(plans, affiliation.plan);
    if (fromAff) return fromAff;
    return affiliation.plan;
  }

  if (affiliations && affiliations.length) {
    const last = affiliations[affiliations.length - 1];
    if (last && last.plan) {
      const fromHistory = findPlanInCatalog(plans, last.plan);
      if (fromHistory) return fromHistory;
      return last.plan;
    }
  }

  if (user && user.plan) return { id: user.plan };
  return null;
}

function resolveCurrentTier(user, affiliation, affiliations, plans) {
  const currentRef = resolveCurrentPlanRef(user, affiliation, affiliations, plans);
  let tier = planTierFromRef(currentRef);

  if (
    affiliation &&
    affiliation.status === "approved" &&
    affiliation.plan
  ) {
    const affTier = planTierFromRef(affiliation.plan);
    if (tierRank(affTier) > tierRank(tier)) tier = affTier;
  }

  if (!tier && isAffiliatedMember(user, affiliations)) {
    tier = "class";
  }

  return tier;
}

function resolveCurrentAmount(user, affiliation, affiliations, plans) {
  const currentRef = resolveCurrentPlanRef(user, affiliation, affiliations, plans);
  if (currentRef && currentRef.amount != null) {
    return Number(currentRef.amount);
  }

  const tier = resolveCurrentTier(user, affiliation, affiliations, plans);
  if (tier === "empresario") return 500;
  if (tier === "class") return 480;
  return null;
}

function filterAffiliationPlansForUser(plans, user, affiliation, affiliations) {
  const sorted = [...(plans || [])].sort(
    (a, b) => Number(a.amount) - Number(b.amount)
  );

  if (!isAffiliatedMember(user, affiliations)) return sorted;

  const currentTier = resolveCurrentTier(user, affiliation, affiliations, sorted);
  const currentAmount = resolveCurrentAmount(user, affiliation, affiliations, sorted);
  const currentRef = resolveCurrentPlanRef(user, affiliation, affiliations, sorted);
  const currentId = normalizeId((currentRef && currentRef.id) || (user && user.plan));

  if (currentTier === "empresario" || (currentAmount && currentAmount >= 500)) {
    return [];
  }

  return sorted.filter((p) => {
    const pId = normalizeId(p.id);
    const pAmount = Number(p.amount);
    const pTier = planTierFromRef(p);

    if (currentId && pId === currentId) return false;

    if (currentTier === "class") {
      return pTier === "empresario" || pAmount >= 500;
    }

    if (currentAmount != null && !isNaN(currentAmount)) {
      return pAmount > currentAmount;
    }

    return pTier === "empresario";
  });
}

module.exports = {
  planTierFromRef,
  filterAffiliationPlansForUser,
};
