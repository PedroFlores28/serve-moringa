const db = require("../components/db");
const {
  calendarMonthKey,
  startOfCalendarMonth,
  endOfCalendarMonth,
  countProductsInRecord,
  recordInMonthScope,
} = require("../lib/productTotals");

async function main() {
  const now = new Date();
  const monthScope = {
    start: startOfCalendarMonth(now),
    end: endOfCalendarMonth(now),
    periodKeys: [calendarMonthKey(now)],
  };
  const openPeriods = await db.Period.find({ status: "open" });
  if (openPeriods.length) {
    openPeriods.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const openKey = openPeriods[0].key;
    if (!monthScope.periodKeys.includes(openKey)) monthScope.periodKeys.push(openKey);
  }

  const affs = await db.Affiliation.find({ status: "approved" });
  let inScope = 0;
  let units = 0;
  for (const a of affs) {
    if (!recordInMonthScope(a, monthScope)) continue;
    inScope++;
    units += countProductsInRecord(a);
  }

  console.log({ monthScope, affiliationsInScope: inScope, totalUnits: units });
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
