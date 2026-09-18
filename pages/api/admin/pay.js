import db  from "../../../components/db"
import lib from "../../../components/lib"
import { requireAdmin } from "../../../components/adminAuth"

const { Transaction, User } = db
const { error, success, midd, rand } = lib


export default async (req, res) => {
  await midd(req, res)

  const auth = await requireAdmin(req, res)
  if (!auth) return

  if(req.method == 'GET') {
    const users = await User.find({})

    let pays = await Transaction.find({ name: 'pay' })

    for (let p of pays) {
      const user = users.find(e => e.id == p.user_id)
      // Proyección explícita: nunca exponer el documento completo (incluye el hash de password)
      p.user = user ? { id: user.id, dni: user.dni, name: user.name, lastName: user.lastName } : null
    }

    return res.json(success({
      pays,
    }))
  }

  if(req.method == 'POST') {

    const { dni, amount, desc } = req.body

    if(typeof dni !== 'string') return res.json(error('dni not found'))

    const value = parseFloat(amount)
    if(!Number.isFinite(value) || value <= 0) return res.json(error('invalid amount'))

    const user = await User.findOne({ dni: dni.trim() })

    if(!user) return res.json(error('dni not found'))

    await Transaction.insert({
      id:      rand(),
      date:    new Date(),
      user_id: user.id,
      type:   'in',
      value,
      desc,
      virtual: false,
      name: 'pay',
    })

    return res.json(success())
  }
}
