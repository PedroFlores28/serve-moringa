/**
 * Progreso de ciclos por rango (productos en red → ciclos secuenciales).
 */

const DEFAULT_CYCLE_CONFIG = { totalCycles: 4, productsPerCycle: 200 };

const RANK_CYCLES_BY_TARGET = {
  activo: { totalCycles: 0, productsPerCycle: 0 },
  plata: { totalCycles: 4, productsPerCycle: 200 },
  oro: { totalCycles: 4, productsPerCycle: 500 },
  zafiro: { totalCycles: 4, productsPerCycle: 1500 },
  rubí: { totalCycles: 4, productsPerCycle: 2500 },
  esmeralda: { totalCycles: 4, productsPerCycle: 6000 },
  diamante: { totalCycles: 6, productsPerCycle: 9000 },
  "doble diamante": { totalCycles: 6, productsPerCycle: 20000 },
  "diamante corona": { totalCycles: 6, productsPerCycle: 30000 },
  "embajador class": { totalCycles: 6, productsPerCycle: 35000 },
};

function normalizeTargetRankKey(rank) {
  if (!rank) return "plata";
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

function computeRankCycleProgress(qualifyingRank, completedCycles, currentMonthProducts, cycleOverflow, personalDirects) {
  const cfg = getRankCycleConfig(qualifyingRank);
  const totalCycles = cfg.totalCycles;
  const productsPerCycle = cfg.productsPerCycle;
  
  if (totalCycles === 0) {
    return {
      targetRank: qualifyingRank || "plata",
      totalCycles: 0,
      productsPerCycle: 0,
      completedCycles: 0,
      cyclesLabel: "0 / 0",
      personalDirects: Math.max(0, Number(personalDirects) || 0),
      groupProductCount: currentMonthProducts,
      overallPct: 0,
      remainingPct: 0,
      cycles: [],
    };
  }

  const cycles = [];
  const totalRequired = totalCycles * productsPerCycle;
  let simulatedProducts = (completedCycles * productsPerCycle) + currentMonthProducts + cycleOverflow;
  
  const overallPct = totalRequired > 0 ? Math.min(100, Math.floor((simulatedProducts / totalRequired) * 100)) : 0;
  const remainingPct = Math.max(0, 100 - overallPct);

  for (let i = 0; i < totalCycles; i++) {
    let status = "pending";
    let current = 0;

    if (i < completedCycles) {
      status = "completed";
      current = productsPerCycle;
    } else if (i === completedCycles) {
      status = "in_progress";
      current = Math.min(productsPerCycle, currentMonthProducts + cycleOverflow);
    }

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
    targetRank: qualifyingRank || "plata",
    totalCycles,
    productsPerCycle,
    completedCycles,
    cyclesLabel: completedCycles + " / " + totalCycles,
    personalDirects: Math.max(0, Number(personalDirects) || 0),
    groupProductCount: currentMonthProducts,
    overallPct,
    remainingPct,
    cycles,
  };
}

module.exports = {
  getRankCycleConfig,
  computeRankCycleProgress,
};
