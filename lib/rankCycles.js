/**
 * Progreso de ciclos por rango (productos en red → ciclos secuenciales).
 *
 * Inactividad:
 *  - Sin Plata todavía: pierde todo el volumen acumulado y vuelve a C1 en cero.
 *  - Con rango alcanzado: C1 queda permanente (locked). C2+ y el overflow se pierden.
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

const RANK_POS = {
  none: 0,
  activo: 0,
  plata: 1,
  oro: 2,
  zafiro: 3,
  rubi: 4,
  "rubí": 4,
  esmeralda: 5,
  diamante: 6,
  "doble diamante": 7,
  "diamante corona": 8,
  "embajador class": 9,
};

const RANK_DISPLAY = {
  plata: "Plata",
  oro: "Oro",
  zafiro: "Zafiro",
  rubi: "Rubí",
  "rubí": "Rubí",
  esmeralda: "Esmeralda",
  diamante: "Diamante",
  "doble diamante": "Doble diamante",
  "diamante corona": "Diamante corona",
  "embajador class": "Embajador Class",
};

const STRUCTURE_LEG_LABELS = {
  1: "Platas por pierna",
  2: "Oros por pierna",
  3: "Zafiros por pierna",
  4: "Rubíes por pierna",
  5: "Esmeraldas por pierna",
  6: "Diamantes por pierna",
  7: "Dobles diamantes por pierna",
  8: "Diamantes corona por pierna",
};

function normalizeTargetRankKey(rank) {
  if (!rank) return "";
  return String(rank)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/rubi$/, "rubí");
}

function careerRankPos(rank) {
  const key = normalizeTargetRankKey(rank);
  if (!key || key === "none" || key === "activo") return 0;
  if (key === "rubi") return RANK_POS["rubí"];
  return RANK_POS[key] || 0;
}

function displayRankName(rank) {
  const key = normalizeTargetRankKey(rank);
  if (!key || key === "none" || key === "activo") return "Sin rango";
  if (RANK_DISPLAY[key]) return RANK_DISPLAY[key];
  if (RANK_DISPLAY[key.replace(/rubi$/, "rubí")]) {
    return RANK_DISPLAY[key.replace(/rubi$/, "rubí")];
  }
  return String(rank)
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getRankCycleConfig(targetRank) {
  const key = normalizeTargetRankKey(targetRank) || "plata";
  if (key === "rubi") return RANK_CYCLES_BY_TARGET["rubí"];
  return RANK_CYCLES_BY_TARGET[key] || DEFAULT_CYCLE_CONFIG;
}

function statusLabel(status) {
  if (status === "completed") return "Completado";
  if (status === "in_progress") return "En curso";
  return "Pendiente";
}

/**
 * C1 es permanente solo si la persona YA consiguió el rango en el que está ciclando.
 * Si qualifying es el siguiente rango (aún no logrado), C1 de ese rango no está locked.
 */
function isCycle1Locked(maxRank, qualifyingRank, completedCycles) {
  const maxPos = careerRankPos(maxRank);
  const qualPos = careerRankPos(qualifyingRank) || 1;
  if (maxPos < 1) return false;
  if (maxPos >= qualPos) return true;
  return Number(completedCycles) >= 1;
}

/**
 * Aplica las dos reglas de inactividad sobre el progreso persistido.
 */
function resolveInactivityCycleState({
  monthlyActive,
  maxRank,
  qualifyingRank,
  completedCycles,
  cycleOverflow,
} = {}) {
  const completed = Math.max(0, Number(completedCycles) || 0);
  const overflow = Math.max(0, Number(cycleOverflow) || 0);
  const neverReachedPlata = careerRankPos(maxRank) < 1;
  const cycle1Locked = isCycle1Locked(maxRank, qualifyingRank, completed);

  if (monthlyActive) {
    return {
      monthlyActive: true,
      neverReachedPlata,
      cycle1Locked,
      completedCycles: completed,
      overflow,
      countsVolume: true,
    };
  }

  if (neverReachedPlata) {
    return {
      monthlyActive: false,
      neverReachedPlata: true,
      cycle1Locked: false,
      completedCycles: 0,
      overflow: 0,
      countsVolume: false,
    };
  }

  return {
    monthlyActive: false,
    neverReachedPlata: false,
    cycle1Locked: cycle1Locked || completed >= 1,
    completedCycles: cycle1Locked || completed >= 1 ? 1 : 0,
    overflow: 0,
    countsVolume: false,
  };
}

