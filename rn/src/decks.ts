// Deckbuilding: regole ufficiali (50 carte nel mazzo principale, 0-5 Digi-Egg, max 4 copie per numero contando tutte le versioni)
// e lista ban/restrizioni, con gli stessi messaggi dell'app attuale. Mazzi salvati in "dgm-decks" (stesso formato).
import { BAN, BYCODE, BYKEY, Card, MONTHS, PAIRS, deckable, maxCopies } from "./data";
import { Deck, S, saveDecks } from "./store";

export const isEgg = (c: Card) => c.ct === "Digi-Egg";
export const lvNum = (c: Card) => {
  const m = (c.lv || "").match(/\d+/);
  return m ? +m[0] : 0;
};
// carta base per numero (la prima versione, non un'alternative art)
export const baseOf = (code: string) => (BYCODE[code] || []).find((c) => !c.suf) || null;
export const deckById = (id: string) => S.decks.find((d) => d.id === id) || null;
export const inDeck = (d: Deck | null, c: Card) => (d && d.cards[c.k]) || 0;

export function codeTotal(d: Deck, code: string) {
  let n = 0;
  Object.keys(d.cards).forEach((k) => {
    const e = BYKEY[k];
    if (e && e.code === code) n += d.cards[k];
  });
  return n;
}

export type DeckStats = { main: number; egg: number; problems: string[] };
export function deckStats(d: Deck): DeckStats {
  const r: DeckStats = { main: 0, egg: 0, problems: [] },
    per: Record<string, number> = {};
  Object.keys(d.cards).forEach((k) => {
    const e = BYKEY[k];
    if (e) per[e.code] = (per[e.code] || 0) + d.cards[k];
  });
  Object.keys(per).forEach((code) => {
    const c = baseOf(code),
      n = per[code];
    if (!c) return;
    if (isEgg(c)) r.egg += n;
    else r.main += n;
    const mx = maxCopies(c);
    if (!mx) r.problems.push(c.name + " (" + code + ") è bandita.");
    else if (n > mx) r.problems.push(c.name + " (" + code + "): massimo " + mx + (mx === 1 ? " copia" : " copie") + ", ne hai " + n + ".");
    (PAIRS[code] || []).forEach((o) => {
      if (code < o && per[o]) r.problems.push(c.name + " (" + code + ") e " + (baseOf(o)?.name || o) + " (" + o + ") non possono stare nello stesso mazzo.");
    });
  });
  if (r.main !== 50) r.problems.unshift("Il mazzo principale deve avere esattamente 50 carte: ora " + (r.main < 50 ? "ne mancano " + (50 - r.main) : "ce ne sono " + (r.main - 50) + " di troppo") + ".");
  if (r.egg > 5) r.problems.unshift("Il mazzo Digi-Egg può avere al massimo 5 carte: ora sono " + r.egg + ".");
  return r;
}
// mazzi ancora da completare (badge della barra in basso): con 4 o 5 uova e nessun problema il mazzo è completo
export const decksTodo = () =>
  S.decks.filter((d) => {
    const s = deckStats(d);
    return s.problems.length || s.egg < 4;
  }).length;
export function deckState(s: DeckStats): ["ok" | "inc" | "bad", string] {
  const ok = !s.problems.length,
    inc = !ok && s.problems.length === 1 && s.main < 50;
  return ok ? ["ok", "Valido"] : inc ? ["inc", "Incompleto"] : ["bad", "Non valido"];
}

export function addError(d: Deck, c: Card) {
  if (!deckable(c)) return "Questa carta non può essere inserita in un mazzo.";
  const mx = maxCopies(c),
    n = codeTotal(d, c.code);
  if (!mx) return c.name + " è bandita dalla lista ufficiale.";
  if (n >= mx) return mx === 1 ? c.name + " è limitata a 1 copia." : "Massimo " + mx + " copie per " + c.name + ".";
  const s = deckStats(d);
  if (isEgg(c) && s.egg >= 5) return "Il mazzo Digi-Egg è già a 5 carte.";
  if (!isEgg(c) && s.main >= 50) return "Il mazzo principale è già a 50 carte.";
  const bad = (PAIRS[c.code] || []).filter((o) => codeTotal(d, o));
  if (bad.length) return c.name + " non può stare nello stesso mazzo di " + (baseOf(bad[0])?.name || bad[0]) + " (" + bad[0] + ").";
  return "";
}
// aggiunge fino a n copie rispettando regole e lista ban; restituisce quante ne sono entrate e l'eventuale motivo
export function deckAdd(d: Deck, c: Card, n: number) {
  let a = 0,
    er = "";
  while (a < n) {
    er = addError(d, c);
    if (er) break;
    d.cards[c.k] = inDeck(d, c) + 1;
    a++;
  }
  if (a) {
    d.upd = Date.now();
    saveDecks();
  }
  return { a, er };
}
export function deckSet(d: Deck, c: Card, v: number) {
  if (v > 0) d.cards[c.k] = v;
  else delete d.cards[c.k];
  d.upd = Date.now();
  saveDecks();
}
export function newDeck(name: string, cards?: Record<string, number>) {
  const d: Deck = { id: "d" + Date.now().toString(36) + Math.floor(Math.random() * 1e4), name, cards: cards || {}, upd: Date.now() };
  S.decks.unshift(d);
  saveDecks();
  return d;
}
export function deleteDeck(id: string) {
  S.decks = S.decks.filter((d) => d.id !== id);
  saveDecks();
}

export function deckSort(a: Card, b: Card) {
  return lvNum(a) - lvNum(b) || (+a.play || 0) - (+b.play || 0) || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0) || ((a.suf || "") < (b.suf || "") ? -1 : 1);
}
const entries = (d: Deck) =>
  Object.keys(d.cards)
    .map((k) => BYKEY[k])
    .filter(Boolean);
