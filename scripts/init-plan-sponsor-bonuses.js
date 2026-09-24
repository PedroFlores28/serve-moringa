/**
 * Migración: Inicializa el campo `sponsor_bonus` (Bono por patrocinio directo)
 * en Bs. 120 para todos los planes existentes que no lo tengan configurado.
 *
 * Ejecutar con:
 *   node scripts/init-plan-sponsor-bonuses.js
 */

const db = require("../components/db");

async function main() {
  const plans = await db.Plan.find({});
  console.log(`Verificando ${plans.length} planes en catálogo...`);

  for (const plan of plans) {
    if (plan.sponsor_bonus === undefined || plan.sponsor_bonus === null) {
      await db.Plan.update({ id: plan.id }, { $set: { sponsor_bonus: 120 } });
      console.log(`[OK] Plan "${plan.id}" (${plan.name}): configurado sponsor_bonus = 120`);
    } else {
      console.log(`[SKIP] Plan "${plan.id}" (${plan.name}): ya tiene sponsor_bonus = ${plan.sponsor_bonus}`);
    }
  }

  console.log("\nMigración completada con éxito.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Error en migración de planes:", err);
  process.exit(1);
});
