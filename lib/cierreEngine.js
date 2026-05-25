/**
 * Motor de cierre mensual en JavaScript (reemplaza el binario Go en `cierre_engine/`).
 *
 * Replica fielmente la lógica del motor Go original:
 *  - Cálculo de rango por usuario (frontales activas, reconsumo, VMP por pierna).
 *  - Bono residual con compresión dinámica usando "Ganancia por Residual" (Bs/producto).
 *  - Bono generacional VIP.
 *  - Bono ahorro Sifrah por plan.
 *  - Reset de saldos virtuales acumulados durante el periodo.
 *  - Persistencia de transacciones, snapshot en `closeds` y actualización de usuarios
 *    (rank, ceros de puntos y push a rank_history).
 *
 * Importante: este módulo NO ejecuta el cierre del Period (lo hace `closeds.js`),
 * ni aplica los bonos por logro/mantenimiento de rango (lo hace `applyRankBonusesOnClose`).
 */

const db = require("../components/db")
const libMod = require("../components/lib")
const lib = libMod.default || libMod

const MongoClient = require("mongodb").MongoClient

const DB_URL =
  process.env.DB_URL || process.env.MONGODB_URI || "mongodb://localhost:27017"
const DB_NAME =
  process.env.DB_NAME || process.env.DB_NAME_FALLBACK || "sifrah"

/* ------------------------------------------------------------------ *
 * Configuración de rangos (alineada con cierre_engine/engine/config.go)
 * ------------------------------------------------------------------ */

const RANKS = [
  { pos: 10, rank: "EMBAJADOR SIFRAH", minimumFrontals: 6, thresholdPoints: 600000, maximumLargeLeg: 100000, reconsumoRequired: 160 },
  { pos: 9,  rank: "DIAMANTE IMPERIAL", minimumFrontals: 6, thresholdPoints: 300000, maximumLargeLeg: 55000,  reconsumoRequired: 160 },
  { pos: 8,  rank: "TRIPLE DIAMANTE",   minimumFrontals: 5, thresholdPoints: 170000, maximumLargeLeg: 37500,  reconsumoRequired: 160 },
  { pos: 7,  rank: "DOBLE DIAMANTE",    minimumFrontals: 5, thresholdPoints: 85000,  maximumLargeLeg: 19000,  reconsumoRequired: 160 },
  { pos: 6,  rank: "DIAMANTE",          minimumFrontals: 4, thresholdPoints: 45000,  maximumLargeLeg: 12000,  reconsumoRequired: 160 },
  { pos: 5,  rank: "ESMERALDA",         minimumFrontals: 4, thresholdPoints: 20000,  maximumLargeLeg: 5500,   reconsumoRequired: 160 },
  { pos: 4,  rank: "RUBÍ",              minimumFrontals: 4, thresholdPoints: 7500,   maximumLargeLeg: 2100,   reconsumoRequired: 160 },
  { pos: 3,  rank: "ORO",               minimumFrontals: 3, thresholdPoints: 3500,   maximumLargeLeg: 1350,   reconsumoRequired: 160 },
  { pos: 2,  rank: "PLATA",             minimumFrontals: 3, thresholdPoints: 1500,   maximumLargeLeg: 600,    reconsumoRequired: 160 },
  { pos: 1,  rank: "BRONCE",            minimumFrontals: 2, thresholdPoints: 500,    maximumLargeLeg: 300,    reconsumoRequired: 160 },
  { pos: 0,  rank: "ACTIVO",            minimumFrontals: 0, thresholdPoints: 1,      maximumLargeLeg: 0,      reconsumoRequired: 120 },
]

