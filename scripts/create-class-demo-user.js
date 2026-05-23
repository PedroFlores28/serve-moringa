/**
 * Crea usuario demo CLASS en MongoDB (listo para login).
 * Uso: node scripts/create-class-demo-user.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "../../app/.env") });
const bcrypt = require("bcrypt");
const { MongoClient } = require("mongodb");

const DEMO = {
  id: "classdemo2026",
  dni: "88001234",
  email: "class.demo@moringa.test",
  passwordPlain: "123456",
  token: "CL8801",
  affiliationId: "affclassdemo2026",
};

async function main() {
  const url = process.env.DB_URL || process.env.MONGODB_URI;
  const dbName = process.env.DB_NAME || "moringa";
  const client = await MongoClient.connect(url, { useUnifiedTopology: true });
  const db = client.db(dbName);

  const existing = await db.collection("users").findOne({
    $or: [{ dni: DEMO.dni }, { id: DEMO.id }, { email: DEMO.email }],
  });

  if (existing) {
    console.log("[INFO] Ya existe un usuario con ese DNI/id/email:");
    console.log({ id: existing.id, dni: existing.dni, email: existing.email });
    await client.close();
    return;
  }

  const sponsor =
    (await db.collection("users").findOne({ affiliated: true, type: { $ne: "admin" } })) ||
    (await db.collection("users").findOne({ type: "admin" })) ||
    (await db.collection("users").findOne({}));

  if (!sponsor) {
    throw new Error("No hay usuarios en la BD para usar como patrocinador.");
  }

  const classPlan =
    (await db.collection("plans").findOne({ amount: 480 })) ||
    (await db.collection("plans").findOne({ id: "class" })) ||
    (await db.collection("plans").findOne({ id: "basic" })) ||
    (await db.collection("plans").findOne({ name: /class/i }));

  if (!classPlan) {
    throw new Error('No se encontró plan CLASS (480) en colección "plans".');
  }

  const password = await bcrypt.hash(DEMO.passwordPlain, 12);
  const now = new Date();

  const userDoc = {
    id: DEMO.id,
    date: now,
    country: "BO",
    dni: DEMO.dni,
    name: "Demo",
    lastName: "Class",
    birthdate: "1990-01-15",
    email: DEMO.email,
    phone: "70000001",
    password,
    department: "La Paz",
    province: "La Paz",
    district: "Centro",
    parentId: sponsor.id,
    affiliated: true,
    _activated: true,
    activated: true,
    plan: classPlan.id,
    n: classPlan.n || 1,
    affiliation_points: classPlan.affiliation_points || 480,
    affiliation_date: now,
    points: 0,
    total_points: classPlan.affiliation_points || 480,
    rank: "none",
    photo: "https://ik.imagekit.io/asu/impulse/avatar_cWVgh_GNP.png",
    tree: true,
    token: DEMO.token,
  };

  const affiliationDoc = {
    id: DEMO.affiliationId,
    date: now,
    userId: DEMO.id,
    status: "approved",
    delivered: true,
    approved_at: now,
    period_key: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
    period_label: "Mayo 2026",
    type: "affiliation",
    office: "1",
    products: [],
    amounts: [classPlan.amount || 480, 0, 0],
    transactions: [],
    use_balance: false,
    plan: {
      id: classPlan.id,
      name: classPlan.name,
      amount: classPlan.amount,
      affiliation_points: classPlan.affiliation_points,
      max_products: classPlan.max_products,
      n: classPlan.n,
      kit: classPlan.kit,
      img: classPlan.img,
    },
  };

  await db.collection("users").insertOne(userDoc);
  await db.collection("affiliations").insertOne(affiliationDoc);

  const treeNode = await db.collection("tree").findOne({ id: DEMO.id });
  if (!treeNode) {
    await db.collection("tree").insertOne({
      id: DEMO.id,
      parent: sponsor.id,
      childs: [],
    });
    await db.collection("tree").updateOne(
      { id: sponsor.id },
      { $addToSet: { childs: DEMO.id } }
    );
  }

  console.log("[OK] Usuario CLASS demo creado:");
  console.log({
    dni: DEMO.dni,
    password: DEMO.passwordPlain,
    plan: classPlan.id,
    planName: classPlan.name,
    sponsorId: sponsor.id,
    sponsorDni: sponsor.dni,
  });

  await client.close();
}

main().catch((err) => {
  console.error("[ERROR]", err.message || err);
  process.exit(1);
});
