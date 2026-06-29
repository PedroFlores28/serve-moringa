/**
 * Backfill del Bono Residual para afiliaciones históricas ya aprobadas.
 *
 * Recorre todas las afiliaciones con status "approved" y genera los pagos
 * residuales que les hubieran correspondido según la nueva lógica del plan
 * de compensación (residual lineal 8 niveles, sin rangos ni compresión).
 *
 * Es idempotente: omite las afiliaciones que ya tienen pagos residuales
 * registrados (no duplica).
 *
 * Uso:
 *   node scripts/backfill-affiliation-residual.js            # DRY-RUN (no escribe)
 *   node scripts/backfill-affiliation-residual.js --commit   # Aplica los pagos
 */

require("dotenv").config();

const db = require("../components/db");
const residualBonus = require("../lib/residualBonus");

const { Affiliation, Tree, User, Transaction, Product } = db;

// `components/lib.js` usa ESM (export default) y no puede requerirse desde un
// script Node CJS; replicamos el generador de ids usado por la app.
const rand = () => Math.random().toString(36).substr(2);

const COMMIT = process.argv.includes("--commit");

async function main() {
  const mode = COMMIT ? "COMMIT (escribe pagos)" : "DRY-RUN (no escribe)";
  console.log(`\n=== Backfill Bono Residual por afiliación — ${mode} ===\n`);

  const approved = await Affiliation.find({ status: "approved" });
  console.log(`Afiliaciones aprobadas encontradas: ${approved.length}`);

  // Cargar árbol, usuarios y productos una sola vez (datos compartidos).
  const tree = await Tree.find({});
  const treeMap = new Map((tree || []).map((n) => [String(n.id), n]));

  const usersArr = await User.find({});
  const usersMap = new Map((usersArr || []).map((u) => [u.id, u]));

  const products = await Product.find({});

  // Procesar en orden cronológico (más antiguas primero).
  approved.sort((a, b) => {
    const da = new Date(a.approved_at || a.date || 0).getTime();
    const dbb = new Date(b.approved_at || b.date || 0).getTime();
    return da - dbb;
  });

  let processed = 0;
  let skipped = 0;
  let totalTx = 0;
  let totalAmount = 0;

  for (const aff of approved) {
    const referenceDate = new Date(aff.approved_at || aff.date || Date.now());

    const result = await residualBonus.payAffiliationResidualBonus({
      affiliation: aff,
      Tree,
      User,
      Transaction,
      Product,
      Affiliation,
      rand,
      referenceDate,
      usersMap,
      treeMap,
      products,
      dryRun: !COMMIT,
    });

    if (result.skipped) {
      skipped += 1;
      if (result.reason === "already_generated") {
        // Silencioso: ya procesada bajo la nueva implementación.
      } else {
        console.log(`  - Afiliación ${aff.id}: omitida (${result.reason})`);
      }
      continue;
    }

    const lines = result.lines || [];
    const amount = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
    totalTx += lines.length;
    totalAmount += amount;
    processed += 1;

    console.log(
      `  + Afiliación ${aff.id} (user ${aff.userId}): ${lines.length} niveles, Bs ${amount.toFixed(2)}` +
        (COMMIT ? ` → ${result.created.length} tx creadas` : " [simulado]")
    );

    if (COMMIT) {
      await Affiliation.update({ id: aff.id }, { residual_generated: true });
    }
  }

  console.log("\n=== Resumen ===");
  console.log(`Afiliaciones procesadas:  ${processed}`);
  console.log(`Afiliaciones omitidas:    ${skipped}`);
  console.log(`Líneas residuales:        ${totalTx}`);
  console.log(`Monto residual total:     Bs ${totalAmount.toFixed(2)}`);
  if (!COMMIT) {
    console.log("\nDRY-RUN: no se escribió nada. Ejecuta con --commit para aplicar.");
  }
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[ERROR] Backfill falló:", err);
    process.exit(1);
  });
