// Prove delle scelte della Home (src/homeLogic.ts): set da completare, righe di "All'orizzonte", date brevi.
// Uso (dalla cartella rn): node --experimental-strip-types --test scripts/home-logic.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { dateParts, groupName, pickGoal, upRows } from "../src/homeLogic.ts";

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
