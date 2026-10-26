// Dati dell'utente salvati nel dispositivo, con le stesse chiavi e lo stesso formato dell'app attuale:
// "dgm-qty" copie per versione {chiave: n}; "dg-fav" preferite {f: {chiave: quando}, l: [{id, n: nome, k: {chiave: quando}}], a: {chiave: soglia €}};
// "dgm-decks" mazzi; "dgm-view" vista elenco/griglia. Così il backup dell'app attuale si importa così com'è.
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BYKEY, Card, SETS, cardsOfSet } from "./data";

export type FavList = { id: string; n: string; k: Record<string, number> };
export type Fav = { f: Record<string, number>; l: FavList[]; a: Record<string, number> };
export type Deck = { id: string; name: string; cards: Record<string, number>; upd?: number; [x: string]: any };

export const S = {
  qty: {} as Record<string, number>,
  fav: { f: {}, l: [], a: {} } as Fav,
  decks: [] as Deck[],
  view: "grid" as "list" | "grid",
};
// se la lettura dei dati salvati fallisce non si salva nulla, così i dati nel telefono non vengono sovrascritti con quelli vuoti
let LOAD_FAILED = false;
const okDeck = (d: any) => !!(d && typeof d === "object" && d.id && d.cards && typeof d.cards === "object" && !Array.isArray(d.cards));
const okNum = (o: any) => {
  const r: Record<string, number> = {};
  if (o && typeof o === "object" && !Array.isArray(o)) Object.keys(o).forEach((k) => {
      const n = typeof o[k] === "number" ? o[k] : typeof o[k] === "string" && o[k].trim() ? Number(o[k]) : NaN;
      if (isFinite(n)) r[k] = n;
    });
  return r;
};
function okFav(fv: any): Fav {
  const f = fv && typeof fv === "object" ? fv : {};
  const l = Array.isArray(f.l) ? f.l.filter((L: any) => L && typeof L === "object" && L.id).map((L: any) => ({ id: String(L.id), n: String(L.n || "Lista"), k: okNum(L.k) })) : [];
  return { f: okNum(f.f), l, a: okNum(f.a) };
}

let ver = 0;
const subs = new Set<(n: number) => void>();
function changed() {
  ver++;
  STATS = null;
  subs.forEach((f) => f(ver));
}
// le schermate che mostrano copie, preferite o mazzi si ridisegnano a ogni cambiamento
export function useStore() {
  const [, set] = useState(ver);
  useEffect(() => {
    subs.add(set);
    return () => {
      subs.delete(set);
    };
  }, []);
  return ver;
}

// solo la vista elenco/griglia (gli elenchi non si ridisegnano a ogni copia aggiunta)
export function useView() {
  const [v, set] = useState(S.view);
  useEffect(() => {
    const f = () => set(S.view);
    subs.add(f);
    f();
    return () => {
      subs.delete(f);
    };
  }, []);
  return v;
}

function parse(s: string | null, d: any) {
  try {
    const v = JSON.parse(s || "null");
    return v && typeof v === "object" ? v : d;
  } catch (e) {
    return d;
  }
}
export async function loadStore() {
  try {
    const r = await AsyncStorage.multiGet(["dgm-qty", "dg-fav", "dgm-decks", "dgm-view"]);
    const m: Record<string, string | null> = {};
    r.forEach(([k, v]) => (m[k] = v));
    S.qty = okNum(parse(m["dgm-qty"], {}));
    S.fav = okFav(parse(m["dg-fav"], {}));
    const dk = parse(m["dgm-decks"], []);
    S.decks = Array.isArray(dk) ? dk.filter(okDeck) : [];
    // come nell'app attuale: griglia finché l'utente non sceglie l'elenco
    S.view = m["dgm-view"] === "list" ? "list" : "grid";
    LOAD_FAILED = false;
  } catch (e) {
    LOAD_FAILED = true;
  }
  changed();
}
const saveQty = () => !LOAD_FAILED && AsyncStorage.setItem("dgm-qty", JSON.stringify(S.qty)).catch(() => {});
const saveFav = () => !LOAD_FAILED && AsyncStorage.setItem("dg-fav", JSON.stringify(S.fav)).catch(() => {});
export const saveDecks = () => {
  if (!LOAD_FAILED) AsyncStorage.setItem("dgm-decks", JSON.stringify(S.decks)).catch(() => {});
  changed();
};
export function setView(v: "list" | "grid") {
  S.view = v;
  AsyncStorage.setItem("dgm-view", v).catch(() => {});
  changed();
}

// ---- copie possedute
export const owned = (c: Card) => S.qty[c.k] || 0;
export function setQty(c: Card, v: number) {
  v = Math.max(0, Math.min(999, Math.round(v)));
  if (v > 0) S.qty[c.k] = v;
  else delete S.qty[c.k];
  saveQty();
  changed();
}

