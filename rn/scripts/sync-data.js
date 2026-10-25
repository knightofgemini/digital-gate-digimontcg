// Copia i dati dell'app (src/data.json, src/products.json, src/prices.json) dentro il progetto Expo.
const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "..", "src");
const dir = path.join(__dirname, "..", "data");
fs.mkdirSync(dir, { recursive: true });
for (const f of ["data.json", "products.json", "prices.json"]) {
  if (fs.existsSync(path.join(src, f))) fs.copyFileSync(path.join(src, f), path.join(dir, f));
}
console.log("dati copiati");
