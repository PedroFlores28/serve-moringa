require("dotenv").config();
const db = require("../components/db");
const { computeMonthlyActivity, collectNetworkUserIds, buildTreeMap } = require("../lib/monthlyActivity");
const { fetchMonthRecordsForUsers, buildVolumeMap } = require("../lib/treeVolumes");

async function main() {
  const names = ["Moringa", "Class", "Querubin", "Vicenta"];
  const users = await db.User.find({ tree: true });
  const targets = users.filter((u) =>
    names.some((n) => String(u.name || "").toLowerCase() === n.toLowerCase())
  );

  const allTree = await db.Tree.find({});
  const treeMap = buildTreeMap(allTree);
  const userIds = users.map((u) => u.id).filter(Boolean);
  const { activations, affiliations } = await fetchMonthRecordsForUsers(
    db.Activation,
    db.Affiliation,
    userIds
  );

  console.log("--- Tree structure (targets) ---");
  for (const u of targets) {
    const node = treeMap[String(u.id)];
    console.log({
      id: u.id,
      idType: typeof u.id,
      name: u.name,
      childs: node ? node.childs : "NO TREE NODE",
      network: collectNetworkUserIds(u.id, allTree),
      total_points_db: u.total_points,
      points_db: u.points,
    });
  }

  console.log("\n--- Monthly volumes (computeMonthlyActivity) ---");
  for (const u of targets) {
    const vol = computeMonthlyActivity(u, allTree, affiliations, activations);
    const sumPersonalInNetwork = collectNetworkUserIds(u.id, allTree).reduce((sum, nid) => {
      const nu = users.find((x) => sameId(x.id, nid));
      if (!nu) return sum;
      const p = computeMonthlyActivity(nu, allTree, affiliations, activations);
      return sum + p.personalProductCount;
    }, 0) + vol.personalProductCount;

    console.log({
      name: u.name,
      personal: vol.personalProductCount,
      group: vol.groupProductCount,
      sumPersonalRollup: sumPersonalInNetwork,
    });
  }

  const volumeMap = buildVolumeMap(users, allTree, activations, affiliations);
  console.log("\n--- Volume map keys sample ---");
  for (const u of targets) {
    console.log(u.name, volumeMap.get(String(u.id)));
  }

  process.exit(0);
}

function sameId(a, b) {
  return String(a) === String(b);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
