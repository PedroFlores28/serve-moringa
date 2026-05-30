/**
 * Simula GET admin/users (página 1) y valida campos de columnas.
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const db = require("../components/db");
const {
  calendarMonthKey,
  startOfCalendarMonth,
  endOfCalendarMonth,
  countProductsInRecord,
  userIdMatches,
  recordInMonthScope,
} = require("../lib/productTotals");
const { resolvePlanDisplayName } = require("../lib/planNames");

function expandIdsForIn(ids) {
  const out = new Set();
  for (const id of ids) {
    if (id == null || id === "") continue;
    out.add(id);
    const n = Number(id);
    if (!Number.isNaN(n)) out.add(n);
  }
  return [...out];
}

function resolvePlanLabelForUser(user, latestAffByUserId) {
  const pid = String(user.plan || "").trim().toLowerCase();
  if (pid && pid !== "none" && pid !== "default") {
    return resolvePlanDisplayName({ id: user.plan });
  }
  const aff = latestAffByUserId.get(String(user.id));
  if (aff && aff.plan) return resolvePlanDisplayName(aff.plan);
  return "—";
}

async function main() {
  const allUsers = await db.User.find({});
  const pageNum = 1;
  const limitNum = 5;
  const skip = (pageNum - 1) * limitNum;
  let users = allUsers.slice(skip, skip + limitNum);

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

  const userIdsForProducts = expandIdsForIn(users.map((u) => u.id));
  const monthDateFilter = { $gte: monthScope.start, $lte: monthScope.end };
  const monthOrFilter = {
    $or: [
      { date: monthDateFilter },
      { approved_at: monthDateFilter },
      { period_key: { $in: monthScope.periodKeys } },
    ],
  };

  let pageActivations = [];
  let pageAffiliations = [];
  try {
    pageActivations = userIdsForProducts.length
      ? await db.Activation.find({
          userId: { $in: userIdsForProducts },
          status: "approved",
          ...monthOrFilter,
        })
      : [];
    pageAffiliations = userIdsForProducts.length
      ? await db.Affiliation.find({
          userId: { $in: userIdsForProducts },
          status: "approved",
          ...monthOrFilter,
        })
      : [];
  } catch (e) {
    console.error("QUERY ERROR", e.message);
    process.exit(1);
  }

  const approvedAffiliationsForPlan = userIdsForProducts.length
    ? await db.Affiliation.find({
        userId: { $in: userIdsForProducts },
        status: "approved",
      })
    : [];
  const latestAffByUserId = new Map();
  for (const aff of approvedAffiliationsForPlan) {
    const uid = String(aff.userId);
    const prev = latestAffByUserId.get(uid);
    if (!prev || new Date(aff.date) > new Date(prev.date)) {
      latestAffByUserId.set(uid, aff);
    }
  }

  function monthProductsForUser(userId) {
    let count = 0;
    for (const act of pageActivations) {
      if (!userIdMatches(act.userId, userId)) continue;
      if (!recordInMonthScope(act, monthScope)) continue;
      count += countProductsInRecord(act);
    }
    for (const aff of pageAffiliations) {
      if (!userIdMatches(aff.userId, userId)) continue;
      if (!recordInMonthScope(aff, monthScope)) continue;
      count += countProductsInRecord(aff);
    }
    return count;
  }

  const sample = users.slice(0, 3).map((user) => ({
    name: `${user.name} ${user.lastName}`,
    department: user.department || user.city || "—",
    plan: user.plan,
    planLabel: resolvePlanLabelForUser(user, latestAffByUserId),
    productos: monthProductsForUser(user.id),
    affiliated: user.affiliated,
    activated: user.activated,
  }));

  console.log(
    JSON.stringify(
      {
        totalUsers: allUsers.length,
        pageUsers: users.length,
        activationsQuery: pageActivations.length,
        affiliationsQuery: pageAffiliations.length,
        sample,
      },
      null,
      2
    )
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
