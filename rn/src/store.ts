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
  view: "list" as "list" | "grid",
};

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
    S.qty = parse(m["dgm-qty"], {});
    const fv = parse(m["dg-fav"], {});
    S.fav = { f: fv.f || {}, l: fv.l || [], a: fv.a || {} };
    S.decks = Array.isArray(parse(m["dgm-decks"], [])) ? parse(m["dgm-decks"], []) : [];
    S.view = m["dgm-view"] === "grid" ? "grid" : "list";
  } catch (e) {}
  changed();
}
const saveQty = () => AsyncStorage.setItem("dgm-qty", JSON.stringify(S.qty)).catch(() => {});
const saveFav = () => AsyncStorage.setItem("dg-fav", JSON.stringify(S.fav)).catch(() => {});
export const saveDecks = () => {
  AsyncStorage.setItem("dgm-decks", JSON.stringify(S.decks)).catch(() => {});
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
// unisce alla collezione già presente (per ogni versione tiene il numero di copie più alto) oppure sostituisce tutto
export function importText(txt: string, replace: boolean): { ok: boolean; msg: string } {
  let o: any;
  try {
    o = JSON.parse(txt.trim());
  } catch (e) {
    return { ok: false, msg: "Il testo incollato non è un backup di Digital Gate." };
  }
  if (!o || typeof o !== "object" || (!o.qty && !o.fav && !o.decks)) return { ok: false, msg: "Il testo incollato non è un backup di Digital Gate." };
  const q = o.qty && typeof o.qty === "object" ? o.qty : {};
  const fv = o.fav && typeof o.fav === "object" ? o.fav : {};
  const dk = Array.isArray(o.decks) ? o.decks : [];
  if (replace) {
    S.qty = {};
    S.fav = { f: {}, l: [], a: {} };
    S.decks = [];
  }
  let nq = 0;
  Object.keys(q).forEach((k) => {
    const n = parseInt(q[k], 10);
    if (n > 0) {
      S.qty[k] = replace ? n : Math.max(S.qty[k] || 0, n);
      nq++;
    }
  });
  Object.keys(fv.f || {}).forEach((k) => (S.fav.f[k] = S.fav.f[k] || fv.f[k]));
  Object.keys(fv.a || {}).forEach((k) => (S.fav.a[k] = fv.a[k]));
  (fv.l || []).forEach((L: FavList) => {
    const ex = S.fav.l.find((x) => x.id === L.id);
    if (ex) Object.assign(ex.k, L.k);
    else S.fav.l.push({ id: L.id, n: L.n, k: { ...L.k } });
  });
  dk.forEach((d: Deck) => {
    if (d && d.id && !S.decks.some((x) => x.id === d.id)) S.decks.push(d);
  });
  saveQty();
  saveFav();
  saveDecks();
  return { ok: true, msg: "Importate " + nq + (nq === 1 ? " voce" : " voci") + " della collezione, " + Object.keys(fv.f || {}).length + " preferite e " + dk.length + (dk.length === 1 ? " mazzo." : " mazzi.") };
}
