// Carte aggiornate senza installare un APK nuovo (31 ottobre 2026): il sito pubblica i dati anche come file a parte
// (www/dati/ di tools/build.py: data.json, products.json e ver.json con impronta "h" e momento della pubblicazione "t").
// All'apertura e tornando nell'app dopo 3 ore si legge ver.json; se i dati sono più recenti di quelli in uso si
// scaricano e si salvano nel dispositivo, poi il riquadro "Carte nuove" (News.tsx, 6 novembre 2026) elenca le carte
// nuove e corrette e propone "Mostra le carte" (riavvio veloce dell'app, poi la pagina del prodotto o della carta).
// All'avvio successivo data.ts li usa comunque da sé (pickData, lettura sincrona), se sono più recenti di quelli
// inclusi nell'APK (rn/data/ver.json, scritto da scripts/sync-data.js). Così arrivano anche gli spoiler pubblicati da soli.
import { AppState, Platform } from "react-native";
import { File, Paths } from "expo-file-system";
import { documentDirectory, writeAsStringAsync } from "expo-file-system/legacy";
import { reloadAppAsync } from "expo";
import bundledVer from "../data/ver.json";

type Ver = { h: string; t: number };
const SITE = "https://knightofgemini.github.io/digital-gate-digimontcg/dati/";
const NATIVE = Platform.OS !== "web" && !!documentDirectory;
const NAMES = { d: "dg-data.json", p: "dg-products.json", v: "dg-ver.json", n: "dg-news.json", g: "dg-goto.json" };
const BUNDLED: Ver = bundledVer as any;

// dati in uso in questa sessione (quelli dell'APK o gli ultimi scaricati)
export let CURVER: Ver = BUNDLED;
let PENDING: Ver | null = null; // scaricati ma non ancora in uso (si usano riaprendo l'app o con "Mostra le carte")
let USED: any = null; // dati delle carte in uso: con quelli nuovi si fa l'elenco "Carte nuove" (News.tsx)

// pagina da aprire dopo il riavvio di "Mostra le carte" (prodotto o carta toccati nel riquadro); letta una volta sola
export type Goto = { set?: string; k?: string; keys?: string[] };
export let GOTO: Goto | null = null;
export const takeGoto = () => {
  readGoto();
  const g = GOTO;
  GOTO = null;
  return g;
};
// riavvio chiesto da "Mostra le carte": niente intro, si va subito alla pagina
export const gotoPending = () => (readGoto(), !!GOTO);
let gotoRead = false;
function readGoto() {
  if (gotoRead || !NATIVE) return;
  gotoRead = true;
  try {
    const f = new File(Paths.document, NAMES.g);
    if (!f.exists) return;
    const g = JSON.parse(f.textSync());
    f.delete();
    // solo se il riavvio è di pochi minuti fa (non un file rimasto lì da un riavvio non riuscito)
    if (g && Date.now() - (g.at || 0) < 5 * 60e3) GOTO = g;
  } catch (e) {}
}

// chiamata da data.ts prima di costruire carte e prodotti: legge in modo sincrono i dati salvati, se più recenti
export function pickData<D, P>(raw: D, products: P): { raw: D; products: P } {
  USED = raw;
  if (!NATIVE) return { raw, products };
  readGoto();
  try {
    const vf = new File(Paths.document, NAMES.v);
    if (!vf.exists) return { raw, products };
    const v: Ver = JSON.parse(vf.textSync());
    if (!v || !(v.t > (BUNDLED.t || 0))) return { raw, products };
    const d = JSON.parse(new File(Paths.document, NAMES.d).textSync());
    const p = JSON.parse(new File(Paths.document, NAMES.p).textSync());
    if (!d || !d.cards || !d.sets || !p) return { raw, products };
    CURVER = v;
    USED = d;
    return { raw: d, products: p };
  } catch (e) {
    return { raw, products };
  }
}

// ---- Riepilogo delle carte arrivate (riquadro "Carte nuove", News.tsx)
// Confronto tra i dati in uso e quelli scaricati, prodotto per prodotto: "n" = carta nuova nel prodotto (anche una
// ristampa o un'alternativa appena svelata), "c" = carta già presente ma corretta (testo, DP, costo, stelle…), segnata
// solo nel suo prodotto. Salvato in dg-news.json insieme ai dati, così si può mostrare anche all'apertura successiva.
export type NewsCard = { k: string; code: string; name: string; u: string; mark: string; colors: string[]; kind: "n" | "c"; what?: string };
export type NewsGroup = { id: string; code: string; name: string; date: string; soon: boolean; n: number; c: number; cards: NewsCard[] };
export type News = { h: string; at: number; n: number; c: number; groups: NewsGroup[]; seen?: number };

