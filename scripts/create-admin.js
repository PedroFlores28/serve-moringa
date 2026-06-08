require("dotenv").config();

const bcrypt = require("bcrypt");
const db = require("../components/db");

const { User } = db;

const MAIN_ADMIN = {
  id: "admin",
  dni: "MORINGA",
  name: "Class Moringa",
  email: "admin@classmoringa.local",
  passwordPlain: process.env.ADMIN_PASSWORD || "moringa2026",
};

async function main() {
  const password = await bcrypt.hash(String(MAIN_ADMIN.passwordPlain), 12);

  const existing =
    (await User.findOne({ id: MAIN_ADMIN.id })) ||
    (await User.findOne({ dni: MAIN_ADMIN.dni })) ||
    (await User.findOne({ dni: "ADMIN" })) ||
    (await User.findOne({ type: "admin", role: "superadmin" }));

  const patch = {
    id: MAIN_ADMIN.id,
    dni: MAIN_ADMIN.dni,
    name: MAIN_ADMIN.name,
    email: MAIN_ADMIN.email,
    type: "admin",
    affiliated: true,
    activated: true,
    plan: "admin",
    role: "superadmin",
    permissions: [],
    adminActive: true,
    password,
    updatedAt: new Date(),
  };

  if (existing && existing.id) {
    await User.updateOne({ id: existing.id }, patch);
    console.log("[OK] Admin principal actualizado:", {
      id: existing.id,
      dni: MAIN_ADMIN.dni,
      password: MAIN_ADMIN.passwordPlain,
    });
    return;
  }

  await User.insert({
    ...patch,
    lastName: "",
    date: new Date(),
  });

  console.log("[OK] Admin principal creado:", {
    id: MAIN_ADMIN.id,
    dni: MAIN_ADMIN.dni,
    password: MAIN_ADMIN.passwordPlain,
  });
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[ERROR] No se pudo crear/actualizar admin:", err);
    process.exit(1);
  });
