import db from "../../../components/db";
import lib from "../../../components/lib";
import { requireAdmin } from "../../../components/adminAuth";

export default async (req, res) => {
  await lib.midd(req, res);
  const auth = await requireAdmin(req, res);
  if (!auth) return;

  if (req.method !== "GET") {
    return res.status(405).json(lib.error("Method not allowed"));
  }

  const { id, type } = req.query;
  if (!id) {
    return res.json(lib.error("Missing order ID"));
  }

  try {
    let doc = null;
    let total = 0;
    let products = [];

    if (type === "affiliation") {
      doc = await db.Affiliation.findOne({ id });
      if (!doc) return res.json(lib.error("Affiliation not found"));
      total = doc.type === "upgrade" 
        ? (doc.difference && doc.difference.amount) || 0 
        : (doc.plan && doc.plan.amount) || 0;
    } else {
      doc = await db.Activation.findOne({ id });
      if (!doc) return res.json(lib.error("Activation not found"));
      total = doc.price || 0;
    }

    const user = await db.User.findOne({ id: doc.userId });
    if (!user) return res.json(lib.error("User not found"));

    const office = await db.Office.findOne({ id: doc.office });

    if (doc.products && Array.isArray(doc.products)) {
      products = doc.products.map((p) => {
        const qty = p.total || 0;
        const unitPrice = p.price || 0;
        return {
          name: p.name,
          qty,
          unitPrice,
          total: unitPrice * qty
        };
      });
    }

    const dbName = process.env.DB_NAME || "sifrah";
    const isMoringa = dbName.toLowerCase().includes("moringa");
    const brand = isMoringa ? "CLASS MORINGA" : "SIFRAH";
    const currency = "Bs.";

    return res.json(
      lib.success({
        orderData: {
          id: doc.id,
          orderNumber: doc.id,
          date: doc.date,
          total,
          payMethod: doc.pay_method,
          brand,
          currency
        },
        clientData: {
          fullName: `${user.name} ${user.lastName}`.trim(),
          code: user.dni || "",
          branch: office ? office.name : "OFICINA PRINCIPAL"
        },
        products
      })
    );
  } catch (err) {
    console.error("Error in boleta API:", err);
    return res.status(500).json(lib.error("Database error"));
  }
};
