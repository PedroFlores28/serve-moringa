/**
 * Elimina planes legacy EJECUTIVO (basic) y DISTRIBUIDOR (standard).
 * Uso: node scripts/remove-legacy-plans.js
 */
const db = require("../components/db");
const { removePlanFromProducts } = require("../lib/planCatalog");

const LEGACY_PLAN_IDS = ["basic", "standard"];

async function migrateUsersFromLegacy() {
  for (const legacyId of LEGACY_PLAN_IDS) {
    const users = await db.User.find({ plan: legacyId });
    for (const user of users) {
      await db.User.update({ id: user.id }, { plan: "class" });
      console.log(
        `[OK] Usuario ${user.id} migrado de "${legacyId}" → "class"`
      );
    }
  }
}

async function main() {
  await migrateUsersFromLegacy();

  for (const planId of LEGACY_PLAN_IDS) {
    const plan = await db.Plan.findOne({ id: planId });
    if (!plan) {
      console.log(`[SKIP] Plan "${planId}" no existe`);
      continue;
    }
    await removePlanFromProducts(db.Product, planId);
    await db.Plan.delete({ id: planId });
    console.log(`[OK] Plan eliminado: ${planId} (${plan.name})`);
  }

  const remaining = await db.Plan.find({});
  console.log(
    "\nPlanes restantes:",
    remaining.map((p) => `${p.id}: ${p.name}`).join(", ") || "(ninguno)"
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
