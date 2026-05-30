/**
 * Renombra el plan master/empresario a VIP en la base de datos.
 * Uso: node serve/scripts/rename-empresario-plan-to-vip.js
 */
const db = require("../components/db");

const VIP_NAME = "VIP";

async function renamePlanDoc(plan) {
  if (!plan || !plan.id) return false;
  const id = String(plan.id).toLowerCase();
  if (id !== "master" && id !== "empresario") return false;
  if (plan.name === VIP_NAME) return false;
  await db.Plan.update({ id: plan.id }, { $set: { name: VIP_NAME } });
  return true;
}

async function renameAffiliationPlans(collection) {
  const items = await db.Affiliation.find({});
  let updated = 0;
  for (const item of items) {
    if (!item.plan || !item.plan.id) continue;
    const planId = String(item.plan.id).toLowerCase();
    if (planId !== "master" && planId !== "empresario") continue;
    const name = String(item.plan.name || "").trim();
    if (name === VIP_NAME) continue;
    await db.Affiliation.update(
      { id: item.id },
      { plan: { ...item.plan, name: VIP_NAME } }
    );
    updated++;
  }
  return updated;
}

async function main() {
  const plans = await db.Plan.find({});
  let plansUpdated = 0;
  for (const plan of plans) {
    if (await renamePlanDoc(plan)) plansUpdated++;
  }
  const affiliationsUpdated = await renameAffiliationPlans();
  console.log(
    `Listo: ${plansUpdated} plan(es) en catálogo y ${affiliationsUpdated} afiliación(es) actualizadas a "${VIP_NAME}".`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
