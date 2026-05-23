/**
 * Progreso de ciclos por rango (productos en red → ciclos secuenciales).
 * Configurable por rango objetivo; por defecto 4 ciclos × 600 productos.
 */

const DEFAULT_CYCLE_CONFIG = { totalCycles: 4, productsPerCycle: 600 };

/** Rango que el socio está por alcanzar (nextRankName del dashboard) */
const RANK_CYCLES_BY_TARGET = {
  active: { totalCycles: 4, productsPerCycle: 600 },
  star: { totalCycles: 4, productsPerCycle: 600 },
  master: { totalCycles: 4, productsPerCycle: 600 },
  silver: { totalCycles: 5, productsPerCycle: 650 },
  gold: { totalCycles: 5, productsPerCycle: 700 },
  sapphire: { totalCycles: 5, productsPerCycle: 750 },
  rubi: { totalCycles: 6, productsPerCycle: 800 },
  ruby: { totalCycles: 6, productsPerCycle: 800 },
  diamante: { totalCycles: 6, productsPerCycle: 900 },
  "doble diamante": { totalCycles: 6, productsPerCycle: 950 },
  "triple diamante": { totalCycles: 6, productsPerCycle: 1000 },
  "diamante estrella": { totalCycles: 6, productsPerCycle: 1100 },
};

function normalizeTargetRankKey(rank) {
  if (!rank) return "star";
  return String(rank).trim().toLowerCase();
}

function getRankCycleConfig(targetRank) {
  const key = normalizeTargetRankKey(targetRank);
  return RANK_CYCLES_BY_TARGET[key] || DEFAULT_CYCLE_CONFIG;
}

function statusLabel(status) {
  if (status === "completed") return "COMPLETADO";
  if (status === "in_progress") return "EN PROGRESO";
  return "PENDIENTE";
}

/**
 * @param {string} targetRank - siguiente rango a alcanzar
 * @param {number} groupProductCount - productos en red (personal + equipo)
 * @param {number} personalDirects - patrocinados personales (directos)
 */
function computeRankCycleProgress(targetRank, groupProductCount, personalDirects) {
  const cfg = getRankCycleConfig(targetRank);
  const totalCycles = cfg.totalCycles;
  const productsPerCycle = cfg.productsPerCycle;
  const totalRequired = totalCycles * productsPerCycle;
  const total = Math.max(0, Number(groupProductCount) || 0);

  const overallPct =
    totalRequired > 0
      ? Math.min(100, Math.floor((total / totalRequired) * 100))
      : 0;
  const remainingPct = Math.max(0, 100 - overallPct);
  const completedCycles = Math.min(
    totalCycles,
    Math.floor(total / productsPerCycle)
  );

  const cycles = [];
  for (let i = 0; i < totalCycles; i++) {
    const start = i * productsPerCycle;
    const current = Math.min(
      productsPerCycle,
      Math.max(0, total - start)
    );
    let status = "pending";
    if (current >= productsPerCycle) status = "completed";
    else if (total > start) status = "in_progress";

    cycles.push({
      index: i + 1,
      label: "CICLO " + (i + 1),
      status,
      statusLabel: statusLabel(status),
      current,
      required: productsPerCycle,
      display: current + " / " + productsPerCycle,
    });
  }

  return {
    targetRank: targetRank || "star",
    totalCycles,
    productsPerCycle,
    completedCycles,
    cyclesLabel: completedCycles + " / " + totalCycles,
    personalDirects: Math.max(0, Number(personalDirects) || 0),
    groupProductCount: total,
    overallPct,
    remainingPct,
    cycles,
  };
}

module.exports = {
  getRankCycleConfig,
  computeRankCycleProgress,
};
