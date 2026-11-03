// Immagini offline (come offItems/offStart/offAuto dell'app attuale): si scaricano in anticipo nella cartella delle immagini
// (imgstore), saltando quelle già salvate, 6 alla volta. Scelte: "t" solo miniature, "hd" tutto (carte grandi, miniature,
// pre errata, banner, confezioni, loghi) o un prodotto alla volta; "upd" = aggiornamento automatico (la scelta generale
// più i prodotti scaricati uno per uno).
// Impostazioni in "dg-offline": m = scelta generale, full = completata almeno una volta, auto = scarica in sottofondo le
// immagini nuove e aggiornate, done = firma dell'elenco completato, paused = messa in pausa, miss = immagini che il sito
// non ha (si riprovano a ogni avvio), ps = prodotti scaricati uno per uno, x = prodotti tolti a mano da "Tutto in HD",
// run = scaricamento in corso (se l'app viene chiusa riprende al prossimo avvio).
import { useEffect, useState } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import * as Network from "expo-network";
import { BANNERS, CARDS, Card, NET, PRODUCTS, SETBY, SETS, cardsOfSet, errataKeys, hasErrata } from "./data";
import { HAVE, dropAll, dropImgs, dropKind, fileOf, loadImages, loadVersions, saveImg, vurl } from "./imgstore";
import { toast } from "./toast";
import { BGD } from "./bgdl";

export const AVG = { f: 72200, t: 6350, pre: 79400, b: 243800, pk: 28000, lg: 21900 }; // pesi medi misurati sul sito (byte)
export type Item = { u: string; w: number; n: string };
type List = Item[] & { sig?: string; w?: number };

export const OFF = { m: "", full: false, auto: false, done: "", paused: false, miss: [] as string[], ps: [] as string[], x: [] as string[], run: "", updSig: "" };
let loaded: Promise<void> | null = null;
function load() {
  if (loaded) return loaded;
  loaded = (async () => {
    try {
      const v = JSON.parse((await AsyncStorage.getItem("dg-offline")) || "null");
      if (v && typeof v === "object") (Object.keys(OFF) as (keyof typeof OFF)[]).forEach((k) => k in v && ((OFF as any)[k] = v[k]));
    } catch (e) {}
    await loadImages();
    emit();
  })();
  return loaded;
}
const save = () => AsyncStorage.setItem("dg-offline", JSON.stringify(OFF)).catch(() => {});

