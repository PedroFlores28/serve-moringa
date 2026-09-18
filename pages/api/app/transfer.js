import bcrypt from 'bcrypt'
import db     from "../../../components/db"
import lib    from "../../../components/lib"

const { User, Session, Transaction, Collect } = db
const { error, success, midd, acum, rand } = lib

const handler = async (req, res) => {

  let { session } = req.query

  // valid session
  session = await Session.findOne({ value: session })
  if(!session) return res.json(error('invalid session'))

  // get user
  const user = await User.findOne({ id: session.id })

  // get transactions
  const transactions = await Transaction.find({ user_id: user.id, virtual: {$in: [null, false]} })

  const ins  = acum(transactions, {type: 'in' }, 'value')
  const outs = acum(transactions, {type: 'out'}, 'value')
  const balance = ins - outs


  if(req.method == 'GET') {

    // response
    return res.json(success({
      name:       user.name,
      lastName:   user.lastName,
      affiliated: user.affiliated,
     _activated:  user._activated,
      activated:  user.activated,
      plan:       user.plan,
      country:    user.country,
      photo:      user.photo,
      tree:       user.tree,

      balance,
    }))
  }

  if(req.method == 'POST') {

    const { dni, amount, desc, type } = req.body

    if (typeof dni !== 'string') return res.json(error('invalid dni'))

    const _user = await User.findOne({ dni: dni.trim() })


    if(type == 'validate') {

      if(!_user || _user.id == user.id) return res.json(error('invalid dni'))

      return res.json(success({
        _name: _user.name + ' ' + _user.lastName,
        _photo: _user.photo,
      }))
    }

    if(type == 'send') {
      const { password } = req.body

      if(!_user || _user.id == user.id) return res.json(error('invalid dni'))

      if(typeof password !== 'string' || !await bcrypt.compare(password, user.password))
        return res.json(error('invalid password'))

      const value = Number(amount)
      if(!Number.isFinite(value) || value <= 0) return res.json(error('invalid amount'))
      if(value > balance) return res.json(error('amount exceeds the balance'))

      await Transaction.insert({
        date:     new Date(),
        user_id:  user.id,
       _user_id: _user.id,
        type:    'out',
        value:    value,
        name:    'wallet transfer',
        desc,
      })

      await Transaction.insert({
        date:     new Date(),
        user_id: _user.id,
       _user_id:  user.id,
        type:    'in',
        value:    value,
        name:    'wallet transfer',
        desc,
      })

      return res.json(success())
    }
  }
}

export default async (req, res) => { await midd(req, res); return handler(req, res) }