const RESIDUAL_PERCENTAGES_BY_RANK = {
  "ACTIVO":            [0.15, 0.15, 0,    0,    0,    0,     0,    0,    0   ],
  "BRONCE":            [0.15, 0.15, 0.15, 0.05, 0,    0,     0,    0,    0   ],
  "PLATA":             [0.15, 0.15, 0.15, 0.10, 0.05, 0,     0,    0,    0   ],
  "ORO":               [0.15, 0.15, 0.15, 0.15, 0.05, 0.05,  0,    0,    0   ],
  "RUBÍ":              [0.15, 0.15, 0.15, 0.15, 0.10, 0.05,  0.025, 0,    0   ],
  "ESMERALDA":         [0.15, 0.15, 0.15, 0.15, 0.10, 0.05,  0.025, 0.025, 0.01],
  "DIAMANTE":          [0.15, 0.15, 0.15, 0.15, 0.10, 0.075, 0.025, 0.025, 0.01],
  "DOBLE DIAMANTE":    [0.15, 0.15, 0.15, 0.15, 0.10, 0.075, 0.05,  0.025, 0.01],
  "TRIPLE DIAMANTE":   [0.15, 0.15, 0.15, 0.15, 0.10, 0.075, 0.05,  0.025, 0.025],
  "DIAMANTE IMPERIAL": [0.15, 0.15, 0.15, 0.15, 0.10, 0.075, 0.05,  0.05,  0.025],
  "EMBAJADOR SIFRAH":  [0.15, 0.15, 0.15, 0.15, 0.10, 0.075, 0.05,  0.05,  0.05 ],
  "DIAMANTE CORONA":   [0.15, 0.15, 0.15, 0.15, 0.10, 0.075, 0.05,  0.05,  0.05 ],
}

const GENERATIONAL_BONUS_BY_RANK = {
  "PLATA":             { cutOffRankPos: 1, maxGenerations: 2, percentages: [0.02, 0.01] },
  "ORO":               { cutOffRankPos: 2, maxGenerations: 3, percentages: [0.02, 0.02, 0.01] },
  "RUBÍ":              { cutOffRankPos: 3, maxGenerations: 4, percentages: [0.02, 0.02, 0.02, 0.01] },
  "ESMERALDA":         { cutOffRankPos: 4, maxGenerations: 5, percentages: [0.02, 0.02, 0.02, 0.01, 0.01] },
  "DIAMANTE":          { cutOffRankPos: 5, maxGenerations: 5, percentages: [0.02, 0.02, 0.02, 0.01, 0.01] },
  "DOBLE DIAMANTE":    { cutOffRankPos: 6, maxGenerations: 6, percentages: [0.02, 0.02, 0.02, 0.01, 0.01, 0.01] },
  "TRIPLE DIAMANTE":   { cutOffRankPos: 7, maxGenerations: 6, percentages: [0.02, 0.02, 0.02, 0.01, 0.01, 0.01] },
  "DIAMANTE IMPERIAL": { cutOffRankPos: 8, maxGenerations: 7, percentages: [0.02, 0.02, 0.02, 0.01, 0.01, 0.01, 0.01] },
  "EMBAJADOR SIFRAH":  { cutOffRankPos: 9, maxGenerations: 7, percentages: [0.02, 0.02, 0.02, 0.01, 0.01, 0.01, 0.01] },
  "DIAMANTE CORONA":   { cutOffRankPos: 9, maxGenerations: 7, percentages: [0.02, 0.02, 0.02, 0.01, 0.01, 0.01, 0.01] },
}

const MAX_DEPTH_BY_RANK = {
  "none":              0,
  "ACTIVO":            2,
  "BRONCE":            4,
  "PLATA":             5,
  "ORO":               6,
  "RUBÍ":              7,
  "ESMERALDA":         9,
  "DIAMANTE":          9,
  "DOBLE DIAMANTE":    9,
  "TRIPLE DIAMANTE":   9,
  "DIAMANTE IMPERIAL": 9,
  "EMBAJADOR SIFRAH":  9,
  "DIAMANTE CORONA":   9,
}

const TOPE_PUNTOS = 160.0
const REDUCCION_EXCESO = 0.6

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function isTrue(v) {
  return v === true || v === 1 || v === "1" || v === "true"
}

function fullName(u) {
  if (!u) return ""
  return `${u.name || ""} ${u.lastName || ""}`.trim()
}

