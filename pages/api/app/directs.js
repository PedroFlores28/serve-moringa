const cors = require('micro-cors')()

import db  from "../../../components/db"
import lib from "../../../components/lib"

const { User, Session, Affiliation, Tree, Activation } = db
const { error, success, _ids, _map, model } = lib
const { computeMonthlyActivity } = require("../../../lib/monthlyActivity")

// models
// const D = ['id', 'name', 'lastName', 'email', 'phone', 'affiliated', 'activated', 'affiliationDate']
const D = ['id', 'name', 'lastName', 'affiliated', 'activated', 'tree', 'email', 'phone', 'points', 'token']

function mapDirectUser(direct, allTree, allAffiliations, allActivations) {
  const d = model(direct, D)
  d.points = Number(d.points !== undefined ? d.points : direct.points) || 0
  const activity = computeMonthlyActivity(direct, allTree, allAffiliations, allActivations)
  d.personalProductCount = activity.personalProductCount || 0
  d.groupProductCount = activity.groupProductCount || 0
  return { ...d }
}


const directs = async (req, res) => {

  let { session } = req.query

  // valid session
  session = await Session.findOne({ value: session })
  if(!session) return res.json(error('invalid session'))

  // get USER
  const user = await User.findOne({ id: session.id })

  const allTree = await Tree.find({})

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  // Get all approved activations and affiliations for the current month
  const [allActivations, allAffiliations] = await Promise.all([
    Activation.find({
      status: "approved",
      $or: [
        { date: { $gte: monthStart } },
        { approved_at: { $gte: monthStart } },
      ],
    }),
    Affiliation.find({
      status: "approved",
      $or: [
        { date: { $gte: monthStart } },
        { approved_at: { $gte: monthStart } },
      ],
    }),
  ])

  // find directs
  let directs = await User.find({ parentId: user.id })

  directs = directs.map((direct) =>
    mapDirectUser(direct, allTree, allAffiliations, allActivations)
  )

  let sponsor = null
  if (user.parentId) {
    const parentUser = await User.findOne({ id: user.parentId })
    if (parentUser) {
      sponsor = mapDirectUser(parentUser, allTree, allAffiliations, allActivations)
    }
  }

  const node = await Tree.findOne({ id: user.id })
  console.log({ node })

  const childs = node ? node.childs : []
  console.log({ childs })

  let frontals = await User.find({ id: { $in: childs } })
  // frontals = frontals.filter(e => e.parentId != user.id)
  console.log({ frontals })

  frontals = frontals.map((frontal) =>
    mapDirectUser(frontal, allTree, allAffiliations, allActivations)
  )

  // response
  return res.json(success({
    name:       user.name,
    lastName:   user.lastName,
    affiliated: user.affiliated,
    _activated: user._activated,
    activated:  user.activated,
    plan:       user.plan,
    country:    user.country,
    photo:      user.photo,
    tree:       user.tree,
    token:      user.token,

    id:       user.id,
    directs,
    frontals,
    sponsor,
    // branch:   user.branch,
    // childs,
    // names,
  }))
}

module.exports = cors(directs)
