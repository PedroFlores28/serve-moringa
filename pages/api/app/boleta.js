import db from "../../../components/db";
import lib from "../../../components/lib";

const { User, Session, Activation, Affiliation, Office } = db;
const { error, success, midd } = lib;

export default async (req, res) => {
  await midd(req, res);

  if (req.method !== "GET") {
    return res.status(405).json(error("Method not allowed"));
  }

  let { session, id, type } = req.query;
  if (!id) return res.json(error("Missing order ID"));

  session = await Session.findOne({ value: session });
  if (!session) return res.json(error("invalid session"));

  const user = await User.findOne({ id: session.id });
  if (!user) return res.json(error("invalid session"));

  try {
    let doc = null;
    let total = 0;
    let products = [];

    if (type === "affiliation") {
      doc = await Affiliation.findOne({ id, userId: user.id });
      if (!doc) return res.json(error("Affiliation not found"));
      total =
        doc.type === "upgrade"
          ? (doc.difference && doc.difference.amount) || 0
          : (doc.plan && doc.plan.amount) || doc.price || 0;
    } else {
      doc = await Activation.findOne({ id, userId: user.id });
      if (!doc) return res.json(error("Activation not found"));
      total = doc.price || 0;
    }

    const office = await Office.findOne({ id: doc.office });

    if (doc.products && Array.isArray(doc.products)) {
      products = doc.products
        .filter((p) => p && (p.total || 0) > 0)
        .map((p) => {
          const qty = p.total || 0;
          const unitPrice = p.price || 0;
          return {
            name: p.name,
            qty,
            unitPrice,
            total: unitPrice * qty,
          };
        });
    }

    const dbName = process.env.DB_NAME || "sifrah";
    const isMoringa = dbName.toLowerCase().includes("moringa");
    const brand = isMoringa ? "CLASS MORINGA" : "SIFRAH";
    const currency = "Bs.";

    return res.json(
      success({
        orderData: {
          id: doc.id,
          orderNumber: doc.id,
          date: doc.date,
          total,
          payMethod: doc.pay_method,
          brand,
          currency,
          type: type === "affiliation" ? "affiliation" : "activation",
        },
        clientData: {
          fullName: `${user.name} ${user.lastName}`.trim(),
          code: user.dni || "",
          branch: office ? office.name : "OFICINA PRINCIPAL",
        },
        products,
      })
    );
  } catch (err) {
    console.error("Error in app boleta API:", err);
    return res.status(500).json(error("Database error"));
  }
};
