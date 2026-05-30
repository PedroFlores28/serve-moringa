/**
 * Normaliza nombres guardados en afiliaciones: solo CLASS y VIP visibles.
 * No cambia montos, fechas ni plan.id interno.
 * Uso: node scripts/normalize-historical-plan-labels.js
 */
const db = require("../components/db");
const { resolvePlanDisplayName } = require("../lib/planNames");

async function main() {
  const items = await db.Affiliation.find({});
  let updated = 0;

  for (const item of items) {
    if (!item.plan) continue;
    const display = resolvePlanDisplayName(item.plan);
    const current = String(item.plan.name || "").trim();
    if (current === display) continue;

    await db.Affiliation.update(
      { id: item.id },
      { plan: { ...item.plan, name: display } }
    );
    updated++;
  }

  console.log(
    `Listo: ${updated} afiliación(es) con nombre de plan actualizado a CLASS/VIP (${items.length} revisadas).`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
