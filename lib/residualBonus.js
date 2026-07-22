/**
 * Bono Residual por afiliación (Class Moringa).
 *
 * Al aprobar una afiliación, además del Bono de Afiliación (120 Bs al patrocinador
 * directo), se genera de forma INMEDIATA el Bono Residual sobre los productos del
 * paquete de afiliación, distribuido linealmente hasta 8 niveles de profundidad.
 *
 * Reglas (idénticas a la lógica residual del cierre, SIN rangos ni compresión dinámica):
 *  - El consumidor es el nuevo afiliado.
 *  - Cada ancestro a distancia d (1..8) cobra Σ (cantidad_producto × residual_profit_levels[d-1]).
 *  - La tabla de pagos por nivel se toma del snapshot guardado en la afiliación y,
 *    si no está, de la configuración actual del producto (por id / código).
 *  - Si el ancestro receptor está inactivo, el bono se registra igual pero como
 *    saldo no disponible (virtual), igual que el Bono de Afiliación.
 *
 * Idempotencia: no se vuelve a generar si ya existen transacciones residuales para
 * la misma afiliación (name = RESIDUAL_TX_NAME y affiliation_id).
 */

const { isUserActiveForAffiliationBonus } = require("./affiliationBonus");

const RESIDUAL_TX_NAME = "residual bonus";
const RESIDUAL_SOURCE_AFFILIATION = "affiliation";
const MAX_DEPTH = 8;

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Devuelve un arreglo de 8 montos por nivel a partir del snapshot o del fallback. */
function toLevelsArray(fallbackVal, levelsMaybe) {
  const arr =
    Array.isArray(levelsMaybe) && levelsMaybe.length
      ? levelsMaybe.slice(0, MAX_DEPTH)
      : null;
  if (arr) {
    const out = Array.from({ length: MAX_DEPTH }, () => 0);
    for (let i = 0; i < MAX_DEPTH; i++) out[i] = num(arr[i]);
    return out;
  }
  return Array.from({ length: MAX_DEPTH }, () => num(fallbackVal));
}

/**
 * Construye un resolver de tabla de pagos por línea de producto.
 * Prioridad: snapshot de la línea → configuración actual del producto (id/código).
 */
function buildProductLevelsResolver(products) {
  const byId = new Map();
  const byCode = new Map();
  for (const p of products || []) {
    const levels = toLevelsArray(num(p.residual_profit), p.residual_profit_levels);
    if (p.id != null) byId.set(String(p.id), levels);
    if (p.code != null) byCode.set(String(p.code), levels);
  }

  return (line) => {
    if (
      Array.isArray(line.residual_profit_levels) &&
      line.residual_profit_levels.length
    ) {
      return toLevelsArray(num(line.residual_profit), line.residual_profit_levels);
    }
    const own = num(line.residual_profit);
    if (own > 0) return toLevelsArray(own, null);
    if (line.id != null && byId.has(String(line.id))) return byId.get(String(line.id));
    if (line.code != null && byCode.has(String(line.code))) return byCode.get(String(line.code));
    return Array.from({ length: MAX_DEPTH }, () => 0);
  };
}

/** Cadena de ancestros del consumidor (nivel 1 = patrocinador directo) hasta MAX_DEPTH. */
function buildAncestorChain(treeMap, consumerId, maxDepth = MAX_DEPTH) {
  const chain = [];
  let node = treeMap.get(String(consumerId));
  let depth = 0;
  while (node && node.parent != null && node.parent !== "" && depth < maxDepth) {
    depth += 1;
    chain.push({ id: node.parent, level: depth });
    node = treeMap.get(String(node.parent));
  }
  return chain;
}

/**
 * Calcula las líneas de bono residual (sin escribir nada).
 * Si se pasa `usersMap`, se omiten los ancestros que no correspondan a un usuario
 * real (p. ej. el nodo raíz sintético del árbol), conservando el nivel de distancia.
 * @returns {{ recipientId, level, amount }[]}
 */
function computeAffiliationResidualLines({ affiliation, treeMap, products, usersMap = null }) {
  const consumerId = affiliation.userId;
  if (!consumerId) return [];

  const resolver = buildProductLevelsResolver(products);
  const productLines = Array.isArray(affiliation.products) ? affiliation.products : [];
  const ancestors = buildAncestorChain(treeMap, consumerId);

  const lines = [];
  for (const anc of ancestors) {
    if (usersMap && !usersMap.get(anc.id)) continue; // ancestro sin usuario real
    let amount = 0;
    for (const line of productLines) {
      const qty = num(line.total);
      if (qty <= 0) continue;
      const levels = resolver(line);
      amount += qty * num(levels[anc.level - 1]);
    }
    if (amount > 0) {
      lines.push({ recipientId: anc.id, level: anc.level, amount });
    }
  }
  return lines;
}

