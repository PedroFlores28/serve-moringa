import db from "../../../components/db"
import lib from "../../../components/lib"

const { User, Session, Transaction, Tree, Banner, Plan, DashboardConfig, Activation, Affiliation } = db
const { error, success, acum, midd, model } = lib
const { computeMonthlyActivity } = require("../../../lib/monthlyActivity")
const { computeRankCycleProgress } = require("../../../lib/rankCycles")
const { normalizePlanList } = require("../../../lib/planNames")
const { getAffiliationPlans } = require("../../../lib/planCatalog")

const D = ['id', 'name', 'lastName', 'affiliated', 'activated', 'tree', 'email', 'phone', 'address', 'rank', 'points', 'parentId', 'total_points']
export default async (req, res) => {
  await midd(req, res)

  let { session } = req.query




  // valid session
  session = await Session.findOne({ value: session })
  if (!session) return res.json(error('invalid session'))

  // GET plans
  const plans = normalizePlanList(getAffiliationPlans(await Plan.find({})));


  // get USER
  const user = await User.findOne({ id: session.id })

  let directs = await User.find({ parentId: user.id })

  directs = directs.map(direct => {
    const d = model(direct, D)
    return { ...d }
  })

  const node = await Tree.findOne({ id: user.id })
  const childs = node && Array.isArray(node.childs) ? node.childs : []

  let frontals = childs.length
    ? await User.find({ id: { $in: childs } })
    : []
  // frontals = frontals.filter(e => e.parentId != user.id)
  console.log({ frontals })

  // get transactions
  const transactions = await Transaction.find({ user_id: user.id, virtual: { $in: [null, false] } })
  const virtualTransactions = await Transaction.find({ user_id: user.id, virtual: true })

  const ins = transactions.filter(t => t.type === 'in' && t.wallet_tipo !== 'BONO_AHORRO').reduce((sum, t) => sum + Number(t.value || 0), 0)
  const outs = transactions.filter(t => t.type === 'out' && t.wallet_tipo !== 'BONO_AHORRO').reduce((sum, t) => sum + Number(t.value || 0), 0)
  const sifrahIns = transactions.filter(t => t.type === 'in' && t.wallet_tipo === 'BONO_AHORRO').reduce((sum, t) => sum + Number(t.value || 0), 0)
  const sifrahOuts = transactions.filter(t => t.type === 'out' && t.wallet_tipo === 'BONO_AHORRO').reduce((sum, t) => sum + Number(t.value || 0), 0)
  
  const insVirtual = acum(virtualTransactions, { type: 'in' }, 'value')
  const outsVirtual = acum(virtualTransactions, { type: 'out' }, 'value')

  const totalEarned = (Number(ins) || 0) + (Number(insVirtual) || 0)
  const availableBalance = (Number(ins) || 0) - (Number(outs) || 0)
  const unavailableBalance = (Number(insVirtual) || 0) - (Number(outsVirtual) || 0)


  const banner = await Banner.findOne({})

  // GET dashboard config (Bono Viaje text) - Primero buscar configuración específica del usuario
  let dashboardConfig = await DashboardConfig.findOne({ id: 'travel_bonus', userId: user.id })

  // Si no existe configuración específica del usuario, buscar la configuración global
  // (configuraciones que no tienen el campo userId)
  if (!dashboardConfig) {
    dashboardConfig = await DashboardConfig.findOne({
      id: 'travel_bonus',
      userId: { $exists: false }
    })
  }

  // Si no existe ninguna configuración, crear una global por defecto
  if (!dashboardConfig) {
    dashboardConfig = {
      id: 'travel_bonus',
      text: 'Tu progreso hacia el Bono Viaje se actualizará próximamente. ¡Sigue trabajando para alcanzar tus objetivos!'
    }
    await DashboardConfig.insert(dashboardConfig)
  }

  // Red completa y actividad mensual
  let n_affiliates_total = 0
  let monthlyActivity = {
    monthlyPurchaseBs: 0,
    personalProductCount: 0,
    groupProductCount: 0,
    monthlyActive: false,
    affiliatedThisMonth: false,
    minActivePurchaseBs: 360,
  }

  const allTree = await Tree.find({})
  const treeMap = allTree.reduce((a, b) => { a[b.id] = b; return a }, {})

  if (node) {
    function countNetwork(id) {
      if (!treeMap[id]) return 0
      const treeNode = treeMap[id]
      let count = 0
      if (treeNode.childs && treeNode.childs.length) {
        treeNode.childs.forEach(childId => {
          count += 1 + countNetwork(childId)
        })
      }
      return count
    }

    n_affiliates_total = countNetwork(user.id)
  }

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const networkIds = []
  function collectIds(id) {
    const n = treeMap[id]
    if (!n || !n.childs) return
    n.childs.forEach((cid) => {
      networkIds.push(cid)
      collectIds(cid)
    })
  }
  collectIds(user.id)
  const activationUserIds = [user.id, ...networkIds]

  const [networkActivations, userAffiliations] = await Promise.all([
    Activation.find({
      userId: { $in: activationUserIds },
      status: "approved",
      $or: [
        { date: { $gte: monthStart } },
        { approved_at: { $gte: monthStart } },
      ],
    }),
    Affiliation.find({ userId: user.id, status: "approved" }),
  ])

  monthlyActivity = computeMonthlyActivity(
    user,
    allTree,
    userAffiliations,
    networkActivations
  )

  // Determine current provisional rank based on real performance
  const rankRequirements = {
    'star': { points: 300, childs: 2 },
    'master': { points: 900, childs: 2 },
    'silver': { points: 1800, childs: 3 },
    'gold': { points: 3300, childs: 3 },
    'sapphire': { points: 9000, childs: 4 },
    'RUBI': { points: 21000, childs: 4 },
    'DIAMANTE': { points: 60000, childs: 5 },
    'DOBLE DIAMANTE': { points: 115000, childs: 5 },
    'TRIPLE DIAMANTE': { points: 225000, childs: 6 },
    'DIAMANTE ESTRELLA': { points: 520000, childs: 6 }
  }

  const rankOrder = ['none', 'active', 'star', 'master', 'silver', 'gold', 'sapphire', 'RUBI', 'DIAMANTE', 'DOBLE DIAMANTE', 'TRIPLE DIAMANTE', 'DIAMANTE ESTRELLA']

  let provisionalRank = (user.activated || user._activated) ? 'active' : 'none'
  const currentTotalPoints = user.total_points || 0
  const currentDirects = directs.length || 0

  // Check highest met rank
  for (let i = 2; i < rankOrder.length; i++) {
    const rName = rankOrder[i]
    const req = rankRequirements[rName]
    if (currentTotalPoints >= req.points && currentDirects >= req.childs) {
      provisionalRank = rName
    } else {
      break // Doesn't meet this or higher
    }
  }

  const provisionalRankIndex = rankOrder.indexOf(provisionalRank)
  const nextRankName = provisionalRankIndex < rankOrder.length - 1 ? rankOrder[provisionalRankIndex + 1] : null

  const rankCycle = computeRankCycleProgress(
    nextRankName || "star",
    monthlyActivity.groupProductCount,
    currentDirects
  )

  let nextRankPercentage = rankCycle.overallPct
  if (nextRankName === "active") {
    nextRankPercentage = (user.activated || user._activated) ? 100 : 0
  }

  // response
  return res.json(success({
    name: user.name,
    lastName: user.lastName,
    affiliated: user.affiliated,
    _activated: user._activated,
    activated: user.activated,
    plan: user.plan,
    country: user.country,
    photo: user.photo,
    tree: user.tree,
    email: user.email,
    token: user.token,
    address: user.address,
    directs,
    frontals,

    banner,
    ins,
    insVirtual,
    outs,
    balance: availableBalance,
    sifrahBalance: (sifrahIns - sifrahOuts),
    _balance: unavailableBalance,
    totalEarned,
    availableBalance,
    unavailableBalance,
    rank: user.rank,
    points: user.points,
    plans,
    total_points: user.total_points, // <-- Agregar todos los planes a la respuesta
    travelBonusText: dashboardConfig.text || 'Tu progreso hacia el Bono Viaje se actualizará próximamente. ¡Sigue trabajando para alcanzar tus objetivos!',
    n_affiliates_total,
    nextRankName,
    nextRankPercentage,
    provisionalRank,
    monthlyPurchaseBs: monthlyActivity.monthlyPurchaseBs,
    personalProductCount: monthlyActivity.personalProductCount,
    groupProductCount: monthlyActivity.groupProductCount,
    monthlyActive: monthlyActivity.monthlyActive,
    affiliatedThisMonth: monthlyActivity.affiliatedThisMonth,
    minActivePurchaseBs: monthlyActivity.minActivePurchaseBs,
    rankCycle,
  }))
}
