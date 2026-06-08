/**
 * Volúmenes mensuales para nodos del árbol (misma lógica que dashboard).
 */
const { computeMonthlyActivity } = require("./monthlyActivity");
const {
  calendarMonthKey,
  startOfCalendarMonth,
  endOfCalendarMonth,
} = require("./productTotals");

function expandIdsForIn(ids) {
  const out = new Set();
  for (const id of ids || []) {
    if (id == null || id === "") continue;
    out.add(id);
    const n = Number(id);
    if (!Number.isNaN(n)) out.add(n);
  }
  return [...out];
}

async function fetchMonthRecordsForUsers(
  Activation,
  Affiliation,
  userIds,
  referenceDate = new Date()
) {
  const expanded = expandIdsForIn(userIds);
  if (!expanded.length) {
    return { activations: [], affiliations: [] };
  }
  const ref = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  const monthStart = startOfCalendarMonth(ref);
  const monthEnd = endOfCalendarMonth(ref);
  const periodKey = calendarMonthKey(ref);
  const query = {
    userId: { $in: expanded },
    status: "approved",
    $or: [
      { date: { $gte: monthStart, $lte: monthEnd } },
      { approved_at: { $gte: monthStart, $lte: monthEnd } },
      { period_key: periodKey },
    ],
  };
  const [activations, affiliations] = await Promise.all([
    Activation.find(query),
    Affiliation.find(query),
  ]);
  return { activations, affiliations };
}

function buildVolumeMap(users, allTree, activations, affiliations, referenceDate = new Date()) {
  const map = new Map();
  for (const u of users || []) {
    if (!u || u.id == null) continue;
    const vol = computeMonthlyActivity(
      u,
      allTree,
      affiliations,
      activations,
      referenceDate
    );
    map.set(String(u.id), {
      personalProductCount: vol.personalProductCount,
      groupProductCount: vol.groupProductCount,
    });
  }
  return map;
}

function volumesForUser(volumeMap, userId) {
  if (userId == null) {
    return { personalProductCount: 0, groupProductCount: 0 };
  }
  return (
    volumeMap.get(String(userId)) || {
      personalProductCount: 0,
      groupProductCount: 0,
    }
  );
}

module.exports = {
  fetchMonthRecordsForUsers,
  buildVolumeMap,
  volumesForUser,
};
