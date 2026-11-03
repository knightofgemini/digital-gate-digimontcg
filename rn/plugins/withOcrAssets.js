// Motore di lettura della scansione dentro l'APK: copia rn/ocr/ (preparata da scripts/ocr-files.js) negli asset
// Android (app/src/main/assets/ocr/), da dove la pagina del motore lo carica con file:///android_asset/ocr/.
// Senza rn/ocr/ (sviluppo) non copia niente e la scansione usa la copia sul sito (www/ocr/).
const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

module.exports = function withOcrAssets(config) {
  return withDangerousMod(config, [
    "android",
    async (c) => {
      const src = path.join(c.modRequest.projectRoot, "ocr");
      if (!fs.existsSync(path.join(src, "v.json"))) {
        console.warn("withOcrAssets: rn/ocr/ mancante (node scripts/ocr-files.js): la scansione userà la copia sul sito");
        return c;
      }
      const dst = path.join(c.modRequest.platformProjectRoot, "app/src/main/assets/ocr");
      fs.mkdirSync(dst, { recursive: true });
      for (const f of fs.readdirSync(src)) fs.copyFileSync(path.join(src, f), path.join(dst, f));
      return c;
    },
  ]);
};