// gruppi per l'esportazione: Digi-Egg, Digimon, Tamer, Option
export function deckGroups(d: Deck): [string, Card[]][] {
  const g: [string, Card[]][] = [
    ["Digi-Egg", []],
    ["Digimon", []],
    ["Tamer", []],
    ["Option", []],
  ];
  entries(d).forEach((c) => g[isEgg(c) ? 0 : /^Digimon/.test(c.ct) ? 1 : c.ct === "Tamer" ? 2 : 3][1].push(c));
  g.forEach((x) => x[1].sort(deckSort));
  return g;
}
// pile dell'editor: Digi-Egg, Digimon per livello, Tamer, Option
export function dkGroups(d: Deck): [string, Card[]][] {
  const by: Record<string, Card[]> = {};
  entries(d).forEach((c) => {
    const g = isEgg(c) ? "Digi-Egg" : /^Digimon/.test(c.ct) ? (lvNum(c) ? "Lv." + lvNum(c) : "Digimon") : c.ct === "Tamer" ? "Tamer" : "Option";
    (by[g] = by[g] || []).push(c);
  });
  const order = ["Digi-Egg", "Lv.2", "Lv.3", "Lv.4", "Lv.5", "Lv.6", "Lv.7", "Digimon", "Tamer", "Option"];
  return order.filter((g) => by[g]).map((g) => [g, by[g].sort(deckSort)] as [string, Card[]]);
}

export function deckText(d: Deck) {
  const lines = ["// " + d.name];
  deckGroups(d).forEach(([g, cs]) => {
    if (!cs.length) return;
    lines.push("// " + g);
    const seen: Record<string, 1> = {};
    cs.forEach((c) => {
      if (seen[c.code]) return;
      seen[c.code] = 1;
      lines.push(codeTotal(d, c.code) + " " + c.name + " " + c.code);
    });
  });
  return lines.join("\n");
}
export function parseDeck(txt: string) {
  const cards: Record<string, number> = {},
    unknown: string[] = [];
  String(txt)
    .split(/\n/)
    .forEach((line) => {
      if (/^\s*\/\//.test(line)) return;
      const codes = line.toUpperCase().match(/\b(?:BT|EX|ST|RB|LM|AD|P)\d*-\d{2,3}\b/g);
      if (!codes) return;
      const cnt = line.match(/^\s*(\d+)\s*x?\s/i);
      codes.forEach((code) => {
        code = code.replace(/^(BT|EX|ST|RB|AD)0+(\d)/, "$1$2");
        const b = baseOf(code);
        if (!b || !deckable(b)) {
          unknown.push(code);
          return;
        }
        cards[b.k] = (cards[b.k] || 0) + (cnt && codes.length === 1 ? +cnt[1] : 1);
      });
    });
  // righe come "0 BT1-010": niente pile vuote
  Object.keys(cards).forEach((k) => cards[k] > 0 || delete cards[k]);
  return { cards, unknown };
}

export function deckCover(d: Deck): Card | null {
  if (d.cover && d.cards[d.cover] && BYKEY[d.cover]) return BYKEY[d.cover];
  let best: Card | null = null,
    bs = -1;
  Object.keys(d.cards).forEach((k) => {
    const c = BYKEY[k];
    if (!c || !/^Digimon/.test(c.ct)) return;
    const sc = lvNum(c) * 10 + d.cards[k];
    if (sc > bs) {
      bs = sc;
      best = c;
    }
  });
  return best;
}
export function deckColors(d: Deck): [string, number][] {
  const cnt: Record<string, number> = {};
  Object.keys(d.cards).forEach((k) => {
    const c = BYKEY[k];
    if (c) c.colors.forEach((x) => (cnt[x] = (cnt[x] || 0) + d.cards[k]));
  });
  return Object.keys(cnt)
    .sort((a, b) => cnt[b] - cnt[a])
    .map((k) => [k, cnt[k]]);
}
// curva: copie per livello (Digimon) più Tamer e Option
export function deckCurve(d: Deck): [string, number][] {
  const bins: [string, number][] = [
    ["Lv.2", 0],
    ["Lv.3", 0],
    ["Lv.4", 0],
    ["Lv.5", 0],
    ["Lv.6", 0],
    ["Lv.7", 0],
    ["Tamer", 0],
    ["Option", 0],
  ];
  Object.keys(d.cards).forEach((k) => {
    const c = BYKEY[k];
    if (!c || isEgg(c)) return;
    const n = d.cards[k];
    if (/^Digimon/.test(c.ct)) bins.forEach((b) => b[0] === "Lv." + lvNum(c) && (b[1] += n));
    else if (c.ct === "Tamer") bins[6][1] += n;
    else if (/^Option/.test(c.ct)) bins[7][1] += n;
  });
  if (!bins[0][1]) bins.shift();
  return bins;
}

export function banEffective() {
  const s = (BAN && BAN.effective) || "";
  const p = s.split("-");
  return p.length === 3 ? +p[2] + " " + MONTHS[+p[1] - 1] + " " + p[0] : s;
}
export const banNote = () =>
  "Regole ufficiali: mazzo principale di esattamente 50 carte, mazzo Digi-Egg da 0 a 5 carte, al massimo 4 copie per numero di carta (anche con illustrazioni diverse). Lista ban e restrizioni in vigore dal " +
  banEffective() +
  ": " +
  ((BAN && BAN.banned.length) || 0) +
  " carte bandite, " +
  ((BAN && BAN.restricted.length) || 0) +
  " limitate a 1 copia, " +
  ((BAN && BAN.pairs.length) || 0) +
  " coppie vietate.";
export const banSource = () => (BAN && BAN.source) || "https://world.digimoncard.com/rule/restriction_card/";
