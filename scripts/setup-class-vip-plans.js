/**
 * Deja solo CLASS y VIP en el catálogo (elimina legacy).
 * Uso: node scripts/setup-class-vip-plans.js
 */
const db = require("../components/db");
const {
  registerPlanOnProducts,
  removePlanFromProducts,
} = require("../lib/planCatalog");

const CLASS = {
  id: "class",
  name: "CLASS",
  amount: 480,
  affiliation_points: 480,
  n: 4,
  max_products: 4,
  kit: 50,
  affiliation_active: true,
  img: "",
};

const VIP = {
  id: "master",
  name: "VIP",
  amount: 500,
  affiliation_points: 500,
  n: 2,
  max_products: 2,
  kit: 50,
  affiliation_active: true,
  img: "",
};

const LEGACY_PLAN_IDS = ["basic", "standard", "empresario", "business"];

async function upsertPlan(plan) {
  const existing = await db.Plan.findOne({ id: plan.id });
  if (existing) {
    await db.Plan.update({ id: plan.id }, { $set: plan });
    console.log(`[OK] Plan actualizado: ${plan.id} (${plan.name})`);
  } else {
    await db.Plan.insert(plan);
    await registerPlanOnProducts(db.Product, plan.id, false);
    console.log(`[OK] Plan creado: ${plan.id} (${plan.name})`);
  }
}

async function removeLegacyPlans() {
  for (const planId of LEGACY_PLAN_IDS) {
    const plan = await db.Plan.findOne({ id: planId });
    if (!plan) continue;
    await removePlanFromProducts(db.Product, planId);
    await db.Plan.delete({ id: planId });
    console.log(`[OK] Plan legacy eliminado: ${planId} (${plan.name})`);
  }
}

async function main() {
  await upsertPlan(CLASS);
  await upsertPlan(VIP);
  await removeLegacyPlans();
  console.log("\nListo. Solo CLASS y VIP en Ver Planes.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
