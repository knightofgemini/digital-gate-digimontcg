// Pagina dell'editor "Tagli della Home" (src/editor/tagli.html) come testo dentro l'app: src/editor/html.ts.
// Da rilanciare dopo ogni modifica della pagina: node scripts/editor-html.js (dalla cartella rn).
const fs = require("fs");
const path = require("path");
const html = fs.readFileSync(path.join(__dirname, "../src/editor/tagli.html"), "utf8");
fs.writeFileSync(path.join(__dirname, "../src/editor/html.ts"), "// generato da scripts/editor-html.js da src/editor/tagli.html: non modificare a mano\nexport const EDITOR_HTML = " + JSON.stringify(html) + ";\n");
