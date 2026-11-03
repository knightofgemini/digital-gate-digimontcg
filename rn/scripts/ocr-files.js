// File del motore di lettura della scansione (Tesseract.js) da mettere dentro l'APK: la scansione funziona senza
// internet e senza siti esterni. Li prende dal registro npm (versioni fisse) e li scrive in rn/ocr/ come script che
// mettono il loro contenuto in window.__OCR: la pagina del motore (src/scan/engineHtml.ts) li carica con <script>
// da file:///android_asset/ocr/ (plugins/withOcrAssets.js li copia negli asset dell'APK) e ne fa un worker unico.
// Gli stessi file vanno anche nel deposito su GitHub Pages (www/ocr/, tools/build.py) come ripiego.
// Uso: node scripts/ocr-files.js [cartella di uscita]
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const VERS = { "tesseract.js": "5.1.1", "tesseract.js-core": "5.1.1", "@tesseract.js-data/eng": "1.0.0" };
const out = path.resolve(process.argv[2] || path.join(__dirname, "..", "ocr"));
const stamp = JSON.stringify(VERS);
if (fs.existsSync(path.join(out, "v.json")) && fs.readFileSync(path.join(out, "v.json"), "utf8") === stamp) {
  console.log("motore di lettura già pronto in", out);
  process.exit(0);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ocr-"));
const pkg = {};
for (const [name, ver] of Object.entries(VERS)) {
  const tgz = execFileSync("npm", ["pack", name + "@" + ver, "--silent"], { cwd: tmp }).toString().trim().split("\n").pop();
  const dir = path.join(tmp, name.replace(/[@/]/g, "_"));
  fs.mkdirSync(dir);
  execFileSync("tar", ["-xzf", path.join(tmp, tgz), "-C", dir]);
  pkg[name] = path.join(dir, "package");
}
const read = (name, f, enc) => fs.readFileSync(path.join(pkg[name], f), enc);

fs.mkdirSync(out, { recursive: true });
const put = (f, s) => {
  fs.writeFileSync(path.join(out, f), s);
  console.log(f, Math.round(Buffer.byteLength(s) / 1024), "KB");
};
const wrap = (key, s) => "window.__OCR=window.__OCR||{};window.__OCR." + key + "=" + JSON.stringify(s) + ";\n";
// libreria della pagina (crea il worker e gli parla)
put("tess.js", read("tesseract.js", "dist/tesseract.min.js", "utf8"));
// codice del worker e motore vero e proprio (WebAssembly già dentro il file .wasm.js), solo LSTM come oggi:
// con istruzioni SIMD (telefoni recenti) e senza (ripiego)
put("worker.js", wrap("worker", read("tesseract.js", "dist/worker.min.js", "utf8")));
put("core-simd.js", wrap("core", read("tesseract.js-core", "tesseract-core-simd-lstm.wasm.js", "utf8")));
put("core.js", wrap("core", read("tesseract.js-core", "tesseract-core-lstm.wasm.js", "utf8")));
// dati della lingua inglese (gli stessi che la scansione scaricava da internet: 4.0.0_best_int), compressi, in base64
put("lang.js", wrap("lang", read("@tesseract.js-data/eng", "4.0.0_best_int/eng.traineddata.gz").toString("base64")));
// licenze (Apache 2.0)
let lic = "";
for (const name of Object.keys(VERS)) {
  const f = ["LICENSE", "LICENSE.md", "LICENSE.txt"].map((x) => path.join(pkg[name], x)).find((x) => fs.existsSync(x));
  lic += "== " + name + " " + VERS[name] + "\n" + (f ? fs.readFileSync(f, "utf8") : "Apache-2.0\n") + "\n";
}
put("LICENSE.txt", lic);
put("v.json", stamp);
fs.rmSync(tmp, { recursive: true, force: true });
