/**
 * Sube avatares por defecto a Bunny CDN (una vez).
 * Uso: node scripts/upload-default-avatars.js
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const https = require("https");

const files = [
  {
    local: path.join(__dirname, "../../app/public/avatars/avatar-masculino.png"),
    remote: "avatars/avatar-masculino.png",
  },
  {
    local: path.join(__dirname, "../../app/public/avatars/avatar-unisex.png"),
    remote: "avatars/avatar-unisex.png",
  },
];

function upload(buffer, remotePath) {
  return new Promise((resolve, reject) => {
    const storageZoneName = process.env.BUNNY_STORAGE_ZONE_NAME;
    const storagePassword = process.env.BUNNY_STORAGE_PASSWORD;
    const storageHostname =
      process.env.BUNNY_STORAGE_HOSTNAME || "ny.storage.bunnycdn.com";
    const pullZoneUrl = (
      process.env.BUNNY_PULL_ZONE_URL || "https://moringa.b-cdn.net"
    ).replace(/\/$/, "");

    if (!storagePassword) {
      reject(new Error("BUNNY_STORAGE_PASSWORD no configurado"));
      return;
    }

    const bunnyUrl = `https://${storageHostname}/${storageZoneName}/${remotePath}`;
    const req = https.request(
      bunnyUrl,
      {
        method: "PUT",
        headers: {
          AccessKey: storagePassword,
          "Content-Type": "image/png",
          "Content-Length": buffer.length,
        },
      },
      (res) => {
        let body = "";
        res.on("data", (d) => (body += d));
        res.on("end", () => {
          if (res.statusCode === 200 || res.statusCode === 201) {
            resolve(`${pullZoneUrl}/${remotePath}`);
          } else {
            reject(new Error(`Bunny ${res.statusCode}: ${body}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.write(buffer);
    req.end();
  });
}

async function main() {
  const urls = {};
  for (const f of files) {
    if (!fs.existsSync(f.local)) {
      console.error("No existe:", f.local);
      process.exit(1);
    }
    const buf = fs.readFileSync(f.local);
    console.log("Subiendo", f.remote, `(${buf.length} bytes)...`);
    urls[f.remote] = await upload(buf, f.remote);
    console.log("OK:", urls[f.remote]);
  }
  console.log("\nURLs para defaultAvatars.js:");
  console.log(JSON.stringify(urls, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