export const owner = (c: Card) => (c.suf ? c.from || c.set : c.set); // prodotto a cui "appartiene" l'immagine della carta
let LISTS: Record<string, List> = {};
export function items(scope: string): List {
  if (LISTS[scope]) return LISTS[scope];
  const seen: Record<string, 1> = {},
    list: List = [],
    X: Record<string, 1> = {};
  if (scope === "hd") OFF.x.forEach((id) => (X[id] = 1));
  const add = (u: string | null, w: number) => {
    if (!u) return;
    u = vurl(u);
    if (!seen[u]) {
      seen[u] = 1;
      list.push({ u, w, n: fileOf(u) });
    }
  };
  const addCard = (c: Card) => {
    add(NET.t(c), AVG.t);
    if (scope !== "t" && !X[owner(c)]) add(NET.f(c), AVG.f);
  };
  const addProd = (code: string) => {
    const s = SETS.find((x) => x.code === code);
    if (s && X[s.id]) return;
    add(NET.banner(code), AVG.b);
    add(NET.pack(code), AVG.pk);
    add(NET.logo(code), AVG.lg);
  };
  if (scope === "t" || scope === "hd") {
    CARDS.forEach(addCard);
    SETS.forEach((x) => cardsOfSet(x.id).forEach(addCard));
    if (scope === "hd") {
      errataKeys().forEach((k) => add(NET.pre(k), AVG.pre));
      Object.keys(BANNERS).forEach(addProd);
      Object.keys(PRODUCTS).forEach(addProd);
    }
  } else if (scope === "upd") {
    if (OFF.m) items(OFF.m).forEach((x) => add(x.u, x.w));
    OFF.ps.forEach((id) => SETBY[id] && items(id).forEach((x) => add(x.u, x.w)));
  } else if (SETBY[scope]) {
    cardsOfSet(scope).forEach(addCard);
    addProd(SETBY[scope].code);
  }
  let h = 5381;
  list.forEach((x) => {
    for (let i = 0; i < x.u.length; i++) h = ((h * 33) ^ x.u.charCodeAt(i)) >>> 0;
  });
  list.sig = scope + "|" + list.length + "|" + h;
  list.w = list.reduce((a, x) => a + x.w, 0);
  return (LISTS[scope] = list);
}
export function mb(b: number) {
  const m = b / 1048576;
  return m >= 100 ? Math.round(m / 10) * 10 + " MB" : m >= 10 ? Math.round(m) + " MB" : (Math.round(m * 10) / 10).toLocaleString("it-IT") + " MB";
}
export const label = (scope: string) => (scope === "t" ? "Miniature" : scope === "hd" ? "Tutto in HD" : scope === "upd" ? "Immagini nuove e aggiornate" : SETBY[scope] ? SETBY[scope].code + " · " + SETBY[scope].name : "Prodotto");
export const count = (list: Item[]) => list.reduce((a, x) => a + (HAVE.has(x.n) ? 1 : 0), 0);
export function missing(list: Item[]) {
  const m: Record<string, 1> = {};
  OFF.miss.forEach((u) => (m[u] = 1));
  return list.reduce((a, x) => a + (m[x.u] && !HAVE.has(x.n) ? 1 : 0), 0);
}
export async function cell() {
  try {
    return (await Network.getNetworkStateAsync()).type === Network.NetworkStateType.CELLULAR;
  } catch (e) {
    return false;
  }
}

// avvisi alla pagina (al massimo 4 volte al secondo mentre si scarica)
const subs = new Set<() => void>();
function emit() {
  subs.forEach((f) => f());
}
let tickT: any = 0;
function tick() {
  if (!tickT) tickT = setTimeout(() => ((tickT = 0), emit()), 250);
}
export function useOffline() {
  const [, set] = useState(0);
  useEffect(() => {
    const f = () => set((x) => x + 1);
    subs.add(f);
    load().then(f);
    return () => {
      subs.delete(f);
    };
  }, []);
}
export const PAGE = { open: false }; // pagina "Immagini offline" aperta (niente avviso a fine aggiornamento)

// scaricamento in corso (uno alla volta)
export type Run = { scope: string; total: number; done: number; fail: number; row: number; stop: boolean; end: boolean; quiet: boolean; err?: string; newN?: number; wait?: boolean; bg?: boolean };
export let RUN: Run | null = null;
// Attesa tra un tentativo e l'altro. Con il servizio nativo attivo l'attesa la fa Android (i timer di JavaScript si fermano
// con l'app in sottofondo e lo schermo spento); le attese lunghe finiscono subito quando torna la connessione.
function sleep(ms: number) {
  return new Promise<void>((res) => {
    let done = false,
      sub: any = null;
    const end = () => {
      if (done) return;
      done = true;
      try {
        sub && sub.remove();
      } catch (e) {}
      res();
    };
    if (BGD && RUN && RUN.bg) BGD.sleep(ms).then(end, end);
    setTimeout(end, ms);
    if (ms >= 5000)
      try {
        sub = Network.addNetworkStateListener((st) => {
          if (st.isConnected && st.isInternetReachable !== false) end();
        });
      } catch (e) {}
  });
}
// notifica dell'avanzamento del servizio nativo (APK): al massimo ogni 1,5 secondi
let notT = 0;
function notify(R: Run, force?: boolean, msg?: string) {
  if (!BGD || !R.bg) return;
  const now = Date.now();
  if (!force && now - notT < 1500) return;
  notT = now;
  const pc = R.total ? Math.floor((R.done / R.total) * 100) : 0;
  BGD.update("Scaricamento immagini · " + label(R.scope), (msg ? msg + " · " : "") + R.done.toLocaleString("it-IT") + " di " + R.total.toLocaleString("it-IT") + " · " + pc + "%", R.done, R.total);
}

