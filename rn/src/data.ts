// Dati dell'app: gli stessi del sito (src/data.json, src/products.json, src/prices.json), copiati in rn/data/ da scripts/sync-data.js.
// Stessa logica di src/template.html (CARDS, mkEntry, cardsOfSet, imgQ...).
import raw from "../data/data.json";
import rawProducts from "../data/products.json";
import { shown } from "./imgstore";

export const TYPES: Record<string, string> = { BT: "Booster", EX: "Extra Booster", ST: "Starter Deck", LM: "Limited", PB: "Premium Bandai", AL: "Altri" };
export const COLORS: Record<string, string> = { Red: "Rosso", Blue: "Blu", Yellow: "Giallo", Green: "Verde", Black: "Nero", Purple: "Viola", White: "Bianco" };
export const MONTHS = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];

// Formato carta: [code,name,lv,colors,ct,form,attr,trait,dp,play,evo,eff,inh,sec,extra,rar,setId,{x}]
type RawCard = string[] & { 17?: any };

export type Card = {
  i: number;
  k: string; // chiave della versione (come nel sito: "set|codice", "set|codice#2", versioni alt "...~_P1")
  code: string;
  name: string;
  lv: string;
  colors: string[];
  ct: string;
  form: string;
  attr: string;
  sp: string;
  dp: string;
  play: string;
  evo: string;
  eff: string;
  inh: string;
  sec: string;
  extra: string;
  rar: string;
  set: string;
  x: any;
  nb: string; // codice + nome normalizzati per la ricerca
  // solo per le versioni alternative
  suf?: string;
  img?: string;
  ver?: string;
  mark?: number | "SP";
  cls?: string;
  from?: string;
};

export type CardSet = { id: string; code: string; name: string; type: string; n: number; date: string; v: (number | [number, string, number, any, string?])[] };
export type Upcoming = { code: string; name: string; from: string; prec?: string; kind?: string; note?: string };
export type Product = {
  k: string;
  url: string;
  rel?: [string, string][];
  pre?: string;
  price?: [string, string, string?];
  types?: string;
  rar?: [string, number][];
  cont?: string[];
  pk?: string;
  lg?: string;
};