function normalizeRankKey(rank) {
  if (!rank) return ""
  const r = String(rank).trim()
  if (r === "" || r.toLowerCase() === "none") return ""
  if (r.toUpperCase() === "RUBI") return "RUBÍ"
  if (r.toUpperCase() === "DIAMANTE CORONA") return "DIAMANTE CORONA"
  if (MAX_DEPTH_BY_RANK[r] != null) return r
  const u = r.toUpperCase()
  if (MAX_DEPTH_BY_RANK[u] != null) return u
  if (RESIDUAL_PERCENTAGES_BY_RANK[r]) return r
  if (RESIDUAL_PERCENTAGES_BY_RANK[u]) return u
  return ""
}

function residualMaxDepth(rank) {
  const k = normalizeRankKey(rank)
  if (!k) return 0
  const maxD = MAX_DEPTH_BY_RANK[k] || 0
  const pcts = RESIDUAL_PERCENTAGES_BY_RANK[k] || []
  if (!pcts.length) return 0
  let lastPay = 0
  for (let i = 0; i < pcts.length; i++) if (pcts[i] > 0) lastPay = i + 1
  if (lastPay === 0) return 0
  return Math.min(maxD, lastPay)
}

function getRankPos(rank) {
  const k = normalizeRankKey(rank)
  if (k === "ACTIVO") return 0
  for (const r of RANKS) if (r.rank === k) return r.pos
  if (k === "DIAMANTE CORONA") return 10
  return 0
}

/* ------------------------------------------------------------------ *
 * Motor de cálculo (espejo de cierre_engine/engine/engine.go)
 * ------------------------------------------------------------------ */

class CierreEngine {
  constructor(users, treeNodes) {
    this.users = new Map()
    for (const u of users || []) {
      this.users.set(u.id, {
        id: u.id,
        dni: u.dni || "",
        name: u.name || "",
        lastName: u.lastName || "",
        plan: u.plan || "",
        points: num(u.points),
        affiliation_points: num(u.affiliation_points),
        total_points: num(u.total_points),
        activated: isTrue(u.activated),
        _activated: isTrue(u._activated),
        rank: u.rank || "none",
        parentId: u.parentId || "",
        residual_volume: 0,
      })
    }

    this.tree = new Map()
    for (const n of treeNodes || []) {
      this.tree.set(n.id, {
        id: n.id,
        parent: n.parent || "",
        childs: Array.isArray(n.childs) ? n.childs.slice() : [],
      })
    }

    this.memoPoints = new Map()
  }

  /** Acumula por usuario Σ (cantidad × ganancia_residual) sobre activaciones aprobadas. */
  applyResidualVolumes(products, activations) {
    const byId = new Map()
    const byCode = new Map()
    for (const p of products || []) {
      const profit = num(p.residual_profit)
      if (p.id) byId.set(p.id, profit)
      if (p.code) byCode.set(p.code, profit)
    }

    const lineProfit = (line) => {
      const own = num(line.residual_profit)
      if (own > 0) return own
      if (line.id && byId.has(line.id)) return byId.get(line.id)
      if (line.code && byCode.has(line.code)) return byCode.get(line.code)
      return 0
    }

    for (const act of activations || []) {
      if (act.status && act.status !== "approved") continue
      const u = this.users.get(act.userId)
      if (!u) continue
      const lines = Array.isArray(act.products) ? act.products : []
      for (const line of lines) {
        const qty = num(line.total)
        if (qty <= 0) continue
        const profit = lineProfit(line)
        if (profit <= 0) continue
        u.residual_volume += qty * profit
      }
    }
  }

  calculateTotalPoints(id) {
    if (this.memoPoints.has(id)) return this.memoPoints.get(id)
    const user = this.users.get(id)
    if (!user) {
      this.memoPoints.set(id, 0)
      return 0
    }
    let total = user.points + user.affiliation_points
    const node = this.tree.get(id)
    if (node) {
      for (const childId of node.childs) {
        total += this.calculateTotalPoints(childId)
      }
    }
    this.memoPoints.set(id, total)
    return total
  }

  effectiveResidualBase(user) {
    if (!user) return 0
    return user.residual_volume > 0 ? user.residual_volume : user.points
  }