export async function start(scope: string, quiet = false, newN?: number) {
  if (RUN && !RUN.end) return;
  await load();
  if (scope === "upd") delete LISTS.upd;
  const list = items(scope);
  const R: Run = (RUN = { scope, total: list.length, done: 0, fail: 0, row: 0, stop: false, end: false, quiet, newN });
  if (scope === "t" || scope === "hd") {
    OFF.paused = false;
    save();
  }
  const todo = list.filter((x) => !HAVE.has(x.n));
  R.done = R.total - todo.length;
  emit();
  if (todo.length) {
    // pochi file: il servizio in sottofondo non serve
    if (BGD && todo.length >= 30)
      BGD.start("Scaricamento immagini · " + label(scope), "Preparazione…", quiet).then((ok) => {
        if (!ok) return;
        if (R.end) return BGD && BGD.stop(); // già finito mentre partiva
        R.bg = true;
        notify(R, true);
      });
    OFF.run = scope;
    save();
  }
  // senza connessione non ci si ferma: si aspetta e si riprova la stessa immagine, con attese crescenti (5 s … 30 s);
  // ci si arrende solo dopo 20 minuti senza nessuno scaricamento riuscito
  let i = 0,
    lastOk = Date.now(),
    waitMs = 0;
  const one = async () => {
    while (!R.stop && i < todo.length) {
      const x = todo[i++];
      for (let n = 0; ; ) {
        const r = await saveImg(x.u);
        if (r === "ok") {
          R.row = 0;
          waitMs = 0;
          lastOk = Date.now();
          R.wait = false;
          break;
        }
        if (R.stop) break;
        if (r === "net") {
          R.row++;
          if (Date.now() - lastOk > 20 * 60e3) {
            R.stop = true;
            R.err = "Connessione assente da molto tempo: lo scaricamento si è fermato. Puoi riprenderlo più tardi.";
            break;
          }
          if (R.row < 3) await sleep(1000);
          else {
            waitMs = Math.min(30e3, waitMs ? waitMs * 2 : 5e3);
            R.wait = true;
            tick();
            notify(R, true, "In attesa della connessione…");
            await sleep(waitMs);
          }
          if (R.stop) break;
          continue;
        }
        // l'immagine non c'è sul sito: un secondo tentativo, poi si segna come mancante
        if (n++ < 1) continue;
        R.fail++;
        if (OFF.miss.indexOf(x.u) < 0 && OFF.miss.length < 60) {
          OFF.miss.push(x.u);
          save();
        }
        break;
      }
      R.done++;
      notify(R);
      tick();
    }
  };
  await Promise.all([0, 1, 2, 3, 4, 5].map(one));
  R.end = true;
  if (R.bg) {
    R.bg = false;
    BGD && BGD.stop();
  }
  OFF.run = ""; // finito, messo in pausa o fermato: niente ripresa automatica al prossimo avvio
  if ((scope === "t" || scope === "hd") && OFF.m === scope) {
    if (!R.stop) {
      OFF.done = R.fail ? "" : list.sig || "";
      OFF.full = true;
    } else OFF.paused = true;
  }
  if (SETBY[scope] && !R.stop && OFF.ps.indexOf(scope) < 0) {
    OFF.ps.push(scope);
    OFF.x = OFF.x.filter((id) => id !== scope);
    delete LISTS.hd;
  }
  if (scope === "upd" && !R.stop) {
    OFF.updSig = list.sig || "";
    if (R.total - R.fail > 0 && R.newN && !PAGE.open) toast(R.newN.toLocaleString("it-IT") + (R.newN === 1 ? " immagine nuova o aggiornata scaricata" : " immagini nuove o aggiornate scaricate"));
  }
  save();
  emit();
}
export function pause() {
  if (RUN && !RUN.end) {
    RUN.stop = true;
    emit();
  }
}
// una delle due scelte generali
export function choose(scope: string) {
  OFF.m = scope;
  if (scope === "hd") {
    OFF.x = [];
    delete LISTS.hd;
  }
  if (OFF.done.indexOf(scope + "|") !== 0) OFF.full = false;
  save();
  start(scope);
}

