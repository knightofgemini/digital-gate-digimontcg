// Carte aggiornate senza installare un APK nuovo (31 ottobre 2026): il sito pubblica i dati anche come file a parte
// (www/dati/ di tools/build.py: data.json, products.json e ver.json con impronta "h" e momento della pubblicazione "t").
// All'apertura e tornando nell'app dopo 3 ore si legge ver.json; se i dati sono più recenti di quelli in uso si
// scaricano, si salvano nel dispositivo e si mettono subito in uso ad app aperta (data.ts → setData, 6 novembre 2026:
// niente riavvio), poi il riquadro "Carte nuove" (News.tsx) elenca le carte nuove e corrette.
// Alle aperture successive data.ts li usa da sé (pickData, lettura sincrona), se sono più recenti di quelli inclusi
// nell'APK (rn/data/ver.json, scritto da scripts/sync-data.js). Così arrivano anche gli spoiler pubblicati da soli.
import { AppState, Platform } from "react-native";
import { File, Paths } from "expo-file-system";
import { documentDirectory, writeAsStringAsync } from "expo-file-system/legacy";
import bundledVer from "../data/ver.json";

type Ver = { h: string; t: number };
const SITE = "https://knightofgemini.github.io/digital-gate-digimontcg/dati/";
const NATIVE = Platform.OS !== "web" && !!documentDirectory;
const NAMES = { d: "dg-data.json", p: "dg-products.json", v: "dg-ver.json", n: "dg-news.json" };
const BUNDLED: Ver = bundledVer as any;

// dati in uso in questa sessione (quelli dell'APK o gli ultimi scaricati)
export let CURVER: Ver = BUNDLED;
// dati delle carte e dei prodotti in uso: con quelli nuovi si fa l'elenco "Carte nuove" (News.tsx)
let USED: any = null,
  USEDP: any = null;
// sostituzione del catalogo ad app aperta (setData di data.ts, che la registra qui: data.ts importa già questo file)
let APPLY: ((raw: any, products: any) => void) | null = null;
export const setApply = (f: (raw: any, products: any) => void) => {
  APPLY = f;
};

// chiamata da data.ts prima di costruire carte e prodotti: legge in modo sincrono i dati salvati, se più recenti
export function pickData<D, P>(raw: D, products: P): { raw: D; products: P } {
  USED = raw;
  USEDP = products;
  if (!NATIVE) return { raw, products };
  // APK di prova del riquadro "Carte nuove" (apk-prova.yml con "novita": dentro ci sono apposta i dati di prima del
  // 3 novembre 2026): alla prima apertura di questo APK si scartano i dati già scaricati (solo la copia delle carte,
  // non collezione e mazzi), così l'app riscarica quelli del sito e mostra il riquadro come all'arrivo di carte nuove
  if ((BUNDLED as any).demo) {
    try {
      const mk = new File(Paths.document, "dg-demo-" + BUNDLED.h);
      if (!mk.exists) {
        mk.create();
        const old = new File(Paths.document, NAMES.v);
        if (old.exists) old.delete();
      }
    } catch (e) {}
  }
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
    USEDP = p;
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

const LOG = (m: string) => console.log("[carte-nuove] " + m); // PROVA: da togliere
let busy = false;
async function check(onNew: (n: News) => void) {
  if (busy) return;
  busy = true;
  try {
    const v: Ver = await fetch(SITE + "ver.json", { cache: "no-store" } as any).then((r) => (r.ok ? r.json() : null));
    const have = CURVER;
    if (!v || !v.h || v.h === have.h || !(v.t > have.t)) return;
    const [d, p] = await Promise.all([SITE + "data.json", SITE + "products.json"].map((u) => fetch(u, { cache: "no-store" } as any).then((r) => (r.ok ? r.text() : ""))));
    LOG("scaricati " + d.length);
    const D = JSON.parse(d),
      P = JSON.parse(p);
    if (!D || !D.cards || !D.sets || !D.cards.length || !P) return;
    // elenco delle carte cambiate rispetto a quelle in uso
    let news: News | null = null;
    try {
      if (USED) news = { h: v.h, ...diffData(USED, D) };
    } catch (e) {
      LOG("diff errore " + e);
    }
    LOG("diff " + (news ? news.n + "/" + news.c : "-"));
    // prima i dati, ver.json per ultimo: se lo scaricamento si interrompe a metà restano in uso quelli di prima
    await writeAsStringAsync(documentDirectory + NAMES.d, d);
    await writeAsStringAsync(documentDirectory + NAMES.p, p);
    if (news) await writeAsStringAsync(documentDirectory + NAMES.n, JSON.stringify(news));
    await writeAsStringAsync(documentDirectory + NAMES.v, JSON.stringify(v));
    // in uso subito, senza riavviare l'app; se qualcosa va storto si torna ai dati di prima (quelli nuovi restano
    // salvati e si usano alla prossima apertura)
    LOG("salvati");
    if (!APPLY) return;
    try {
      APPLY(D, P);
      LOG("in uso");
      CURVER = v;
      USED = D;
      USEDP = P;
    } catch (e) {
      LOG("setData errore " + e);
      try {
        APPLY(USED, USEDP);
      } catch (e2) {}
      return;
    }
    // nessuna carta cambiata (es. solo lista ban o schede dei prodotti): niente riquadro
    if (news && news.groups.length) onNew(news);
    LOG("riquadro chiesto");
  } catch (e) {
    LOG("errore " + e);
  } finally {
    busy = false;
  }
}


let started = false;
export function startDataUpdates(onNew: (n: News) => void) {
  if (!NATIVE || started) return;
  started = true;
  // subito all'apertura (mentre gira l'intro): carte in uso e riquadro appena i dati sono scaricati
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
