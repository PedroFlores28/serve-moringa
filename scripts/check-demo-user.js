require("dotenv").config({ path: require("path").join(__dirname, "../../app/.env") });
const bcrypt = require("bcrypt");
const { MongoClient } = require("mongodb");

async function main() {
  const url = process.env.DB_URL || process.env.MONGODB_URI;
  const dbName = process.env.DB_NAME || "moringa";
  const client = await MongoClient.connect(url, { useUnifiedTopology: true });
  const db = client.db(dbName);

  const dni = "88001234";
  const user = await db.collection("users").findOne({ dni });
  console.log("user string dni:", !!user);

  if (!user) {
    const num = await db.collection("users").findOne({ dni: Number(dni) });
    console.log("user numeric dni:", !!num);
    const list = await db
      .collection("users")
      .find({ $or: [{ dni: /88001234/ }, { id: "classdemo2026" }] })
      .toArray();
    console.log(
      "matches:",
      list.map((u) => ({ id: u.id, dni: u.dni, type: typeof u.dni }))
    );
    await client.close();
    return;
  }

  console.log({
    id: user.id,
    dni: user.dni,
    dniType: typeof user.dni,
    affiliated: user.affiliated,
    plan: user.plan,
    hasPassword: !!user.password,
    passwordHashPrefix: String(user.password || "").slice(0, 7),
  });

  const ok = await bcrypt.compare("123456", user.password || "");
  console.log("password 123456 match:", ok);

  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