const FOLDMAP: Record<string, string> = { "ß": "ss", "æ": "ae", "œ": "oe", "ø": "o", "ł": "l", "đ": "d", "ð": "d", "þ": "th", "ı": "i" };
export function fold(t: string): string {
  return String(t || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[ßæœøłđðþı]/g, (ch) => FOLDMAP[ch])
    .replace(/['’‘`´ʼ]/g, "")
    .replace(/[^a-z0-9À-￿]+/g, " ")
    .trim();
}
export function normQ(q: string) {
  return fold(q).replace(/\b(bt|ex|st|rb|lm|ad)0+(\d)/g, "$1$2");
}

export const SETS: CardSet[] = (raw as any).sets;
export const SETBY: Record<string, CardSet> = {};
SETS.forEach((s) => (SETBY[s.id] = s));
export const UPCOMING: Upcoming[] = (raw as any).upcoming || [];
export const PRODUCTS: Record<string, Product> = rawProducts as any;
const VERS: string[] = (raw as any).versions || ["Normal"];
const ERRATA: Record<string, 1> = {};
((raw as any).errata || []).forEach((k: string) => (ERRATA[k] = 1));
export const BAN = (raw as any).ban;

export const CARDS: Card[] = ((raw as any).cards as RawCard[]).map((a, i) => ({
  i,
  k: "",
  code: a[0],
  name: a[1],
  lv: a[2],
  colors: a[3] ? a[3].split("/") : [],
  ct: a[4],
  form: a[5],
  attr: a[6],
  sp: a[7],
  dp: a[8],
  play: a[9],
  evo: a[10],
  eff: a[11],
  inh: a[12],
  sec: a[13],
  extra: a[14],
  rar: a[15],
  set: a[16],
  x: (a as any)[17] || null,
  nb: " " + fold(a[0] + " " + a[1]) + " ",
}));
const seen: Record<string, number> = {};
CARDS.forEach((c) => {
  const base = c.set + "|" + c.code;
  seen[base] = (seen[base] || 0) + 1;
  c.k = seen[base] > 1 ? base + "#" + seen[base] : base;
});

// Una "versione" = carta + arte uscita in quel prodotto. La versione base è la carta stessa.
function mkEntry(c: Card, suf: string, vv: number, mark: any, cls?: string): Card {
  if (!suf) return c;
  let ver = VERS[vv] || "";
  if (/^Foil - Coloured Border - Limited (Common|Uncommon)$/.test(ver)) ver = "Foil";
  return { ...c, suf, img: c.code + suf, k: c.k + "~" + suf, ver, mark: mark || 0, cls: cls || "" };
}

const SETCARDS: Record<string, Card[]> = {};
export function cardsOfSet(id: string): Card[] {
  if (!SETCARDS[id]) {
    SETCARDS[id] = ((SETBY[id] && SETBY[id].v) || []).map((x) => {
      if (typeof x === "number") return CARDS[x];
      const e = mkEntry(CARDS[x[0]], x[1], x[2], x[3], x[4]);
      if (e !== CARDS[x[0]]) e.from = id;
      return e;
    });
  }
  return SETCARDS[id];
}

// Tutte le versioni per chiave (base + alternative) e per codice
export const BYKEY: Record<string, Card> = {};
export const BYCODE: Record<string, Card[]> = {};
CARDS.forEach((c) => {
  BYKEY[c.k] = c;
  (BYCODE[c.code] = BYCODE[c.code] || []).push(c);
});
SETS.forEach((s) =>
  cardsOfSet(s.id).forEach((e) => {
    if (e.suf && !BYKEY[e.k]) {
      BYKEY[e.k] = e;
      BYCODE[e.code].push(e);
    }
  })
);

// ---- date e prodotti in arrivo
export function parseDay(s: string) {
  const p = s.split("-");
  return new Date(+p[0], +p[1] - 1, +(p[2] || 1));
}
export function daysTo(s: string) {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return Math.round((parseDay(s).getTime() - t.getTime()) / 864e5);
}
export function soonSet(s?: CardSet) {
  return !!(s && s.date && s.date.charAt(0) !== "0" && daysTo(s.date) > 0);
}
export function spoilerSet(code: string) {
  return SETS.find((s) => s.code === code && soonSet(s) && (s.v || []).length) || null;
}
export function itDate(d: string) {
  const p = d.split("-"),
    m = MONTHS[+p[1] - 1];
  return p[2] ? +p[2] + " " + m + " " + p[0] : m.charAt(0).toUpperCase() + m.slice(1) + " " + p[0];
}
export function monthLabel(d: string) {
  return itDate(d.slice(0, 7));
}
export function typeOf(code: string) {
  return /^BT/.test(code) ? "BT" : /^EX/.test(code) ? "EX" : /^ST/.test(code) ? "ST" : /^LM/.test(code) ? "LM" : /^PB/.test(code) ? "PB" : "AL";
}
export function cdText(u: Upcoming) {
  if (u.prec === "none") return "Data da annunciare";
  const t = new Date(),
    d = parseDay(u.from);
  const m = (d.getFullYear() - t.getFullYear()) * 12 + (d.getMonth() - t.getMonth());
  const month = MONTHS[d.getMonth()] + " " + d.getFullYear();
  if (m < 0) return "Uscito · " + month;
  if (m === 0) return "Questo mese · " + month;
  return "tra " + m + (m === 1 ? " mese" : " mesi") + " · " + month;
}

// ---- immagini (stessi indirizzi del sito)
export const SITE = "https://knightofgemini.github.io/digital-gate-digimontcg/";
const IMG = SITE + "img/";
function imgQ(key: string, c: Card) {
  const q: string[] = [];
  if (ERRATA[key]) q.push("e=1");
  if (soonSet(SETBY[c.set])) q.push("sp=2"); // anteprime degli spoiler ritagliate
  return q.length ? "?" + q.join("&") : "";
}
const imgKey = (c: Card) => c.img || c.code;
// indirizzi in rete (per scaricarle in "Immagini offline")…
export const NET = {
  t: (c: Card) => IMG + "t/" + encodeURIComponent(imgKey(c)) + ".webp" + imgQ(imgKey(c), c),
  f: (c: Card) => IMG + "f/" + encodeURIComponent(imgKey(c)) + ".webp" + imgQ(imgKey(c), c),
  pre: (c: Card | string) => IMG + "pre/" + encodeURIComponent(typeof c === "string" ? c : imgKey(c)) + ".webp",
  logo: (code: string) => {
    const p = PRODUCTS[code];
    return p && p.lg ? SITE + "prod/logo/" + p.k + ".webp" : null;
  },
  pack: (code: string) => {
    const p = PRODUCTS[code];
    return p && p.pk ? SITE + "prod/" + p.k + ".webp" : null;
  },
  banner: (code: string) => (BANNERS[code] ? SITE + "banners/" + code + ".webp" : null),
};
// …e da mostrare: il file salvato nel dispositivo se c'è (imgstore)
export const thumbUrl = (c: Card) => shown(NET.t(c));
export const fullUrl = (c: Card) => shown(NET.f(c));
export const logoUrl = (code: string) => {
  const u = NET.logo(code);
  return u && shown(u);
};
export const packUrl = (code: string) => {
  const u = NET.pack(code);
  return u && shown(u);
};

// ---- rarità ed etichette
export const RARITY: Record<string, string> = { C: "Common", U: "Uncommon", R: "Rare", SR: "Super Rare", SEC: "Secret Rare", UR: "Ultra Rare", P: "Promo" };
export function verLabel(v?: string) {
  if (!v || v === "Normal") return "";
  if (/alternative art/i.test(v)) return "Alternative Art";
  if (/pre release/i.test(v)) return "Pre-release";
  return v;
}
export function markText(c: Card) {
  if (!c.suf) return "";
  return c.mark === "SP" ? "SP" : c.mark === 2 ? "★★" : c.mark === 1 ? "★" : "";
}

// Sezioni di un prodotto (Regular, Alternative Art, Ristampe...): come renderCards() del sito
export function setGroups(sid: string, list: Card[]): [string, Card[]][] {
  const own = (c: Card) => c.set === sid;
  const alt = (c: Card) => !!c.suf;
  if (SETBY[sid].type === "PB") return [["Ristampe · Alternative Art", list]];
  if (sid === "ad1")
    return [
      ["Regular", list.filter((c) => own(c) && !alt(c))],
      ["Alternative Art", list.filter((c) => own(c) && alt(c))],
      ["Ristampe", list.filter((c) => !own(c) && c.cls !== "n" && c.cls !== "g")],
      ["Ristampe · Alternative Art", list.filter((c) => !own(c) && c.cls === "n")],
      ["Ristampe · Gold Border", list.filter((c) => !own(c) && c.cls === "g")],
    ];
  return [
    ["Regular", list.filter((c) => own(c) && !alt(c))],
    ["Alternative Art", list.filter((c) => own(c) && alt(c))],
    ["Ristampe", list.filter((c) => !own(c) && !alt(c))],
    ["Ristampe · Alternative Art", list.filter((c) => !own(c) && alt(c))],
  ];
}

// Rilevanza nella ricerca (più basso = più in alto), come relevance() del sito
export function relevance(c: Card, q: string) {
  const n = fold(c.name);
  if (n === q) return 0;
  if (n.indexOf(q + " ") === 0) return 1;
  if ((" " + n + " ").indexOf(" " + q + " ") >= 0) return 2;
  if (n.indexOf(q) === 0 || (" " + n).indexOf(" " + q) >= 0) return 3;
  if (n.indexOf(q) >= 0) return 4;
  if (q.split(" ").every((p) => n.indexOf(p) >= 0)) return 5;
  if (c.nb.indexOf(q) >= 0) return 6;
  return 7;
}
export function searchCards(src: Card[], q: string) {
  const parts = q.split(" ");
  const list = src.filter((c) => parts.every((p) => c.nb.indexOf(p) >= 0));
  return list
    .map((c, j) => ({ c, j, r: relevance(c, q) }))
    .sort((a, b) => a.r - b.r || a.j - b.j)
    .map((o) => o.c);
}

// ---- scheda carta
export const hostSet = (c: Card) => (c.suf ? c.from || c.set : c.set);
export const isAce = (c: Card) => /(^|\n)Effetto ACE:/.test(c.extra || "");
export const hasErrata = (c: Card) => !!ERRATA[imgKey(c)];
export const errataKeys = () => Object.keys(ERRATA);
export const preUrl = (c: Card) => shown(NET.pre(c));

// versioni della carta: Regular, poi quelle del suo prodotto (★, ★★, SP), poi quelle uscite in altri prodotti (dalle più recenti)
export function carVers(c: Card): Card[] {
  const base = c.suf ? BYKEY[c.k.split("~")[0]] || c : c;
  const mo: Record<string, number> = { "1": 1, "2": 2, SP: 3 };
  const dt = (e: Card) => (SETBY[e.from || ""] && SETBY[e.from || ""].date) || "";
  const al = (BYCODE[base.code] || [])
    .filter((a) => a.suf && a.k.split("~")[0] === base.k)
    .sort((x, y) => (dt(y) < dt(x) ? -1 : dt(y) > dt(x) ? 1 : x.k < y.k ? -1 : 1))
    .map((a, i) => [a, i] as [Card, number]);
  al.sort((x, y) => {
    const gx = hostSet(x[0]) === base.set ? 0 : 1,
      gy = hostSet(y[0]) === base.set ? 0 : 1;
    if (gx !== gy) return gx - gy;
    const mx = mo[String(x[0].mark)] || 9,
      my = mo[String(y[0].mark)] || 9;
    return mx !== my ? mx - my : x[1] - y[1];
  });
  return [base].concat(al.map((x) => x[0]));
}

// righe "extra" divise per sezione (come splitExtra() del sito)
const EVOTAG_RE = /^(Digivolve|DNA Digivolve|Burst Digivolve|App Fusion|Fusionize)$/;
export function splitExtra(c: Card, iconClass: (s: string) => string) {
  const r = { alt: [] as string[], spec: [] as string[], rule: [] as string[], other: [] as string[], link: [] as string[], asm: [] as string[], xros: [] as string[], ace: [] as string[], lreq: false, ldp: "" };
  (c.extra || "").split("\n").forEach((line) => {
    if (!line.trim()) return;
    line = line.replace(/\u00a0/g, " ");
    if (/^LinkReq:/.test(line)) {
      r.link.push(line.replace(/^LinkReq:\s*/, "").trim());
      r.lreq = true;
      return;
    }
    if (/^LinkDP:/.test(line)) {
      r.ldp = line.replace(/^LinkDP:\s*/, "").replace(/\s*DP\s*$/i, "").trim();
      return;
    }
    if (/^Link:/.test(line) && r.lreq) {
      r.link.push(line.replace(/^Link:\s*/, "").trim());
      return;
    }
    line = line.replace(/^Link:\s*/, "[Link] ");
    const body = line.replace(/^[^:\[]+:\s*(?=\[)/, ""),
      tg = body.match(/^\[([^\]]+)\]/);
    if (/\[Rule\]/.test(line)) r.rule.push(line.replace(/^.*?\[Rule\]\s*/, ""));
    else if (tg && EVOTAG_RE.test(tg[1]))
      body.split(/\s*(?=\[(?:Digivolve|DNA Digivolve|Burst Digivolve|App Fusion|Fusionize)\])/).forEach((x) => {
        x = x.trim();
        if (x) (/^\[Digivolve\]/.test(x) ? r.alt : r.spec).push(x);
      });
    else if (/^\[Link\]/.test(body)) r.link.push(body);
    else if (/^Assembly:/.test(line)) r.asm.push(body);
    else if (/^Digi-Xros:/.test(line)) r.xros.push(body);
    else if (/^Effetto ACE:/.test(line)) r.ace.push(line.replace(/^Effetto ACE:\s*/, ""));
    else if (tg && iconClass(tg[1]) !== "trt") r.other.push(body);
    else r.other.push(line);
  });
  return r;
}

// ---- lista ban/restrizioni (tools/banlist.json)
const BANNED: Record<string, 1> = {},
  RESTR: Record<string, 1> = {};
export const PAIRS: Record<string, string[]> = {};
(BAN?.banned || []).forEach((x: string) => (BANNED[x] = 1));
(BAN?.restricted || []).forEach((x: string) => (RESTR[x] = 1));
(BAN?.pairs || []).forEach((p: [string, string[]]) =>
  p[1].forEach((b) => {
    (PAIRS[p[0]] = PAIRS[p[0]] || []).push(b);
    (PAIRS[b] = PAIRS[b] || []).push(p[0]);
  })
);
export const deckable = (c: Card) => /^(Digi-Egg|Digimon|Tamer|Option|Digimon\/Option)$/.test(c.ct);
export function maxCopies(c: Card) {
  return BANNED[c.code] ? 0 : RESTR[c.code] ? 1 : /up to 50 copies/.test(c.extra || "") ? 50 : 4;
}

// ---- banner dei prodotti e prossime uscite (come nell'app attuale: BANNERS, upSorted, upBadge, upWhen, recentSets)
export const BANNERS: Record<string, 1> = {};
((raw as any).banners || []).forEach((c: string) => (BANNERS[c] = 1));
export const bannerUrl = (code: string) => {
  const u = NET.banner(code);
  return u && shown(u);
};
export const numOf = (c: string) => {
  const m = c.match(/(\d+)/);
  return m ? +m[1] : 0;
};
const IMP: Record<string, number> = { BT: 0, EX: 1, ST: 2, LM: 3, PB: 4, AL: 5 };
export function upSorted() {
  return UPCOMING.slice().sort((a, b) => {
    const an = a.prec === "none",
      bn = b.prec === "none";
    if (an !== bn) return an ? 1 : -1;
    return (a.from || "") < (b.from || "") ? -1 : (a.from || "") > (b.from || "") ? 1 : IMP[typeOf(a.code)] - IMP[typeOf(b.code)] || numOf(a.code) - numOf(b.code);
  });
}
export function monthsTo(u: Upcoming) {
  if (u.prec === "none") return null;
  const t = new Date(),
    d = parseDay(u.from);
  return (d.getFullYear() - t.getFullYear()) * 12 + (d.getMonth() - t.getMonth());
}
// conto alla rovescia diviso in parti (cdText del sito): { big: "2", unit: "mesi", month: "dicembre 2026" }
export function cdParts(u: Upcoming) {
  const m = monthsTo(u);
  if (m === null) return { big: "", unit: "Data da annunciare", month: "", now: false };
  const d = parseDay(u.from),
    month = MONTHS[d.getMonth()] + " " + d.getFullYear();
  if (m < 0) return { big: "", unit: "Uscito", month, now: false };
  if (m === 0) return { big: "", unit: "Questo mese", month, now: true };
  return { big: String(m), unit: m === 1 ? "mese" : "mesi", month, now: false };
}
export function upBadge(u: Upcoming) {
  if (u.prec === "none") return "Data da definire";
  if (u.prec === "day") {
    const dd = daysTo(u.from);
    if (dd <= 60) return dd <= 0 ? "Oggi" : dd + (dd === 1 ? " giorno" : " gg");
  }
  const cd = cdParts(u);
  return cd.big ? cd.big + " " + cd.unit : cd.unit;
}
export function upWhen(u: Upcoming) {
  if (u.prec === "none") return "Data da annunciare";
  const d = parseDay(u.from);
  const t = (u.prec === "day" ? d.getDate() + " " : "") + MONTHS[d.getMonth()] + " " + d.getFullYear();
  return t.charAt(0).toUpperCase() + t.slice(1);
}
export function recentSets(n: number) {
  return SETS.filter((x) => x.date && x.date.charAt(0) !== "0" && BANNERS[x.code] && !soonSet(x))
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : IMP[a.type] - IMP[b.type] || numOf(b.code) - numOf(a.code)))
    .slice(0, n);
}
