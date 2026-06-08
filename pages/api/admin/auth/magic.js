import lib from "../../../../components/lib";

const { midd } = lib;

/** Acceso automático por URL deshabilitado: usar login manual. */
export default async (req, res) => {
  await midd(req, res);
  return res.status(403).json({
    error: true,
    msg: "magic login disabled",
  });
};
