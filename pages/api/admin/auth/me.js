import db from "../../../../components/db";
import lib from "../../../../components/lib";
import { requireAdmin, buildAdminAccount } from "../../../../components/adminAuth";

const { success, midd } = lib;

export default async (req, res) => {
  await midd(req, res);

  const auth = await requireAdmin(req, res);
  if (!auth) return;

  const { user } = auth;
  return res.json(
    success({
      account: buildAdminAccount(user),
    })
  );
};

