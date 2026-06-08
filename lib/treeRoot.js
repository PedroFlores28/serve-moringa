function isRootNode(node) {
  if (!node) return false;
  const parent = node.parent;
  return parent == null || parent === "" || parent === undefined;
}

function countDescendants(rootId, byId) {
  const root = byId.get(rootId);
  if (!root || !Array.isArray(root.childs)) return 0;

  let total = root.childs.length;
  for (const childId of root.childs) {
    total += countDescendants(childId, byId);
  }
  return total;
}

function walkToRoot(nodeId, byId) {
  let current = byId.get(nodeId);
  if (!current) return null;

  while (current.parent) {
    const parent = byId.get(current.parent);
    if (!parent) break;
    current = parent;
  }
  return current;
}

/**
 * Resuelve el nodo raíz del árbol para el panel admin.
 * Prioridad: TREE_ROOT_ID → ancestro de usuarios tree → raíz con más descendientes.
 */
function resolveTreeRootId(tree, options = {}) {
  if (!Array.isArray(tree) || !tree.length) return null;

  const envRoot = process.env.TREE_ROOT_ID;
  if (envRoot) {
    const found = tree.find((n) => String(n.id) === String(envRoot));
    if (found) return found.id;
  }

  const byId = new Map(tree.map((n) => [String(n.id), n]));
  const roots = tree.filter(isRootNode);
  if (!roots.length) return null;
  if (roots.length === 1) return roots[0].id;

  const preferIds = Array.isArray(options.preferUserIds) ? options.preferUserIds : [];
  for (const userId of preferIds) {
    const root = walkToRoot(String(userId), byId);
    if (root) return root.id;
  }

  let best = roots[0];
  let bestCount = -1;
  for (const root of roots) {
    const count = countDescendants(root.id, byId);
    if (count > bestCount) {
      best = root;
      bestCount = count;
    }
  }
  return best ? best.id : null;
}

module.exports = {
  resolveTreeRootId,
  isRootNode,
};
