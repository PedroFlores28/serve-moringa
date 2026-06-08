/**
 * Catálogo de módulos del panel administrativo Class Moringa.
 */

const ADMIN_MODULES = [
  { id: "dashboard", label: "Dashboard" },
  { id: "users", label: "Usuarios" },
  { id: "rank-history", label: "Historial de Rangos" },
  { id: "affiliations", label: "Afiliaciones" },
  { id: "products", label: "Productos" },
  { id: "transactions", label: "Transacciones" },
  { id: "collects", label: "Retiros" },
  { id: "kadex", label: "Inventario" },
  { id: "banner", label: "Banner" },
  { id: "materials", label: "Materiales" },
  { id: "tree", label: "Red" },
  { id: "payments", label: "Pagos" },
  { id: "offices", label: "Oficinas" },
  { id: "operations", label: "Compras" },
  { id: "closed", label: "Cierres" },
  { id: "bonus-reports", label: "Bonos" },
  { id: "periods", label: "Periodos" },
  { id: "sessions", label: "Sesiones" },
  { id: "admin-users", label: "Administradores" },
];

const MODULE_IDS = new Set(ADMIN_MODULES.map((m) => m.id));

function isSuperAdmin(user) {
  if (!user || user.type !== "admin") return false;
  if (user.role === "superadmin") return true;
  if (String(user.id) === "admin") return true;
  if (String(user.dni || "").toUpperCase() === "MORINGA") return true;
  const perms = user.permissions;
  if (!Array.isArray(perms) || perms.length === 0) return true;
  return false;
}

function normalizePermissions(list) {
  if (!Array.isArray(list)) return [];
  return [...new Set(
    list
      .map((p) => String(p).trim())
      .filter((p) => MODULE_IDS.has(p) && p !== "admin-users")
  )];
}

function hasPermission(user, moduleId) {
  if (!user || user.type !== "admin") return false;
  if (user.adminActive === false) return false;
  if (isSuperAdmin(user)) return true;
  const perms = normalizePermissions(user.permissions);
  return perms.includes(String(moduleId));
}

function buildAdminAccount(user) {
  if (!user) return null;
  const superAdmin = isSuperAdmin(user);
  return {
    id: user.id,
    dni: user.dni,
    name: user.name,
    lastName: user.lastName || "",
    email: user.email || "",
    type: user.type,
    role: superAdmin ? "superadmin" : user.role || "operator",
    permissions: superAdmin ? ADMIN_MODULES.map((m) => m.id) : normalizePermissions(user.permissions),
    adminActive: user.adminActive !== false,
    isSuperAdmin: superAdmin,
  };
}

module.exports = {
  ADMIN_MODULES,
  MODULE_IDS,
  isSuperAdmin,
  normalizePermissions,
  hasPermission,
  buildAdminAccount,
};