  /** Calcula el rango "del cierre" para el usuario, considerando frontales activas y VMP por pierna. */
  calculateRank(id) {
    const user = this.users.get(id)
    if (!user || !user.activated) return "none"

    const node = this.tree.get(id)
    if (!node) return "ACTIVO"

    const legs = []
    for (const childId of node.childs) {
      const p = this.calculateTotalPoints(childId)
      if (p > 0) legs.push(p)
    }
    legs.sort((a, b) => b - a)

    const activeLines = legs.length
    const reconsumo = Math.max(user.points, user.affiliation_points)
    const puntosPersonales = user.points + user.affiliation_points

    for (const r of RANKS) {
      if (reconsumo < r.reconsumoRequired) continue
      if (activeLines < r.minimumFrontals) continue

      let totalWithVMP = 0
      const calcLegs = legs.slice()

      if (calcLegs.length > 0) {
        calcLegs[calcLegs.length - 1] += puntosPersonales
      } else {
        totalWithVMP = puntosPersonales
        if (r.maximumLargeLeg > 0 && totalWithVMP > r.maximumLargeLeg) {
          totalWithVMP = r.maximumLargeLeg
        }
      }

      if (calcLegs.length > 0) {
        const vmp = r.maximumLargeLeg
        for (const legVal of calcLegs) {
          if (vmp > 0 && legVal > vmp) totalWithVMP += vmp
          else totalWithVMP += legVal
        }
      }

      if (totalWithVMP >= r.thresholdPoints) {
        user.total_points = totalWithVMP
        return r.rank
      }
    }

    return "ACTIVO"
  }

  /** Bono residual / regalías por niveles con compresión dinámica. */
  calculateResidualBonus(id, closedRank) {
    const user = this.users.get(id)
    if (!user) return { lines: [], total: 0 }
    if (!closedRank || closedRank === "none") return { lines: [], total: 0 }

    const norm = normalizeRankKey(closedRank)
    if (!norm) return { lines: [], total: 0 }

    const maxDepth = residualMaxDepth(norm)
    const pcts = RESIDUAL_PERCENTAGES_BY_RANK[norm] || []
    if (maxDepth === 0 || pcts.length === 0) return { lines: [], total: 0 }

    const lines = []
    let total = 0

    const collect = (nodeId, currentLevel) => {
      if (currentLevel >= maxDepth) return
      const node = this.tree.get(nodeId)
      if (!node) return

      for (const childId of node.childs) {
        const child = this.users.get(childId)
        if (!child) continue

        const pr = this.effectiveResidualBase(child)
        let nextLevel = currentLevel
        if (pr > 0) nextLevel = currentLevel + 1
        if (nextLevel > maxDepth) continue

        if (pr > 0 && nextLevel <= pcts.length) {
          const pct = pcts[nextLevel - 1]
          if (pct > 0) {
            let bonus
            if (pr <= TOPE_PUNTOS) bonus = pr * pct
            else bonus = TOPE_PUNTOS * pct + (pr - TOPE_PUNTOS) * (pct * REDUCCION_EXCESO)

            if (bonus > 0) {
              total += bonus
              lines.push({
                from_user_id: child.id,
                name: fullName(child),
                dni: child.dni,
                level: nextLevel,
                pr,
                percentage: pct,
                amount: bonus,
              })
            }
          }
        }

        collect(childId, nextLevel)
      }
    }

    collect(id, 0)
    return { lines, total }
  }