// ---- preferite, liste e avviso di prezzo
export const isFav = (c: Card) => !!S.fav.f[c.k];
export const favCount = () => Object.keys(S.fav.f).length;
export const listById = (id: string) => S.fav.l.find((L) => L.id === id) || null;
export function favSet(c: Card, on: boolean) {
  if (on) {
    if (!S.fav.f[c.k]) S.fav.f[c.k] = Date.now();
  } else {
    delete S.fav.f[c.k];
    S.fav.l.forEach((L) => delete L.k[c.k]);
    delete S.fav.a[c.k];
  }
  saveFav();
  changed();
}
export function listToggle(L: FavList, c: Card, on: boolean) {
  if (on) {
    L.k[c.k] = Date.now();
    if (!S.fav.f[c.k]) S.fav.f[c.k] = Date.now();
  } else delete L.k[c.k];
  saveFav();
  changed();
}
export function listNew(name: string, c?: Card) {
  const L: FavList = { id: "l" + Date.now().toString(36), n: name, k: {} };
  if (c) {
    L.k[c.k] = Date.now();
    if (!S.fav.f[c.k]) S.fav.f[c.k] = Date.now();
  }
  S.fav.l.push(L);
  saveFav();
  changed();
  return L;
}
export function listDelete(id: string) {
  S.fav.l = S.fav.l.filter((x) => x.id !== id);
  saveFav();
  changed();
}
export function setAlert(c: Card, v: number | null) {
  if (v == null) delete S.fav.a[c.k];
  else {
    S.fav.a[c.k] = Math.round(v * 100) / 100;
    if (!S.fav.f[c.k]) S.fav.f[c.k] = Date.now();
  }
  saveFav();
  changed();
}
export const favCards = () =>
  Object.keys(S.fav.f)
    .map((k) => BYKEY[k])
    .filter(Boolean);

// ---- avanzamento per prodotto (carte e illustrazioni possedute su quelle del prodotto)
let STATS: Record<string, { n: number; h: number }> | null = null;
export function setStats() {
  if (!STATS) {
    STATS = {};
    SETS.forEach((s) => {
      const t = { n: 0, h: 0 };
      cardsOfSet(s.id).forEach((e) => {
        t.n++;
        if (owned(e)) t.h++;
      });
      STATS![s.id] = t;
    });
  }
  return STATS;
}

// ---- backup: stesso contenuto delle chiavi dell'app attuale
export function exportText() {
  return JSON.stringify({ app: "digital-gate", v: 1, data: new Date().toISOString().slice(0, 10), qty: S.qty, fav: S.fav, decks: S.decks });
}
// unisce alla collezione già presente (per ogni versione tiene il numero di copie più alto) oppure sostituisce tutto.
// Il testo viene controllato tutto prima di toccare i dati: un backup rovinato non cancella niente.
export function importText(txt: string, replace: boolean): { ok: boolean; msg: string } {
  const BAD = { ok: false, msg: "Il testo incollato non è un backup di Digital Gate." };
  let o: any;
  try {
    o = JSON.parse(txt.trim());
  } catch (e) {
    return BAD;
  }
  if (!o || typeof o !== "object" || (!o.qty && !o.fav && !o.decks)) return BAD;
  try {
    const q: Record<string, number> = {};
    if (o.qty && typeof o.qty === "object")
      Object.keys(o.qty).forEach((k) => {
        const n = parseInt(o.qty[k], 10);
        if (n > 0) q[k] = Math.min(999, n);
      });
    const fv = okFav(o.fav);
    const dk: Deck[] = (Array.isArray(o.decks) ? o.decks : []).filter(okDeck);
    // risultato costruito su una copia e assegnato solo alla fine
    const qty: Record<string, number> = replace ? {} : { ...S.qty };
    const fav: Fav = replace ? { f: {}, l: [], a: {} } : { f: { ...S.fav.f }, l: S.fav.l.map((L) => ({ ...L, k: { ...L.k } })), a: { ...S.fav.a } };
    const decks: Deck[] = replace ? [] : S.decks.slice();
    Object.keys(q).forEach((k) => (qty[k] = replace ? q[k] : Math.max(qty[k] || 0, q[k])));
    Object.keys(fv.f).forEach((k) => (fav.f[k] = fav.f[k] || fv.f[k]));
    Object.keys(fv.a).forEach((k) => (fav.a[k] = fv.a[k]));
    fv.l.forEach((L) => {
      const ex = fav.l.find((x) => x.id === L.id);
      if (ex) Object.assign(ex.k, L.k);
      else fav.l.push(L);
    });
    let nd = 0;
    dk.forEach((d) => {
      if (!decks.some((x) => x.id === d.id)) {
        decks.push(d);
        nd++;
      }
    });
    S.qty = qty;
    S.fav = fav;
    S.decks = decks;
    LOAD_FAILED = false;
    saveQty();
    saveFav();
    saveDecks();
    const nq = Object.keys(q).length,
      nf = Object.keys(fv.f).length;
    return { ok: true, msg: "Importate " + nq + (nq === 1 ? " voce" : " voci") + " della collezione, " + nf + (nf === 1 ? " preferita" : " preferite") + " e " + nd + (nd === 1 ? " mazzo." : " mazzi.") };
  } catch (e) {
    return BAD;
  }
}
