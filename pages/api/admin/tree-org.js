import db from "../../../components/db"
import lib from "../../../components/lib"

const { resolveTreeRootId } = require("../../../lib/treeRoot")

const { Tree, User } = db
const { success, midd, map, error } = lib


let tree
let l

function count(id, n) {

  let childs = tree[id].childs
      childs = childs.filter(a => a != null)

  if (n > l) { l = n }

  childs.forEach(id => count(id, n + 1))
}

let _tree


function find(id, n) {
  // console.log({ id, n })
  if(n > l || n > 4) return

  // const el =
  // const childs = (!id) ? [null, null, null] : tree[id].childs
  let childs

  if(id) {
    childs = tree[id].childs
    _tree[n].push({ id: tree[id].id, name: tree[id].name.split(' ')[0] })
  } else {
    childs = [null, null]
    _tree[n].push(null)
  }

  // _tree[n].push(id)

  childs.forEach(id => find(id, n + 1))
}

export default async (req, res) => {

  // secure middleware
  await midd(req, res)

  // get tree
  tree = await Tree.find()

  const ids = tree.map(e => e.id)

  let users = await User.find({ id: { $in: ids } })
  users = map(users)
  // console.log({ users })

  tree.forEach(el => {
    const user = users.get(el.id)
    el.name = user && user.name ? user.name : ""
  })

  const treeUsers = await User.find({ tree: true })
  const id = resolveTreeRootId(tree, {
    preferUserIds: treeUsers.map((u) => u.id),
  })
  if (!id) {
    return res.json(error("no se encontró la raíz del árbol"))
  }

  tree = tree.reduce((a, b) => { a[`${b.id}`] = b; return a }, {})
  if (!tree[id]) {
    return res.json(error("no se encontró la raíz del árbol"))
  }

  l = 0
  count(id, 0)
  // console.log({ l })

  _tree = []
  for (var i = 0; i <= l; i++) _tree.push([])

  find(id, 0)
  // console.log({ _tree })

  // response
  return res.json(success({ tree: _tree }))
}
