import bcrypt from "bcrypt";
import db from "../../../../components/db";
import lib from "../../../../components/lib";
import { getClientInfo, buildAdminAccount } from "../../../../components/adminAuth";

const { User, Session } = db;
const { rand, error, success, midd } = lib;

const handler = async (req, res) => {
  if (req.method === "OPTIONS") return res.status(200).send("ok");
  if (req.method !== "POST") return res.status(405).json(error("method not allowed"));

  const { emailOrDni, password } = req.body || {};
  if (!emailOrDni || !password) return res.json(error("missing credentials"));

  const iden = String(emailOrDni).trim();
  const loginUpper = iden.toUpperCase();
  const loginLower = iden.toLowerCase();

  let user =
    (await User.findOne({ dni: loginUpper, type: "admin" })) ||
    (await User.findOne({ email: loginLower, type: "admin" })) ||
    (await User.findOne({ email: iden, type: "admin" })) ||
    (await User.findOne({ id: loginLower, type: "admin" }));

  if (!user) {
    const byDni = await User.findOne({ dni: loginUpper });
    if (byDni && byDni.type === "admin") user = byDni;
  }

  if (!user || user.type !== "admin") {
    return res.json(error("invalid account"));
  }

  if (user.adminActive === false) {
    return res.json(error("account disabled"));
  }

  const ok = await bcrypt.compare(String(password), String(user.password || ""));
  if (!ok) return res.json(error("invalid password"));

  const sessionValue = rand() + rand() + rand();
  const { userAgent, ip } = getClientInfo(req);

  await Session.insert({
    id: user.id,
    value: sessionValue,
    kind: "admin",
    createdAt: new Date(),
    userAgent,
    ip,
  });

  const account = buildAdminAccount(user);

  return res.json(success({ session: sessionValue, account }));
};

export default async (req, res) => {
  await midd(req, res);
  return handler(req, res);
};
