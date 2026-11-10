// Prove delle scelte della Home (src/homeLogic.ts): set da completare, righe di "All'orizzonte", date brevi.
// Uso (dalla cartella rn): node --experimental-strip-types --test scripts/home-logic.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { dateParts, goals, groupName, heroSlides, pickGoal, upRows } from "../src/homeLogic.ts";

const yes = () => true;

test("set da completare: il più vicino al completamento", () => {
  const sets = [
    { id: "a", date: "2026-01-01" },
    { id: "b", date: "2026-02-01" },
    { id: "c", date: "2026-03-01" },
  ];
  const st = { a: { n: 100, h: 90 }, b: { n: 10, h: 5 }, c: { n: 81, h: 64 } };
  assert.equal(pickGoal(sets, st, yes)?.id, "a");
});

test("set da completare: esclusi completi, vuoti, senza carte e non ancora usciti", () => {
  const sets = [
    { id: "full", date: "2026-05-01" },
    { id: "none", date: "2026-05-01" },
    { id: "empty", date: "2026-05-01" },
    { id: "soon", date: "2026-12-11" },
    { id: "ok", date: "2025-01-01" },
  ];
  const st = { full: { n: 10, h: 10 }, none: { n: 10, h: 0 }, empty: { n: 0, h: 0 }, soon: { n: 91, h: 90 }, ok: { n: 50, h: 1 } };
  assert.equal(pickGoal(sets, st, (s) => s.id !== "soon")?.id, "ok");
  assert.equal(pickGoal(sets.slice(0, 4), st, (s) => s.id !== "soon"), null);
  assert.equal(pickGoal([], {}, yes), null);
});

test("set da completare: a parità di avanzamento il più recente", () => {
  const sets = [
    { id: "old", date: "2025-04-01" },
    { id: "new", date: "2026-04-01" },
    { id: "mid", date: "2025-10-01" },
  ];
  // 1/3 = 2/6 = 3/9: stessa frazione, vince la data più recente
  const st = { old: { n: 3, h: 1 }, new: { n: 6, h: 2 }, mid: { n: 9, h: 3 } };
  assert.equal(pickGoal(sets, st, yes)?.id, "new");
});

const rel = (u) => u.rel || "";
const U = (code, from, prec, kind = "Starter Deck", extra = {}) => ({ code, name: code + " name", from, prec, kind, ...extra });

test("All'orizzonte: stesso giorno e stesso tipo in una riga", () => {
  const ups = [U("ST25", "2026-12-04", "day"), U("ST26", "2026-12-04", "day"), U("BT27", "2026-12-11", "day", "Booster"), U("EX14", "2027-01-01", "month", "Extra Booster")];
  const rows = upRows(ups, 2, rel);
  assert.deepEqual(rows.map((r) => r.map((u) => u.code)), [["ST25", "ST26"], ["BT27"]]);
});

test("All'orizzonte: mai accorpate le date mensili, i tipi diversi o le uscite per regione diverse", () => {
  const m = upRows([U("PB27", "2027-06-01", "month", "Premium Bandai"), U("PB28", "2027-06-01", "month", "Premium Bandai")], 2, rel);
  assert.deepEqual(m.map((r) => r.length), [1, 1]);
  const k = upRows([U("BT30", "2027-05-01", "day", "Booster"), U("ST30", "2027-05-01", "day")], 2, rel);
  assert.deepEqual(k.map((r) => r.length), [1, 1]);
  const g = upRows([U("ST40", "2027-05-01", "day", "Starter Deck", { rel: "US" }), U("ST41", "2027-05-01", "day", "Starter Deck", { rel: "EU" })], 2, rel);
  assert.deepEqual(g.map((r) => r.length), [1, 1]);
  const n = upRows([U("PB24", "", "none", "Premium Bandai"), U("PB29", "", "none", "Premium Bandai")], 2, rel);
  assert.deepEqual(n.map((r) => r.length), [1, 1]);
});

test("All'orizzonte: al massimo due righe e due prodotti per riga", () => {
  const ups = [U("A", "2027-01-05", "day"), U("B", "2027-01-05", "day"), U("C", "2027-01-05", "day"), U("D", "2027-02-01", "day")];
  const rows = upRows(ups, 2, rel);
  assert.deepEqual(rows.map((r) => r.map((u) => u.code)), [["A", "B"], ["C"]]);
  assert.deepEqual(upRows([], 2, rel), []);
});

test("nome della riga accorpata", () => {
  assert.equal(groupName(["Digimon Alysion · Rubeusdramon", "Digimon Alysion · Yukinamon"]), "Digimon Alysion");
  assert.equal(groupName(["Ignition of X", "Abyss of X"]), "Ignition of X + Abyss of X");
  assert.equal(groupName(["Same", "Same"]), "Same");
  assert.equal(groupName(["Solo"]), "Solo");
});