// elimina tutto (anche la cache di expo-image)
export async function deleteAll() {
  pause();
  Object.assign(OFF, { m: "", full: false, done: "", paused: false, miss: [], ps: [], x: [], updSig: "" });
  save();
  LISTS = {};
  await dropAll();
  await Promise.all([Image.clearDiskCache(), Image.clearMemoryCache()]).catch(() => {});
  RUN = null;
  emit();
}
// "t" = tutte le miniature; "hd" = tutto tranne le miniature. Togliere la scelta attuale la azzera.
export async function deleteKind(kind: "t" | "hd") {
  pause();
  const isT = kind === "t";
  if (OFF.m === kind) Object.assign(OFF, { m: "", full: false, done: "", paused: false });
  if (!isT) Object.assign(OFF, { ps: [], x: [] });
  LISTS = {};
  save();
  await dropKind(isT ? "t" : "o");
  emit();
}
// un solo prodotto: carte grandi del prodotto (non le ristampe di altri prodotti), pre errata, banner/confezione/logo;
// le miniature restano se c'è una scelta generale. Con "Tutto in HD" il prodotto viene escluso (OFF.x).
export async function deleteSet(id: string) {
  const s = SETBY[id];
  if (!s) return;
  const keepT = !!OFF.m,
    del: string[] = [];
  cardsOfSet(id).forEach((c) => {
    if (owner(c) !== id) return;
    del.push(vurl(NET.f(c)));
    if (!keepT) del.push(vurl(NET.t(c)));
    if (hasErrata(c)) del.push(vurl(NET.pre(c)));
  });
  [NET.banner(s.code), NET.pack(s.code), NET.logo(s.code)].forEach((u) => u && del.push(vurl(u)));
  OFF.ps = OFF.ps.filter((x) => x !== id);
  if (OFF.m === "hd" && OFF.x.indexOf(id) < 0) OFF.x.push(id);
  LISTS = {};
  save();
  await dropImgs(del);
  emit();
}

// scaricamento automatico: all'avvio (dopo 8 s) e tornando nell'app dopo 3 ore, con le versioni delle immagini aggiornate
export async function auto(startUp: boolean) {
  await load();
  if (RUN && !RUN.end) return;
  const mob = await cell();
  // uno scaricamento interrotto perché l'app è stata chiusa: riprende da dove era
  if (startUp && OFF.run && (OFF.run === "t" || OFF.run === "hd" || OFF.run === "upd" || SETBY[OFF.run]) && !(mob && OFF.run === "hd")) return start(OFF.run, true);
  // scaricamento generale lasciato a metà (non in pausa): riparte, ma non con i dati mobili
  if (startUp && OFF.m && !OFF.paused && !OFF.full && OFF.done !== items(OFF.m).sig && !mob) return start(OFF.m, true);
  if (!OFF.auto || OFF.paused || !(OFF.m || OFF.ps.length)) return;
  delete LISTS.upd;
  const L = items("upd");
  const todo = L.filter((x) => !HAVE.has(x.n));
  if (!todo.length) return;
  const miss: Record<string, 1> = {};
  OFF.miss.forEach((u) => (miss[u] = 1));
  const w = todo.reduce((a, x) => a + x.w, 0);
  if (mob && w > 10 * 1048576) return;
  const newN = todo.filter((x) => !miss[x.u]).length;
  start("upd", true, newN);
}
export function setAuto(v: boolean) {
  OFF.auto = v;
  save();
  emit();
  if (v) auto(false);
}
let started = false;
export function startOffline() {
  if (started) return;
  started = true;
  setTimeout(() => loadVersions().then((ch) => (ch && (LISTS = {}), auto(true))), 8000);
  let away = 0;
  AppState.addEventListener("change", (s) => {
    if (s !== "active") {
      if (!away) away = Date.now();
      return;
    }
    if (away && Date.now() - away > 3 * 3600e3) loadVersions().then((ch) => (ch && (LISTS = {}), auto(false)));
    away = 0;
  });
}