  /** Bono generacional VIP (regla de corte por rango). */
  calculateGenerationalBonus(id, closedRank, closedRanksMap) {
    const user = this.users.get(id)
    if (!user || !closedRank || closedRank === "none") {
      return { lines: [], total: 0 }
    }

    const norm = normalizeRankKey(closedRank)
    const cfg = GENERATIONAL_BONUS_BY_RANK[norm]
    if (!cfg) return { lines: [], total: 0 }

    const lines = []
    let total = 0

    const collect = (nodeId, currentGen) => {
      if (currentGen > cfg.maxGenerations) return
      const node = this.tree.get(nodeId)
      if (!node) return

      for (const childId of node.childs) {
        const child = this.users.get(childId)
        if (!child) continue

        const childRank = closedRanksMap.get(childId) || "none"
        const childRankPos = getRankPos(childRank)

        const genToPay = currentGen
        if (
          genToPay > 0 &&
          genToPay <= cfg.maxGenerations &&
          genToPay <= cfg.percentages.length
        ) {
          const pr = child.points
          if (pr > 0) {
            const pct = cfg.percentages[genToPay - 1]
            let bonus
            if (pr <= TOPE_PUNTOS) bonus = pr * pct
            else bonus = TOPE_PUNTOS * pct + (pr - TOPE_PUNTOS) * (pct * REDUCCION_EXCESO)

            if (bonus > 0) {
              total += bonus
              lines.push({
                from_user_id: child.id,
                name: fullName(child),
                dni: child.dni,
                generation: genToPay,
                pr,
                percentage: pct,
                amount: bonus,
              })
            }
          }
        }

        let nextGen = currentGen
        if (childRankPos >= cfg.cutOffRankPos) nextGen = currentGen + 1

        collect(childId, nextGen)
      }
    }

    collect(id, 1)
    return { lines, total }
  }

  /** Bono ahorro Sifrah por plan. */
  calculateSavingsBonus(id) {
    const user = this.users.get(id)
    if (!user) return 0

    let pct
    switch (user.plan) {
      case "basic":    pct = 0.21; break  // Ejecutivo
      case "standard": pct = 0.30; break  // Distribuidor
      case "master":   pct = 0.40; break  // Empresario
      default: return 0
    }

    let adicionales
    if (user.affiliation_points > 0) adicionales = user.points
    else adicionales = user.points - 160

    if (adicionales <= 0) return 0
    const bonus = adicionales * pct
    if (bonus <= 0) return 0
    return bonus
  }

  buildLegDetails(id) {
    const node = this.tree.get(id)
    if (!node) return []
    return node.childs.map((childId, idx) => {
      const child = this.users.get(childId)
      const totalByLeg = this.calculateTotalPoints(childId)
      return {
        idx: idx + 1,
        user_id: childId,
        dni: child ? child.dni : "",
        name: child ? fullName(child) : "",
        total_points: totalByLeg,
        personal_points: child ? child.points + child.affiliation_points : 0,
      }
    })
  }
}

/* ------------------------------------------------------------------ *
 * Carga de inputs desde MongoDB
 * ------------------------------------------------------------------ */

async function loadInputs() {
  const { User, Tree, Product, Activation, Transaction, Period, Closed } = db

  const [users, treeNodes, products, openPeriods, allCloseds] = await Promise.all([
    User.find({}),
    Tree.find({}),
    Product.find({}),
    Period.find({ status: "open" }),
    (async () => {
      try {
        return await Closed.find({})
      } catch (e) {
        return []
      }
    })(),
  ])

  const openKeys = (openPeriods || []).map((p) => p.key).filter(Boolean)

  let lastClosedAt = null
  if (Array.isArray(allCloseds) && allCloseds.length) {
    const sorted = allCloseds
      .slice()
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
    const top = sorted[0]
    if (top && top.date) lastClosedAt = new Date(top.date)
  }

  const allApproved = await Activation.find({ status: "approved" })
  const activations = (allApproved || []).filter((a) => {
    if (openKeys.length > 0) {
      if (a.period_key && openKeys.includes(a.period_key)) return true
      const hasNoPeriod = a.period_key == null || a.period_key === ""
      if (hasNoPeriod && lastClosedAt && a.date && new Date(a.date) >= lastClosedAt) {
        return true
      }
      return false
    }
    if (lastClosedAt) {
      return a.date && new Date(a.date) >= lastClosedAt
    }
    return true
  })

  const virtualTxs = await Transaction.find({ virtual: true })

  return { users, treeNodes, products, activations, virtualTxs }
}