test("date brevi", () => {
  assert.deepEqual(dateParts({ from: "2026-12-04", prec: "day" }), { big: "04", small: "DIC", label: "4 dicembre 2026" });
  assert.deepEqual(dateParts({ from: "2027-01-01", prec: "month" }), { big: "GEN", small: "2027", label: "gennaio 2027" });
  assert.equal(dateParts({ prec: "none" }), null);
  assert.equal(dateParts({ from: "", prec: "day" }), null);
});

test("set da completare: tutti, dal più vicino al completamento", () => {
  const sets = [
    { id: "a", date: "2026-01-01" },
    { id: "b", date: "2026-02-01" },
    { id: "c", date: "2026-03-01" },
    { id: "d", date: "2026-04-01" },
  ];
  const st = { a: { n: 10, h: 5 }, b: { n: 10, h: 9 }, c: { n: 4, h: 2 }, d: { n: 10, h: 10 } };
  assert.deepEqual(goals(sets, st, yes).map((s) => s.id), ["b", "c", "a"]);
});

test("In evidenza: spoiler più recenti, poi un prodotto per tipo", () => {
  const ups = [
    { code: "LM09", type: "LM", cards: 0, last: "" },
    { code: "ST25", type: "ST", cards: 0, last: "" },
    { code: "BT27", type: "BT", cards: 91, last: "2026-11-05" },
    { code: "EX14", type: "EX", cards: 2, last: "2026-10-24" },
  ];
  const rel = [
    { id: "bt26", code: "BT26", type: "BT", date: "2026-09-04" },
    { id: "ex13", code: "EX13", type: "EX", date: "2026-10-02" },
    { id: "st24", code: "ST24", type: "ST", date: "2026-05-15" },
    { id: "st23", code: "ST23", type: "ST", date: "2026-05-14" },
    { id: "lm08", code: "LM08", type: "LM", date: "2026-08-04" },
  ];
  const s = heroSlides(ups, rel, ["BT", "EX", "ST", "LM", "PB"]);
  assert.deepEqual(s.map((x) => x.kind + ":" + x.code), ["spoiler:BT27", "up:EX14", "set:ST24", "set:LM08"]);
  // EX14 con spoiler più recenti: prima EX14, poi BT27 per i Booster
  ups[3].last = "2026-11-06";
  assert.deepEqual(heroSlides(ups, rel, ["BT", "EX"]).map((x) => x.kind + ":" + x.code), ["spoiler:EX14", "up:BT27"]);
  // nessuno spoiler: solo gli ultimi usciti
  assert.deepEqual(heroSlides([], rel, ["BT", "EX"]).map((x) => x.code), ["BT26", "EX13"]);
});

test("taglio scelto a mano: il punto scelto resta al centro del riquadro", async () => {
  const { focusPos } = await import("../src/homeLogic.ts");
  // banner 16:9 in un quadrato: centro sul 50% → 50%; sul 70% → oltre la metà; ai bordi fermo a 0% / 100%
  assert.equal(focusPos({ x: 0.5, r: 16 / 9 }, 1).left, "50%");
  const l = parseFloat(focusPos({ x: 0.7, r: 16 / 9 }, 1).left);
  assert.ok(Math.abs((l / 100) * (16 / 9 - 1) + 0.5 - 0.7 * (16 / 9)) < 0.01);
  assert.equal(focusPos({ x: 0.05, r: 16 / 9 }, 65 / 91).left, "0%");
  assert.equal(focusPos({ x: 0.99, r: 16 / 9 }, 65 / 91).left, "100%");
  // senza dati: la posizione di sempre
  assert.deepEqual(focusPos(undefined, 1, { left: "50%", top: "35%" }), { left: "50%", top: "35%" });
  // immagine più alta del riquadro: taglio in verticale
  assert.equal(focusPos({ y: 0.5, r: 0.5 }, 1).top, "50%");
});

test("tagli dell'editor: stesso centro e stessa altezza su riquadri di forma diversa", async () => {
  const { fitRect, cutLayout } = await import("../src/homeLogic.ts");
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  // taglio 1,313:1 al centro di un'immagine 2000×1000, mostrato su un riquadro 2:1: più largo, stessa altezza
  const r = { x0: 0.5 - 0.1313 * 1.0, y0: 0.3, x1: 0.5 + 0.1313, y1: 0.7 };
  const f = fitRect(r, 2, 2000, 1000);
  assert.ok(near(f.y0, 0.3) && near(f.y1, 0.7));
  assert.ok(near((f.x1 - f.x0) * 2000, 400 * 2));
  // centro vicino al bordo: non esce dall'originale, si riduce attorno allo stesso centro
  const e = fitRect({ x0: 0.8, y0: 0.2, x1: 0.96, y1: 0.8 }, 2, 1000, 1000);
  assert.ok(e.x1 <= 1 + 1e-9 && near((e.x0 + e.x1) / 2, 0.88) && near((e.y0 + e.y1) / 2, 0.5));
  // posizione: il rettangolo riempie esattamente il riquadro
  const L = cutLayout({ x0: 0.25, y0: 0.5, x1: 0.75, y1: 1 }, 1000, 1000, 200);
  assert.deepEqual(L, { width: 400, height: 400, left: -100, top: -200 });
});