/**
 * Genera (o simula) el Bono Residual de una afiliación aprobada.
 *
 * @returns {Promise<{ created: string[], lines: object[], skipped: boolean, reason?: string }>}
 */
async function payAffiliationResidualBonus({
  affiliation,
  Tree,
  User,
  Transaction,
  Product,
  Affiliation,
  rand,
  referenceDate = new Date(),
  usersMap = null,
  treeMap = null,
  products = null,
  dryRun = false,
}) {
  if (!affiliation || !affiliation.id) {
    return { created: [], lines: [], skipped: true, reason: "no_affiliation" };
  }

  // Idempotencia: si ya hay residuales para esta afiliación, no duplicar.
  const existing = await Transaction.find({
    affiliation_id: affiliation.id,
    name: RESIDUAL_TX_NAME,
  });
  if (existing && existing.length) {
    return { created: [], lines: [], skipped: true, reason: "already_generated" };
  }

  if (!treeMap) {
    const tree = await Tree.find({});
    treeMap = new Map((tree || []).map((n) => [String(n.id), n]));
  }
  if (!products) {
    products = await Product.find({});
  }

  const lines = computeAffiliationResidualLines({
    affiliation,
    treeMap,
    products,
    usersMap,
  });
  if (!lines.length) {
    return { created: [], lines: [], skipped: true, reason: "no_residual" };
  }

  if (dryRun) {
    return { created: [], lines, skipped: false, reason: "dry_run" };
  }

  const created = [];
  for (const line of lines) {
    const recipient = usersMap
      ? usersMap.get(line.recipientId)
      : await User.findOne({ id: line.recipientId });
    if (!recipient) continue;

    let active = false;
    try {
      const status = await isUserActiveForAffiliationBonus(recipient, {
        Affiliation,
        referenceDate,
      });
      active = !!status.active;
    } catch (_) {
      active = false;
    }

    const txId = rand();
    await Transaction.insert({
      id: txId,
      date: new Date(),
      user_id: recipient.id,
      type: "in",
      value: line.amount,
      name: RESIDUAL_TX_NAME,
      desc: `Bono residual afiliación nivel ${line.level}`,
      affiliation_id: affiliation.id,
      residual_source: RESIDUAL_SOURCE_AFFILIATION,
      level: line.level,
      virtual: !active,
      _user_id: affiliation.userId,
    });
    created.push(txId);
  }

  return { created, lines, skipped: false };
}

const RESIDUAL_SOURCE_ACTIVATION = "activation";

/**
 * Genera el Bono Residual de una compra adicional o reactivación (Activation) en tiempo real.
 */
async function payActivationResidualBonus({
  activation,
  Tree,
  User,
  Transaction,
  Product,
  rand,
  usersMap = null,
  treeMap = null,
  products = null,
}) {
  if (!activation || !activation.id) {
    return { created: [], lines: [], skipped: true, reason: "no_activation" };
  }

  // Idempotencia: si ya hay residuales para esta activación, no duplicar.
  const existing = await Transaction.find({
    activation_id: activation.id,
    name: RESIDUAL_TX_NAME,
  });
  if (existing && existing.length) {
    return { created: [], lines: [], skipped: true, reason: "already_generated" };
  }

  if (!treeMap) {
    const tree = await Tree.find({});
    treeMap = new Map((tree || []).map((n) => [String(n.id), n]));
  }
  if (!products) {
    products = await Product.find({});
  }

  // Usamos computeAffiliationResidualLines porque la estructura (userId, products) es idéntica
  const lines = computeAffiliationResidualLines({
    affiliation: activation,
    treeMap,
    products,
    usersMap,
  });
  if (!lines.length) {
    return { created: [], lines: [], skipped: true, reason: "no_residual" };
  }

  const created = [];
  for (const line of lines) {
    const recipient = usersMap
      ? usersMap.get(line.recipientId)
      : await User.findOne({ id: line.recipientId });
    if (!recipient) continue;

    const active = !!recipient.activated;

    const txId = rand();
    await Transaction.insert({
      id: txId,
      date: new Date(),
      user_id: recipient.id,
      type: "in",
      value: line.amount,
      name: RESIDUAL_TX_NAME,
      desc: `Bono residual activación nivel ${line.level}`,
      activation_id: activation.id,
      residual_source: RESIDUAL_SOURCE_ACTIVATION,
      level: line.level,
      virtual: !active,
      _user_id: activation.userId,
    });
    created.push(txId);
  }

  return { created, lines, skipped: false };
}

module.exports = {
  RESIDUAL_TX_NAME,
  RESIDUAL_SOURCE_AFFILIATION,
  RESIDUAL_SOURCE_ACTIVATION,
  MAX_DEPTH,
  toLevelsArray,
  buildProductLevelsResolver,
  buildAncestorChain,
  computeAffiliationResidualLines,
  payAffiliationResidualBonus,
  payActivationResidualBonus,
};

