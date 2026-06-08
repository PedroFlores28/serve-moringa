/**
 * Enriquece la previsualización del cierre con productos del periodo
 * y periodos calificados (Class Moringa).
 */
const db = require("../components/db");
const { computeMonthlyActivity } = require("./monthlyActivity");

const { Activation, Affiliation } = db;

/**
 * Misma ventana que dashboard / árbol: mes calendario actual (no filtro de periodo de cierre).
 * El motor de cierre usa otro filtro para residuales; los productos en preview deben coincidir con la app.
 */
async function loadCalendarMonthActivationsAndAffiliations(referenceDate = new Date()) {
  const ref = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  const monthStart = new Date(ref.getFullYear(), ref.getMonth(), 1, 0, 0, 0, 0);

  const query = {
    status: "approved",
    $or: [{ date: { $gte: monthStart } }, { approved_at: { $gte: monthStart } }],
  };

  const [activations, affiliations] = await Promise.all([
    Activation.find(query),
    Affiliation.find(query),
  ]);

  return { activations: activations || [], affiliations: affiliations || [] };
}

/** @deprecated Usar loadCalendarMonthActivationsAndAffiliations para productos en preview. */
async function loadPeriodActivationsAndAffiliations(referenceDate) {
  const dbFull = require("../components/db");
  const { Period, Closed } = dbFull;
  const openPeriods = await Period.find({ status: "open" });
  const openKeys = (openPeriods || []).map((p) => p.key).filter(Boolean);

  let lastClosedAt = null;
  try {
    const allCloseds = await Closed.find({});
    if (Array.isArray(allCloseds) && allCloseds.length) {
      const sorted = allCloseds
        .slice()
        .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
      const top = sorted[0];
      if (top && top.date) lastClosedAt = new Date(top.date);
    }
  } catch (e) {
    lastClosedAt = null;
  }

  const allApproved = await Activation.find({ status: "approved" });
  const activations = (allApproved || []).filter((a) => {
    if (openKeys.length > 0) {
      if (a.period_key && openKeys.includes(a.period_key)) return true;
      const hasNoPeriod = a.period_key == null || a.period_key === "";
      if (hasNoPeriod && lastClosedAt && a.date && new Date(a.date) >= lastClosedAt) {
        return true;
      }
      return false;
    }
    if (lastClosedAt) {
      return a.date && new Date(a.date) >= lastClosedAt;
    }
    return true;
  });

  const affiliations = await Affiliation.find({ status: "approved" });

  return { activations, affiliations, referenceDate: referenceDate || new Date() };
}

function countQualifiedPeriods(userDoc) {
  const history = Array.isArray(userDoc?.rank_history) ? userDoc.rank_history : [];
  return history.filter((e) => {
    const r = String(e?.rank || "")
      .trim()
      .toLowerCase();
    return r && r !== "none";
  }).length;
}

function enrichPreviewTreeForClassMoringa(
  previewTree,
  usersList,
  treeList,
  activations,
  affiliations,
  referenceDate
) {
  const userById = new Map((usersList || []).map((u) => [u.id, u]));
  const treeById = new Map((treeList || []).map((n) => [n.id, n]));

  return (previewTree || []).map((node) => {
    const userDoc = userById.get(node.id);
    const sourceNode = treeById.get(node.id);

    let personalProducts = 0;
    let teamProducts = 0;
    if (userDoc) {
      const vol = computeMonthlyActivity(
        userDoc,
        treeList,
        affiliations,
        activations,
        referenceDate
      );
      personalProducts = vol.personalProductCount;
      teamProducts = vol.groupProductCount;
    }

    const legs = (sourceNode?.childs || []).map((childId, index) => {
      const childUser = userById.get(childId);
      let legPersonal = 0;
      let legTeam = 0;
      if (childUser) {
        const legVol = computeMonthlyActivity(
          childUser,
          treeList,
          affiliations,
          activations,
          referenceDate
        );
        legPersonal = legVol.personalProductCount;
        legTeam = legVol.groupProductCount;
      }
      return {
        idx: index + 1,
        user_id: childId,
        token: childUser?.token || "",
        dni: childUser?.dni || "",
        name:
          [childUser?.name, childUser?.lastName].filter(Boolean).join(" ").trim() ||
          "Sin nombre",
        personal_products: legPersonal,
        team_products: legTeam,
        personal_points: legPersonal,
        total_points: legTeam,
      };
    });

    return {
      ...node,
      token: userDoc?.token || node.token || "",
      personal_products: personalProducts,
      team_products: teamProducts,
      points: personalProducts,
      _total: teamProducts,
      qualified_periods: countQualifiedPeriods(userDoc),
      grouped_points_legs: legs,
    };
  });
}

module.exports = {
  loadCalendarMonthActivationsAndAffiliations,
  loadPeriodActivationsAndAffiliations,
  countQualifiedPeriods,
  enrichPreviewTreeForClassMoringa,
};
