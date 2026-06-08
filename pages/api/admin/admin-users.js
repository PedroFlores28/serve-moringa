import bcrypt from "bcrypt";
import db from "../../../components/db";
import lib from "../../../components/lib";
import { requireSuperAdmin } from "../../../components/adminAuth";
const {
  ADMIN_MODULES,
  normalizePermissions,
  isSuperAdmin,
} = require("../../../lib/adminPermissions");

const { User, Session } = db;
const { success, error, midd, rand } = lib;

function sanitizeAdmin(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name || "",
    lastName: user.lastName || "",
    dni: user.dni || "",
    email: user.email || "",
    role: user.role || "operator",
    permissions: normalizePermissions(user.permissions),
    adminActive: user.adminActive !== false,
    createdAt: user.createdAt || user.date || null,
    updatedAt: user.updatedAt || null,
    isSuperAdmin: isSuperAdmin(user),
  };
}

async function listAdmins() {
  const users = await User.find({ type: "admin" });
  return (users || [])
    .map(sanitizeAdmin)
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

export default async (req, res) => {
  await midd(req, res);

  if (req.method === "GET") {
    const auth = await requireSuperAdmin(req, res);
    if (!auth) return;

    const admins = await listAdmins();
    return res.json(success({ admins, modules: ADMIN_MODULES }));
  }

  if (req.method === "POST") {
    const auth = await requireSuperAdmin(req, res);
    if (!auth) return;

    const { action } = req.body || {};

    if (action === "create") {
      const { name, username, password, permissions } = req.body || {};
      const fullName = String(name || "").trim();
      const userLogin = String(username || "").trim().toUpperCase();
      const pass = String(password || "");

      if (!fullName) return res.json(error("name required"));
      if (!userLogin) return res.json(error("username required"));
      if (!pass || pass.length < 6) return res.json(error("password min 6 chars"));

      const exists =
        (await User.findOne({ dni: userLogin })) ||
        (await User.findOne({ email: userLogin.toLowerCase() }));
      if (exists) return res.json(error("username already exists"));

      const id = rand();
      const hashed = await bcrypt.hash(pass, 12);
      const now = new Date();

      await User.insert({
        id,
        dni: userLogin,
        name: fullName,
        lastName: "",
        email: `${userLogin.toLowerCase()}@admin.local`,
        password: hashed,
        type: "admin",
        role: "operator",
        permissions: normalizePermissions(permissions),
        adminActive: true,
        affiliated: true,
        activated: true,
        plan: "admin",
        createdAt: now,
        updatedAt: now,
        createdBy: auth.user.id,
      });

      const created = await User.findOne({ id });
      return res.json(success({ admin: sanitizeAdmin(created) }));
    }

    if (action === "update") {
      const { id, name, username, permissions, adminActive } = req.body || {};
      if (!id) return res.json(error("id required"));

      const target = await User.findOne({ id, type: "admin" });
      if (!target) return res.json(error("admin not found"));
      if (isSuperAdmin(target) && String(auth.user.id) !== String(target.id)) {
        return res.json(error("cannot edit superadmin"));
      }

      const patch = { updatedAt: new Date() };
      if (name != null) patch.name = String(name).trim();
      if (username != null) {
        const userLogin = String(username).trim().toUpperCase();
        if (!userLogin) return res.json(error("username required"));
        const clash = await User.findOne({ dni: userLogin });
        if (clash && String(clash.id) !== String(id)) {
          return res.json(error("username already exists"));
        }
        patch.dni = userLogin;
      }
      if (permissions != null) patch.permissions = normalizePermissions(permissions);
      if (adminActive != null) patch.adminActive = !!adminActive;

      await User.update({ id }, patch);
      const updated = await User.findOne({ id });
      return res.json(success({ admin: sanitizeAdmin(updated) }));
    }

    if (action === "update_password") {
      const { id, password } = req.body || {};
      if (!id) return res.json(error("id required"));
      const pass = String(password || "");
      if (!pass || pass.length < 6) return res.json(error("password min 6 chars"));

      const target = await User.findOne({ id, type: "admin" });
      if (!target) return res.json(error("admin not found"));

      const hashed = await bcrypt.hash(pass, 12);
      await User.update({ id }, { password: hashed, updatedAt: new Date() });

      await Session.updateMany(
        { id },
        { revokedAt: new Date(), revokedBy: auth.user.id, closedReason: "password_reset" }
      );

      return res.json(success({ ok: true }));
    }

    return res.json(error("invalid action"));
  }

  return res.status(405).json(error("method not allowed"));
};
