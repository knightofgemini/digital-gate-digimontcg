// Copia i dati dell'app (src/data.json, generati da tools/make_data2.py) dentro il progetto Expo.
const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "..", "src", "data.json");
const dir = path.join(__dirname, "..", "data");
fs.mkdirSync(dir, { recursive: true });
fs.copyFileSync(src, path.join(dir, "data.json"));
console.log("data.json copiato");
