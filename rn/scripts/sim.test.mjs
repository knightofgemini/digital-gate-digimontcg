// Prove del motore del simulatore (src/sim/engine.ts): partite intere computer contro computer con i mazzi base.
// Uso (dalla cartella rn): node --experimental-strip-types --test scripts/sim.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Sim, toDef, SIM_CODES } from "../src/sim/engine.ts";

const raw = JSON.parse(readFileSync(new URL("../data/data.json", import.meta.url)));
const DB = {};
for (const c of raw.cards) {
  if (SIM_CODES.includes(c[0]) && !DB[c[0]]) DB[c[0]] = toDef({ code: c[0], name: c[1], lv: c[2], colors: c[3].split("/"), ct: c[4], dp: c[8], play: c[9], evo: c[10], eff: c[11], inh: c[12], sec: c[13] });
}

function seeded(s) {
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

async function game(seed, mine) {
  const fx = {};
  const ui = { ask: async (_t, o) => o[0]?.v ?? null, fx: async (e) => void (fx[e.k] = (fx[e.k] || 0) + 1), update() {}, isLive: () => true };
  const sim = new Sim(DB, ui, seeded(seed));
  const G = sim.newGame(mine);
  G.P[0].ai = true;
  await sim.startTurn();
  return { G, fx, sim };
}

test("le 32 carte dei mazzi base ci sono tutte", () => {
  assert.equal(Object.keys(DB).length, 32);
  assert.equal(DB["ST1-11"].ec, 4);
  assert.equal(DB["ST2-01"].t, "Digi-Egg");
});

test("100 partite computer contro computer finiscono con un vincitore", async () => {
  const wins = [0, 0];
  for (let s = 1; s <= 100; s++) {
    const { G, sim } = await game(s, s % 2 ? "red" : "blue");
    assert.ok(G.over === 0 || G.over === 1, "partita " + s + " senza vincitore");
    assert.ok(G.turn >= 4 && G.turn < 60, "turni " + G.turn);
    for (const p of G.P) {
      const n = p.deck.length + p.hand.length + p.sec.length + p.trash.length + p.eggs.length + (p.breed ? p.breed.cards.length : 0) + p.field.reduce((a, x) => a + x.cards.length, 0);
      assert.equal(n, 54, "carte perse nella partita " + s);
    }
    wins[sim.G.P[G.over].key === "red" ? 0 : 1]++;
  }
  assert.ok(wins[0] > 10 && wins[1] > 10, "vittorie " + wins);
});

test("le animazioni vengono chieste", async () => {
  const { fx } = await game(7, "red");
  for (const k of ["banner", "spawn", "attack", "reveal", "mem", "delete", "end"]) assert.ok(fx[k] > 0, k);
});