function computeVirtualResets(users, virtualTxs) {
  const byUser = new Map()
  for (const tx of virtualTxs || []) {
    const v = num(tx.value)
    const cur = byUser.get(tx.user_id) || 0
    if (tx.type === "in") byUser.set(tx.user_id, cur + v)
    else if (tx.type === "out") byUser.set(tx.user_id, cur - v)
  }
  const resets = []
  const userById = new Map((users || []).map((u) => [u.id, u]))
  for (const [userId, bal] of byUser.entries()) {
    if (bal <= 0) continue
    const u = userById.get(userId)
    resets.push({
      user_id: userId,
      name: u ? fullName(u) : "",
      dni: u ? u.dni || "" : "",
      amount: bal,
    })
  }
  return resets
}

/* ------------------------------------------------------------------ *
 * Persistencia (un único MongoClient para toda la fase de guardado)
 * ------------------------------------------------------------------ */

async function persistResults({ now, virtualResets, bonusTxs, savingsByUser, usersUpdates, closedDoc, randFn }) {
  const client = new MongoClient(DB_URL, { useUnifiedTopology: true })
  await client.connect()
  try {
    const conn = client.db(DB_NAME)
    const Txs = conn.collection("transactions")
    const Users = conn.collection("users")
    const Closeds = conn.collection("closeds")

    const txDocs = []

    for (const r of virtualResets) {
      txDocs.push({
        id: randFn(),
        date: now,
        user_id: r.user_id,
        type: "out",
        value: r.amount,
        name: "closed reset",
        desc: "Reset de balance al cierre",
        virtual: true,
      })
    }

    for (const t of bonusTxs) {
      txDocs.push({
        id: randFn(),
        date: now,
        virtual: false,
        ...t,
      })
    }

    for (const [userId, bonus] of savingsByUser.entries()) {
      txDocs.push({
        id: randFn(),
        date: now,
        user_id: userId,
        type: "in",
        value: bonus,
        name: "bono ahorro sifrah",
        desc: `Bono ahorro Sifrah (${bonus.toFixed(2)} Bs)`,
        wallet_tipo: "BONO_AHORRO",
        virtual: false,
      })
    }

    if (txDocs.length) {
      await Txs.insertMany(txDocs)
    }

    const bulk = usersUpdates.map((u) => ({
      updateOne: {
        filter: { id: u.id },
        update: {
          $set: u.set,
          $push: { rank_history: u.history },
        },
      },
    }))
    if (bulk.length) {
      await Users.bulkWrite(bulk, { ordered: false })
    }

    await Closeds.insertOne(closedDoc)
  } finally {
    await client.close()
  }
}

/* ------------------------------------------------------------------ *
 * API pública: runCierre({ preview, rand })
 * ------------------------------------------------------------------ */

