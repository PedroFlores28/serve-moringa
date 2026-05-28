import db from "../../../components/db"
import lib from "../../../components/lib"

const { Office, Product, Recharge } = db
const { success, midd } = lib

export default async (req, res) => {
  await midd(req, res)

  if(req.method == 'GET') {
    try {
      // Usuarios solo ven oficinas activas
      let offices = await Office.find({ active: { $ne: false } })
      let products = await Product.find({})
      let recharges = await Recharge.find({})

      // Procesar oficinas como en el endpoint de admin pero solo las activas
      for (let office of offices) {
        office.products = Array.isArray(office.products) ? office.products : []
        office.recharges = Array.isArray(office.recharges) ? office.recharges : []

        for (let product of products) {
          const p = office.products.find(e => e && e.id == product.id)

          if(!p)
            office.products.push({
              id: product.id,
              total: 0,
            })
        }
      }

      offices = offices.map(office => {
        office.products = office.products.map(p => {
          const product = products.find(e => e.id == p.id)
          return {
            ...p,
            name: product ? product.name : (p.name || "Producto no disponible"),
          }
        })

        office.recharges = recharges.filter(r => r.office_id == office.id)
        return office
      })

      return res.json(success({ offices }))
    } catch (error) {
      console.error("Error en /api/app/offices:", error)
      return res.status(500).json({ error: true, message: "Error interno del servidor" })
    }
  }

  // Los usuarios no pueden hacer POST/DELETE/PATCH a oficinas
  return res.status(403).json({ error: true, message: 'No autorizado' })
} 