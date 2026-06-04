require("dotenv").config();
const db = require("../components/db");
const { collectNetworkUserIds } = require("../lib/monthlyActivity");
const {
  fetchMonthRecordsForUsers,
  buildVolumeMap,
  volumesForUser,
} = require("../lib/treeVolumes");

async function main() {
  const moringa = await db.User.findOne({ name: "Moringa", tree: true });
  const allTree = await db.Tree.find({});
  const childIds = allTree.find((n) => n.id === moringa.id).childs;
  const childUsers = await db.User.find({ id: { $in: childIds } });
  const usersForVolumes = [moringa, ...childUsers];

  const networkUserIds = collectNetworkUserIds(moringa.id, allTree);
  const limitedIds = usersForVolumes.map((u) => u.id);

  const full = await fetchMonthRecordsForUsers(
    db.Activation,
    db.Affiliation,
    networkUserIds
  );
  const limited = await fetchMonthRecordsForUsers(
    db.Activation,
    db.Affiliation,
    limitedIds
  );

  const mapFull = buildVolumeMap(
    usersForVolumes,
    allTree,
    full.activations,
    full.affiliations
  );
  const mapLimited = buildVolumeMap(
    usersForVolumes,
    allTree,
    limited.activations,
    limited.affiliations
  );

  console.log("Moringa — red completa:", volumesForUser(mapFull, moringa.id));
  console.log("Moringa — solo hijo directo (bug viejo):", volumesForUser(mapLimited, moringa.id));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