function computeRankCycleProgress(
  qualifyingRank,
  completedCycles,
  currentMonthProducts,
  cycleOverflow,
  personalDirects,
  options = {}
) {
  const cfg = getRankCycleConfig(qualifyingRank);
  const totalCycles = cfg.totalCycles;
  const productsPerCycle = cfg.productsPerCycle;
  const cycle1Locked = !!options.cycle1Locked;
  const allowInProgress = options.allowInProgress !== false;
  const monthProducts = Math.max(0, Number(currentMonthProducts) || 0);
  const overflow = Math.max(0, Number(cycleOverflow) || 0);
  const safeCompleted = Math.max(0, Number(completedCycles) || 0);

  if (totalCycles === 0) {
    return {
      targetRank: qualifyingRank || "plata",
      targetRankLabel: displayRankName(qualifyingRank || "plata"),
      totalCycles: 0,
      productsPerCycle: 0,
      completedCycles: 0,
      cyclesLabel: "0 / 0",
      personalDirects: Math.max(0, Number(personalDirects) || 0),
      groupProductCount: monthProducts,
      currentCycleVolume: 0,
      overallPct: 0,
      remainingPct: 0,
      cycle1Locked: false,
      cycles: [],
    };
  }

  const cycles = [];
  const currentCycleVolume = allowInProgress ? monthProducts + overflow : 0;
  const totalRequired = totalCycles * productsPerCycle;
  const simulatedProducts = safeCompleted * productsPerCycle + currentCycleVolume;
  const overallPct =
    totalRequired > 0 ? Math.min(100, Math.floor((simulatedProducts / totalRequired) * 100)) : 0;
  const remainingPct = Math.max(0, 100 - overallPct);

  for (let i = 0; i < totalCycles; i++) {
    let status = "pending";
    let current = 0;
    let locked = false;

    if (i < safeCompleted) {
      status = "completed";
      current = productsPerCycle;
      locked = cycle1Locked && i === 0 && safeCompleted < totalCycles;
    } else if (i === safeCompleted && allowInProgress) {
      status = "in_progress";
      current = Math.min(productsPerCycle, currentCycleVolume);
    }

    cycles.push({
      index: i + 1,
      shortLabel: "C" + (i + 1),
      label: "CICLO " + (i + 1),
      status,
      statusLabel: statusLabel(status),
      locked,
      current,
      required: productsPerCycle,
      display: current + " / " + productsPerCycle,
    });
  }

  return {
    targetRank: qualifyingRank || "plata",
    targetRankLabel: displayRankName(qualifyingRank || "plata"),
    totalCycles,
    productsPerCycle,
    completedCycles: safeCompleted,
    cyclesLabel: safeCompleted + " / " + totalCycles,
    personalDirects: Math.max(0, Number(personalDirects) || 0),
    groupProductCount: monthProducts,
    currentCycleVolume: Math.min(productsPerCycle, currentCycleVolume),
    overallPct,
    remainingPct,
    cycle1Locked,
    cycles,
  };
}

function buildQualificationView({
  monthlyActive,
  qualifyingRank,
  maxRank,
  rankCycle,
  structureCurrent = 0,
  structureRequired = 0,
  requiredRankPos = 0,
} = {}) {
  if (!monthlyActive) {
    return {
      title: "Sin calificación",
      subtitle: "Usuario inactivo. No acumula volumen ni requisitos.",
      volumeCurrent: 0,
      volumeRequired: rankCycle ? rankCycle.productsPerCycle : 0,
      structureLabel: "",
      structureCurrent: 0,
      structureRequired: 0,
    };
  }

  const target = displayRankName(qualifyingRank || (rankCycle && rankCycle.targetRank) || "plata");
  const volumeRequired = rankCycle ? rankCycle.productsPerCycle : 0;
  const volumeCurrent = rankCycle ? rankCycle.currentCycleVolume : 0;
  const structureLabel =
    structureRequired > 0
      ? STRUCTURE_LEG_LABELS[requiredRankPos] || "Piernas requeridas"
      : "";

  return {
    title: "Buscando " + target,
    subtitle: "",
    volumeCurrent,
    volumeRequired,
    structureLabel,
    structureCurrent: Math.max(0, Number(structureCurrent) || 0),
    structureRequired: Math.max(0, Number(structureRequired) || 0),
  };
}

/**
 * Progreso listo para UI (dashboard / preview) aplicando inactividad.
 */
function computeVisibleRankProgress({
  monthlyActive,
  maxRank,
  qualifyingRank,
  completedCycles,
  cycleOverflow,
  currentMonthProducts,
  personalDirects,
  structureCurrent,
  structureRequired,
  requiredRankPos,
} = {}) {
  const resolved = resolveInactivityCycleState({
    monthlyActive,
    maxRank,
    qualifyingRank,
    completedCycles,
    cycleOverflow,
  });

  const volume = resolved.countsVolume ? Math.max(0, Number(currentMonthProducts) || 0) : 0;
  const rankCycle = computeRankCycleProgress(
    qualifyingRank || "plata",
    resolved.completedCycles,
    volume,
    resolved.overflow,
    personalDirects,
    {
      cycle1Locked: resolved.cycle1Locked,
      allowInProgress: resolved.countsVolume,
    }
  );

  const qualification = buildQualificationView({
    monthlyActive: resolved.monthlyActive,
    qualifyingRank: qualifyingRank || "plata",
    maxRank,
    rankCycle,
    structureCurrent: resolved.countsVolume ? structureCurrent : 0,
    structureRequired,
    requiredRankPos,
  });

  return {
    ...resolved,
    rankCycle,
    qualification,
  };
}

module.exports = {
  getRankCycleConfig,
  computeRankCycleProgress,
  resolveInactivityCycleState,
  computeVisibleRankProgress,
  buildQualificationView,
  displayRankName,
  careerRankPos,
  isCycle1Locked,
  STRUCTURE_LEG_LABELS,
};
