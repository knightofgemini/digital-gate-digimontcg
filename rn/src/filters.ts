// Filtri della ricerca carte, con le stesse regole del sito (ddKinds, ddValues, cardMatches, srcCards).
import { BYCODE, CARDS, COLORS, Card, SETBY, SETS, TYPES, cardsOfSet, fold } from "./data";

export type Filters = { qm: string; color: string; ct: string; lv: string; cost: string; attr: string; sp: string; rar: string; exp: string };
export const EMPTY: Filters = { qm: "", color: "", ct: "", lv: "", cost: "", attr: "", sp: "", rar: "", exp: "" };
export type Kind = keyof Filters;

export const DDN: Record<Kind, string> = { qm: "Cerca in", color: "Colore", ct: "Tipologia", lv: "Livello", cost: "Costo", attr: "Attributo", sp: "Tipo", rar: "Rarità", exp: "Espansione" };
// scelta multipla: valori separati da "|", la carta va bene se ha almeno uno dei valori scelti
export const MULTI: Partial<Record<Kind, 1>> = { color: 1, attr: 1, sp: 1 };
export const CARDTYPES = ["Digimon", "Digi-Egg", "Tamer", "Option", "Digimon/Option"];
const RARORD = ["C", "U", "R", "SR", "UR", "SEC", "P"];
export const MARKV: Record<string, number | "SP"> = { "★": 1, "★★": 2, SP: "SP" };
const MARKS = ["★", "★★", "SP"];

export const fl = (f: Filters, k: Kind) => (f[k] ? String(f[k]).split("|") : []);

export function costOf(c: Card) {
  const a: string[] = [];
  if (c.play !== "" && c.play != null) a.push(String(c.play));
  if (c.x && c.x.d && c.x.d.c != null && c.x.d.c !== "") a.push(String(c.x.d.c));
  return a;
}
export const traitsOf = (c: Card) =>
  (c.sp || "")
    .split("/")
    .map((t) => t.trim())
    .filter(Boolean);

// Digimon (e Digimon/Option) → anche il livello
export function ddKinds(f: Filters): Kind[] {
  const k: Kind[] = ["qm", "color", "ct"];
  if (f.ct === "Digimon" || f.ct === "Digimon/Option") k.push("lv");
  k.push("cost", "attr", "sp", "rar", "exp");
  return k;
}

// tutte le versioni (carte base + alternative art): servono per filtrare per ★, ★★ e SP
let ALLV: Card[] | null = null;
export function allVers() {
  if (!ALLV) {
    ALLV = [];
    const seen: Record<string, 1> = {};
    CARDS.forEach((c) => {
      ALLV!.push(c);
      if (seen[c.code]) return;
      seen[c.code] = 1;
      (BYCODE[c.code] || []).forEach((a) => a.suf && ALLV!.push(a));
    });
  }
  return ALLV;
}

export function ddValues(kind: Kind, f: Filters): string[] {
  const seen: Record<string, 1> = {};
  CARDS.forEach((c) => {
    if (f.ct && c.ct.indexOf(f.ct) < 0) return;
    if (kind === "lv") {
      if (c.lv) seen[c.lv] = 1;
    } else if (kind === "attr") {
      if (c.attr && c.attr !== "NO DATA") seen[c.attr] = 1;
    } else if (kind === "sp") traitsOf(c).forEach((v) => (seen[v] = 1));
    else if (kind === "rar") {
      const r = (c.rar || "").trim();
      if (r) seen[r] = 1;
    } else costOf(c).forEach((v) => (seen[v] = 1));
  });
  let ks = Object.keys(seen);
  if (kind === "rar") {
    const ri = (x: string) => {
      const i = RARORD.indexOf(x);
      return i < 0 ? 50 : i;
    };
    ks.sort((x, y) => ri(x) - ri(y) || (x < y ? -1 : 1));
    const mk: Record<string, 1> = {};
    allVers().forEach((c) => {
      if (c.suf && c.mark && (!f.ct || c.ct.indexOf(f.ct) >= 0)) mk[String(c.mark)] = 1;
    });
    const hasP = ks.indexOf("P") >= 0;
    ks = ks.filter((x) => x !== "P");
    return ks.concat(
      MARKS.filter((m) => mk[String(MARKV[m])]),
      hasP ? ["P"] : []
    );
  }
  if (kind === "attr") {
    const AO = ["Vaccine", "Virus", "Data", "Free", "Variable", "Unknown"];
    return ks.sort((x, y) => {
      const a = AO.indexOf(x),
        b = AO.indexOf(y);
      return (a < 0 ? 99 : a) - (b < 0 ? 99 : b) || (x < y ? -1 : 1);
    });
  }
  if (kind === "sp") return ks.sort((x, y) => (x.toLowerCase() < y.toLowerCase() ? -1 : 1));
  return ks.sort((x, y) => parseInt(x.replace(/\D/g, ""), 10) - parseInt(y.replace(/\D/g, ""), 10));
}