async function runCierre(opts = {}) {
  const preview = opts.preview !== false
  const randFn = opts.rand || lib.rand.bind(lib)

  const { users, treeNodes, products, activations, virtualTxs } = await loadInputs()

  const engine = new CierreEngine(users, treeNodes)
  engine.applyResidualVolumes(products, activations)

  for (const u of users) engine.calculateTotalPoints(u.id)

  // PASS 1 — rango por usuario
  const closedRanks = new Map()
  for (const u of users) {
    closedRanks.set(u.id, engine.calculateRank(u.id))
  }

  // PASS 2 — bonos
  const previewNodes = []
  const bonusTxs = []
  const savingsByUser = new Map()

  for (const u of users) {
    const rank = closedRanks.get(u.id)
    const totalPoints = engine.memoPoints.get(u.id) || 0

    const res = engine.calculateResidualBonus(u.id, rank)
    const gen = engine.calculateGenerationalBonus(u.id, rank, closedRanks)
    const sav = engine.calculateSavingsBonus(u.id)

    if (sav > 0) savingsByUser.set(u.id, sav)

    if (rank !== "none" || totalPoints > 0 || res.total > 0 || gen.total > 0 || sav > 0) {
      previewNodes.push({
        id: u.id,
        dni: u.dni || "",
        name: fullName(u),
        points: num(u.points),
        _total: totalPoints,
        rank,
        residual_bonus: res.total,
        residual_lines: res.lines,
        generational_bonus: gen.total,
        generational_lines: gen.lines,
        savings_bonus: sav,
        activated: isTrue(u.activated),
        _activated: isTrue(u._activated),
        _pays: [],
        grouped_points_legs: engine.buildLegDetails(u.id),
      })
    }

    if (preview) continue

    for (const l of res.lines) {
      bonusTxs.push({
        user_id: u.id,
        type: "in",
        value: l.amount,
        name: "residual bonus",
        desc: `Bono residual nivel ${l.level} - ${l.name}`,
        from_user_id: l.from_user_id,
        affiliate_name: l.name,
        affiliate_dni: l.dni,
        level: l.level,
        pr: l.pr,
        percentage: l.percentage,
      })
    }
    for (const l of gen.lines) {
      bonusTxs.push({
        user_id: u.id,
        type: "in",
        value: l.amount,
        name: "generational bonus vip",
        desc: `Bono generacional VIP G${l.generation} - ${l.name}`,
        from_user_id: l.from_user_id,
        affiliate_name: l.name,
        affiliate_dni: l.dni,
        level: l.generation,
        generation: l.generation,
        pr: l.pr,
        percentage: l.percentage,
      })
    }
  }

  const virtualResets = computeVirtualResets(users, virtualTxs)

  if (preview) {
    return {
      tree: previewNodes,
      virtual_resets: virtualResets,
      affiliations: [],
      activations: [],
    }
  }

  // ---- Persistencia ----
  const now = new Date()
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

  const previewById = new Map(previewNodes.map((p) => [p.id, p]))
  const usersUpdates = users.map((u) => {
    const rank = closedRanks.get(u.id) || "none"
    const totalPoints = engine.memoPoints.get(u.id) || 0
    const p = previewById.get(u.id)
    const lastResidual = p ? p.residual_bonus : 0
    const lastGenerational = p ? p.generational_bonus : 0
    const lastSavings = savingsByUser.get(u.id) || 0

    return {
      id: u.id,
      set: {
        rank,
        total_points: 0,
        points: 0,
        affiliation_points: 0,
        activated: false,
        _activated: false,
      },
      history: {
        rank,
        date: now,
        period,
        residual_bonus: lastResidual,
        generational_bonus: lastGenerational,
        savings_bonus: lastSavings,
        points: totalPoints,
      },
    }
  })

  const usersSummary = previewNodes
    .filter((p) => p.rank && p.rank !== "none")
    .map((p) => ({
      user_id: p.id,
      name: p.name,
      dni: p.dni,
      rank: p.rank,
      points: p._total,
      total_points: p._total,
      residual_bonus: p.residual_bonus,
      residual_lines: p.residual_lines,
      generational_bonus: p.generational_bonus,
      generational_lines: p.generational_lines,
      savings_bonus: p.savings_bonus,
      grouped_points_legs: p.grouped_points_legs,
    }))

  const closedId = randFn()
  const closedDoc = {
    id: closedId,
    date: now,
    data: {
      users_processed: users.length,
      reset_transactions: virtualResets.length,
      bonus_transactions: bonusTxs.length + savingsByUser.size,
      timestamp: now,
      virtual_balance_resets: virtualResets,
    },
    users: usersSummary,
  }

  await persistResults({
    now,
    virtualResets,
    bonusTxs,
    savingsByUser,
    usersUpdates,
    closedDoc,
    randFn,
  })

  return {
    closed_id: closedId,
    users_processed: users.length,
    reset_count: virtualResets.length,
    residual_total: previewNodes.reduce((s, p) => s + p.residual_bonus, 0),
    generational_total: previewNodes.reduce((s, p) => s + p.generational_bonus, 0),
    savings_total: previewNodes.reduce((s, p) => s + p.savings_bonus, 0),
    bonus_transactions: bonusTxs.length + savingsByUser.size,
    tree: previewNodes,
    virtual_resets: virtualResets,
  }
}

module.exports = {
  CierreEngine,
  runCierre,
  normalizeRankKey,
  residualMaxDepth,
  getRankPos,
  RANKS,
  RESIDUAL_PERCENTAGES_BY_RANK,
  GENERATIONAL_BONUS_BY_RANK,
  MAX_DEPTH_BY_RANK,
  TOPE_PUNTOS,
  REDUCCION_EXCESO,
}