const IMG = "https://knightofgemini.github.io/digital-gate-digimontcg/img/";
const FIELDS: [number, string][] = [
  [1, "nome"],
  [2, "livello"],
  [3, "colore"],
  [4, "tipo"],
  [5, "forma"],
  [6, "attributo"],
  [7, "tratti"],
  [8, "DP"],
  [9, "costo"],
  [10, "digievoluzione"],
  [15, "rarità"],
];
type Ent = { k: string; a: any[]; suf: string; ver: string; mark: any; cls: string; host: string };

function future(d: string) {
  if (!d || d.charAt(0) === "0") return false;
  const p = d.split("-"),
    t = new Date();
  t.setHours(0, 0, 0, 0);
  return new Date(+p[0], +p[1] - 1, +(p[2] || 1)).getTime() > t.getTime();
}

// versioni di ogni prodotto con le stesse chiavi di data.ts ("set|codice", "#n" per i doppioni, "~suf" per le alternative)
function entries(R: any) {
  const cards: any[][] = R.cards || [],
    vers: string[] = R.versions || ["Normal"];
  const keys: string[] = [],
    cnt: Record<string, number> = {};
  cards.forEach((a, i) => {
    const b = a[16] + "|" + a[0];
    cnt[b] = (cnt[b] || 0) + 1;
    keys[i] = cnt[b] > 1 ? b + "#" + cnt[b] : b;
  });
  const bySet: Record<string, Ent[]> = {},
    has: Record<string, Record<string, Ent>> = {};
  (R.sets || []).forEach((s: any) => {
    const list: Ent[] = [],
      m: Record<string, Ent> = {};
    (s.v || []).forEach((x: any) => {
      const i = typeof x === "number" ? x : x[0],
        a = cards[i];
      if (!a) return;
      const suf = typeof x === "number" ? "" : x[1] || "";
      const e: Ent = suf ? { k: keys[i] + "~" + suf, a, suf, ver: vers[x[2]] || "", mark: x[3] || 0, cls: x[4] || "", host: s.id } : { k: keys[i], a, suf: "", ver: "", mark: 0, cls: "", host: a[16] };
      if (m[e.k]) return;
      m[e.k] = e;
      list.push(e);
    });
    bySet[s.id] = list;
    has[s.id] = m;
  });
  return { bySet, has };
}

const sig = (e: Ent) => JSON.stringify(e.a) + "|" + e.suf + "|" + e.ver + "|" + e.mark + "|" + e.cls;
function whatChanged(o: Ent, e: Ent) {
  const w: string[] = [];
  FIELDS.forEach(([i, l]) => (o.a[i] || "") !== (e.a[i] || "") && w.push(l));
  if ([11, 12, 13, 14].some((i) => (o.a[i] || "") !== (e.a[i] || "")) || JSON.stringify(o.a[17] || null) !== JSON.stringify(e.a[17] || null)) w.push("testo");
  if (o.mark !== e.mark) w.push("stelle");
  if (o.ver !== e.ver || o.cls !== e.cls) w.push("versione");
  return w.length ? w.join(", ") : "dati";
}

export function diffData(oldR: any, newR: any): Omit<News, "h"> {
  const O = entries(oldR),
    N = entries(newR);
  const err: Record<string, 1> = {};
  (newR.errata || []).forEach((k: string) => (err[k] = 1));
  const date: Record<string, string> = {};
  (newR.sets || []).forEach((s: any) => (date[s.id] = s.date || ""));
  const card = (e: Ent, kind: "n" | "c", what?: string): NewsCard => {
    const img = e.a[0] + e.suf,
      q: string[] = [];
    if (err[img]) q.push("e=1");
    if (future(date[e.a[16]])) q.push("sp=2");
    const nc: NewsCard = { k: e.k, code: e.a[0], name: e.a[1], u: IMG + "t/" + encodeURIComponent(img) + ".webp" + (q.length ? "?" + q.join("&") : ""), mark: !e.suf ? "" : e.mark === "SP" ? "SP" : e.mark === 2 ? "★★" : e.mark === 1 ? "★" : "", colors: e.a[3] ? String(e.a[3]).split("/") : [], kind };
    if (what) nc.what = what;
    return nc;
  };
  const groups: NewsGroup[] = [];
  const told: Record<string, 1> = {};
  let n = 0,
    c = 0;
  (newR.sets || []).forEach((s: any) => {
    const old = O.has[s.id] || {};
    const nw: NewsCard[] = [],
      ch: NewsCard[] = [];
    N.bySet[s.id].forEach((e) => {
      const o = old[e.k];
      if (!o) nw.push(card(e, "n"));
      else if (e.host === s.id && !told[e.k] && sig(o) !== sig(e)) {
        told[e.k] = 1;
        ch.push(card(e, "c", whatChanged(o, e)));
      }
    });
    if (!nw.length && !ch.length) return;
    n += nw.length;
    c += ch.length;
    groups.push({ id: s.id, code: s.code, name: s.name, date: s.date || "", soon: future(s.date), n: nw.length, c: ch.length, cards: nw.concat(ch) });
  });
  // prodotti dal più recente (prima quelli in arrivo, cioè gli spoiler)
  const dk = (g: NewsGroup) => (g.date && g.date.charAt(0) !== "0" ? g.date : "");
  groups.sort((a, b) => (dk(a) < dk(b) ? 1 : dk(a) > dk(b) ? -1 : 0));
  return { at: Date.now(), n, c, groups };
}

