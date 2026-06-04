/**
 * Volúmenes mensuales para nodos del árbol (misma lógica que dashboard).
 */
const { computeMonthlyActivity } = require("./monthlyActivity");

function monthStartDate(ref = new Date()) {
  const d = new Date(ref);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

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

async function fetchMonthRecordsForUsers(Activation, Affiliation, userIds) {
  const expanded = expandIdsForIn(userIds);
  if (!expanded.length) {
    return { activations: [], affiliations: [] };
  }
  const monthStart = monthStartDate();
  const query = {
    userId: { $in: expanded },
    status: "approved",
    $or: [{ date: { $gte: monthStart } }, { approved_at: { $gte: monthStart } }],
  };
  const [activations, affiliations] = await Promise.all([
    Activation.find(query),
    Affiliation.find(query),
  ]);
  return { activations, affiliations };
}

function buildVolumeMap(users, allTree, activations, affiliations) {
  const map = new Map();
  for (const u of users || []) {
    if (!u || u.id == null) continue;
    const vol = computeMonthlyActivity(
      u,
      allTree,
      affiliations,
      activations
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