const numOf = (c: string) => {
  const m = c.match(/(\d+)/);
  return m ? +m[1] : 0;
};
// opzioni: [valore, etichetta, colore?]; valore null = titolo di gruppo
export function ddOptions(kind: Kind, f: Filters): [string | null, string, string?][] {
  if (kind === "qm") return [["", "Tutto (nome, codice e testo)"], ["name", "Solo nel nome"], ["text", "Solo nel testo"]];
  if (kind === "color") return [["", "Tutti i colori"] as [string, string]].concat(Object.keys(COLORS).map((k) => [k, k, k] as any));
  if (kind === "ct") return [["", "Tutte le tipologie"] as [string, string]].concat(CARDTYPES.map((k) => [k, k] as [string, string]));
  if (kind === "exp") {
    const o: [string | null, string][] = [["", "Tutte le espansioni"]];
    Object.keys(TYPES).forEach((t) => {
      const items = SETS.filter((x) => x.type === t).sort((a, b) => ((b.date || "") < (a.date || "") ? -1 : (b.date || "") > (a.date || "") ? 1 : 0) || numOf(b.code) - numOf(a.code));
      if (!items.length) return;
      o.push([null, TYPES[t]]);
      items.forEach((x) => o.push([x.id, x.code]));
    });
    return o;
  }
  return [["", "Tutti"] as [string, string]].concat(ddValues(kind, f).map((v) => [v, v] as [string, string]));
}

export function ddShown(kind: Kind, f: Filters) {
  const v = f[kind];
  if (!v) return kind === "qm" ? "Tutto" : kind === "exp" || kind === "ct" ? "Tutte" : "Tutti";
  if (kind === "exp") return SETBY[v] ? SETBY[v].code : v;
  if (MULTI[kind]) {
    const n = fl(f, kind).length;
    if (n > 1) return n + (kind === "color" ? " colori" : kind === "attr" ? " attributi" : " tipi");
  }
  return kind === "qm" ? (v === "name" ? "Nome" : "Testo") : v;
}

// quando cambia la tipologia, livello, costo, attributo, tipo e rarità restano solo se ancora sensati
export function ddFix(f: Filters): Filters {
  const n = { ...f };
  const k = ddKinds(n);
  if (k.indexOf("lv") < 0) n.lv = "";
  else if (n.lv && ddValues("lv", n).indexOf(n.lv) < 0) n.lv = "";
  if (n.cost && ddValues("cost", n).indexOf(n.cost) < 0) n.cost = "";
  (["attr", "sp"] as Kind[]).forEach((x) => {
    if (n[x]) {
      const ok = ddValues(x, n);
      n[x] = fl(n, x)
        .filter((v) => ok.indexOf(v) >= 0)
        .join("|");
    }
  });
  if (n.rar && ddValues("rar", n).indexOf(n.rar) < 0) n.rar = "";
  return n;
}

export const anyFlt = (f: Filters) => (Object.keys(f) as Kind[]).some((k) => k !== "qm" && f[k]);

// carte da cui cercare: quelle dell'espansione scelta (anche alternative art e ristampe uscite lì) o tutto il catalogo
export function srcCards(f: Filters, base: Card[]) {
  return f.exp && SETBY[f.exp] ? cardsOfSet(f.exp) : MARKV[f.rar] != null ? allVers() : base;
}

// testo cercabile delle carte (tratti, forma, effetti...), calcolato una volta sola
const TB = new WeakMap<Card, string>();
function textOf(c: Card) {
  let t = TB.get(c);
  if (t == null) {
    t = " " + fold([c.sp, c.form, c.attr, c.eff, c.inh, c.sec, c.extra, c.x && c.x.d ? c.x.d.l.join(" ") : ""].join(" ")) + " ";
    TB.set(c, t);
  }
  return t;
}

export function cardMatches(c: Card, q: string, f: Filters) {
  if (f.color && !fl(f, "color").some((x) => c.colors.indexOf(x) >= 0)) return false;
  if (f.ct && c.ct.indexOf(f.ct) < 0) return false;
  if (f.lv && c.lv !== f.lv) return false;
  if (f.cost && costOf(c).indexOf(f.cost) < 0) return false;
  if (f.attr && fl(f, "attr").indexOf(c.attr) < 0) return false;
  if (f.sp && !fl(f, "sp").some((x) => traitsOf(c).indexOf(x) >= 0)) return false;
  if (f.rar) {
    if (MARKV[f.rar] != null) {
      if (!c.suf || c.mark !== MARKV[f.rar]) return false;
    } else if ((c.rar || "").trim() !== f.rar) return false;
  }
  if (q) {
    const hay = f.qm === "name" ? c.nb : f.qm === "text" ? textOf(c) : c.nb + textOf(c);
    const parts = q.split(" ");
    for (let i = 0; i < parts.length; i++) if (hay.indexOf(parts[i]) < 0) return false;
  }
  return true;
}

// testo del campo di ricerca secondo "Cerca in" (come nell'app attuale)
export const qmHolder = (qm: string) => (qm === "name" ? "Cerca per nome, es. Omnimon" : qm === "text" ? "Cerca nel testo un nome, keyword o parola, es. Omnimon, Barrier o draw" : "Cerca per nome, codice o testo, es. Agumon");
