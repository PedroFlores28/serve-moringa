/**
 * Solo existen dos planes comerciales: CLASS y VIP.
 * IDs históricos (basic, standard) se muestran como CLASS / VIP.
 */

const CLASS_PLAN_IDS = new Set(["class", "basic", "business"]);
const VIP_PLAN_IDS = new Set(["master", "standard", "empresario"]);
const CLASS_DISPLAY_NAME = "CLASS";
const VIP_DISPLAY_NAME = "VIP";

function normalizeId(value) {
  return String(value || "").trim().toLowerCase();
}

function isLegacyEmpresarioName(name) {
  const n = String(name || "").trim().toLowerCase();
  return n === "empresario" || /empresario/.test(n);
}

function isLegacyEjecutivoName(name) {
  const n = String(name || "").trim().toLowerCase();
  return n === "ejecutivo" || /ejecutivo/.test(n) || n === "emprendedor";
}

function isLegacyDistribuidorName(name) {
  const n = String(name || "").trim().toLowerCase();
  return n === "distribuidor" || /distribuidor/.test(n);
}

function isVipPlan(ref) {
  if (!ref) return false;
  const id = normalizeId(ref.id != null ? ref.id : ref);
  const name = normalizeId(ref.name || "");
  return (
    VIP_PLAN_IDS.has(id) ||
    isLegacyEmpresarioName(ref.name) ||
    isLegacyDistribuidorName(ref.name) ||
    /vip/.test(name)
  );
}

function isClassPlan(ref) {
  if (!ref) return false;
  const id = normalizeId(ref.id != null ? ref.id : ref);
  return (
    CLASS_PLAN_IDS.has(id) ||
    isLegacyEjecutivoName(ref.name) ||
    /class/.test(normalizeId(ref.name || ""))
  );
}

function resolvePlanDisplayName(ref) {
  if (ref == null || ref === "") return "-";

  if (typeof ref === "string") {
    const id = normalizeId(ref);
    if (id === "basic" || CLASS_PLAN_IDS.has(id)) return CLASS_DISPLAY_NAME;
    if (id === "standard" || VIP_PLAN_IDS.has(id)) return VIP_DISPLAY_NAME;
    if (isLegacyEmpresarioName(ref) || isLegacyDistribuidorName(ref)) {
      return VIP_DISPLAY_NAME;
    }
    if (isLegacyEjecutivoName(ref)) return CLASS_DISPLAY_NAME;
    return ref;
  }

  const id = normalizeId(ref.id);
  const rawName = String(ref.name || "").trim();

  if (id === "basic" || CLASS_PLAN_IDS.has(id)) return CLASS_DISPLAY_NAME;
  if (id === "standard" || VIP_PLAN_IDS.has(id)) return VIP_DISPLAY_NAME;

  if (isLegacyEmpresarioName(rawName) || isLegacyDistribuidorName(rawName)) {
    return VIP_DISPLAY_NAME;
  }
  if (isLegacyEjecutivoName(rawName)) return CLASS_DISPLAY_NAME;

  if (rawName) return rawName;

  if (id) return id.charAt(0).toUpperCase() + id.slice(1);
  return "-";
}

function buildPlanNameById(plans) {
  const map = {
    basic: CLASS_DISPLAY_NAME,
    standard: VIP_DISPLAY_NAME,
    class: CLASS_DISPLAY_NAME,
    master: VIP_DISPLAY_NAME,
  };
  (plans || []).forEach((plan) => {
    if (plan && plan.id != null) {
      map[String(plan.id)] = resolvePlanDisplayName(plan);
    }
  });
  return map;
}

function withResolvedPlanName(record, planNameById) {
  if (!record || !record.plan || record.plan.id == null) return record;
  const id = String(record.plan.id);
  const fromCatalog = planNameById[id];
  const name = resolvePlanDisplayName({
    id: record.plan.id,
    name: fromCatalog || record.plan.name,
    amount: record.plan.amount,
  });
  return {
    ...record,
    plan: {
      ...record.plan,
      name,
    },
  };
}

function withResolvedPlanNames(records, planNameById) {
  return (records || []).map((record) =>
    withResolvedPlanName(record, planNameById)
  );
}

function normalizePlanList(plans) {
  return (plans || []).map((plan) => ({
    ...plan,
    name: resolvePlanDisplayName(plan),
  }));
}

module.exports = {
  CLASS_PLAN_IDS,
  VIP_PLAN_IDS,
  CLASS_DISPLAY_NAME,
  VIP_DISPLAY_NAME,
  isVipPlan,
  isClassPlan,
  resolvePlanDisplayName,
  buildPlanNameById,
  withResolvedPlanName,
  withResolvedPlanNames,
  normalizePlanList,
};
