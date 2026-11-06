// Copia i dati dell'app (src/data.json, src/products.json, src/prices.json) dentro il progetto Expo.
const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "..", "src");
const dir = path.join(__dirname, "..", "data");
fs.mkdirSync(dir, { recursive: true });
for (const f of ["data.json", "products.json", "prices.json"]) {
  if (fs.existsSync(path.join(src, f))) fs.copyFileSync(path.join(src, f), path.join(dir, f));
}
// impronta e momento dei dati (come www/dati/ver.json di tools/build.py): l'app usa i dati scaricati dal sito solo se più
// recenti di questi. DATA_T = momento della pubblicazione (lo passa il workflow), altrimenti l'ultimo commit
const crypto = require("crypto");
const buf = Buffer.concat(["data.json", "products.json"].map((f) => fs.readFileSync(path.join(dir, f))));
let t = +process.env.DATA_T || 0;
if (!t) {
  try {
    t = +require("child_process").execSync("git log -1 --format=%ct", { cwd: __dirname }).toString().trim() || 0;
  } catch (e) {}
}
const ver = { h: crypto.createHash("sha1").update(buf).digest("hex").slice(0, 16), t };
// APK di prova del riquadro "Carte nuove" con dati vecchi (apk.yml, "novita"): vedi pickData in src/dataupd.ts
if (process.env.NEWS_DEMO) ver.demo = 1;
fs.writeFileSync(path.join(dir, "ver.json"), JSON.stringify(ver));
console.log("dati copiati", t);
