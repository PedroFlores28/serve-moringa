/**
 * Fotos de perfil por defecto según género al registrarse.
 * Ilustraciones planas estilo corporativo (misma línea visual que avatar femenino).
 */

const CDN_BASE = (
  process.env.BUNNY_PULL_ZONE_URL || "https://moringa.b-cdn.net"
).replace(/\/$/, "");

const AVATAR_FEMENINO =
  "https://ik.imagekit.io/asu/impulse/avatar_cWVgh_GNP.png";

const AVATAR_MASCULINO = `${CDN_BASE}/avatars/avatar-masculino.png`;

const AVATAR_UNISEX = "/avatars/avatar-unisex.png?v=4";

function getDefaultPhotoByGender(gender) {
  return AVATAR_UNISEX;
}


module.exports = {
  AVATAR_FEMENINO,
  AVATAR_MASCULINO,
  AVATAR_UNISEX,
  getDefaultPhotoByGender,
};