// riepilogo da mostrare all'apertura: quello dei dati ora in uso, se non è già stato visto
export function startupNews(): News | null {
  if (!NATIVE) return null;
  try {
    const f = new File(Paths.document, NAMES.n);
    if (!f.exists) return null;
    const n: News = JSON.parse(f.textSync());
    return n && n.h === CURVER.h && !n.seen && n.groups && n.groups.length ? n : null;
  } catch (e) {
    return null;
  }
}
export function newsSeen(n: News) {
  if (!NATIVE) return;
  n.seen = Date.now();
  writeAsStringAsync(documentDirectory + NAMES.n, JSON.stringify(n)).catch(() => {});
}

let busy = false;
async function check(onNew: (n: News) => void) {
  if (busy) return;
  busy = true;
  try {
    const v: Ver = await fetch(SITE + "ver.json", { cache: "no-store" } as any).then((r) => (r.ok ? r.json() : null));
    const have = PENDING || CURVER;
    if (!v || !v.h || v.h === have.h || !(v.t > have.t)) return;
    const [d, p] = await Promise.all([SITE + "data.json", SITE + "products.json"].map((u) => fetch(u, { cache: "no-store" } as any).then((r) => (r.ok ? r.text() : ""))));
    const D = JSON.parse(d),
      P = JSON.parse(p);
    if (!D || !D.cards || !D.sets || !D.cards.length || !P) return;
    // elenco delle carte cambiate rispetto a quelle in uso (anche se nel frattempo erano già stati scaricati altri dati)
    let news: News | null = null;
    try {
      if (USED) news = { h: v.h, ...diffData(USED, D) };
    } catch (e) {}
    // prima i dati, ver.json per ultimo: se lo scaricamento si interrompe a metà restano in uso quelli di prima
    await writeAsStringAsync(documentDirectory + NAMES.d, d);
    await writeAsStringAsync(documentDirectory + NAMES.p, p);
    if (news) await writeAsStringAsync(documentDirectory + NAMES.n, JSON.stringify(news));
    await writeAsStringAsync(documentDirectory + NAMES.v, JSON.stringify(v));
    PENDING = v;
    // nessuna carta cambiata (es. solo lista ban o schede dei prodotti): dati in uso dalla prossima apertura, senza avvisi
    if (news && news.groups.length) onNew(news);
  } catch (e) {
  } finally {
    busy = false;
  }
}

// "Mostra le carte": riavvio veloce dell'app (il catalogo si prepara all'apertura) e poi la pagina scelta nel riquadro
export async function applyNewData(to?: Goto) {
  try {
    // senza prodotto (carte in più prodotti): dopo il riavvio si riapre il riquadro, con le carte già in uso
    if (NATIVE) await writeAsStringAsync(documentDirectory + NAMES.g, JSON.stringify({ ...(to || {}), at: Date.now() }));
  } catch (e) {}
  reloadAppAsync("Carte nuove").catch(() => {});
}

let started = false;
export function startDataUpdates(onNew: (n: News) => void) {
  if (!NATIVE || started) return;
  started = true;
  // subito all'apertura (mentre gira l'intro): il riquadro compare appena i dati sono scaricati
  setTimeout(() => check(onNew), 300);
  let away = 0;
  AppState.addEventListener("change", (s) => {
    if (s !== "active") {
      away = away || Date.now();
      return;
    }
    if (away && Date.now() - away > 3 * 3600e3) check(onNew);
    away = 0;
  });
}
