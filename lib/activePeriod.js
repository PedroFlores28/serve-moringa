const db = require("../components/db");
const { Period } = db;

function resolveYearMonthFromPeriod(period) {
  if (period?.year && period?.month) {
    return { year: Number(period.year), month: Number(period.month) };
  }

  if (period?.key && /^\d{4}-\d{2}$/.test(period.key)) {
    const [y, m] = period.key.split("-").map((v) => Number(v));
    return { year: y, month: m };
  }

  const ref = period?.createdAt ? new Date(period.createdAt) : new Date();
  return { year: ref.getFullYear(), month: ref.getMonth() + 1 };
}

/** Fecha de referencia = primer día del mes del periodo abierto (ej. junio → 2026-06-01). */
async function getActivePeriodReferenceDate() {
  const openPeriods = await Period.find({ status: "open" });
  if (!openPeriods || !openPeriods.length) return new Date();

  openPeriods.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  const activePeriod = openPeriods[0];
  const { year, month } = resolveYearMonthFromPeriod(activePeriod);
  return new Date(year, month - 1, 1);
}

module.exports = {
  resolveYearMonthFromPeriod,
  getActivePeriodReferenceDate,
};
