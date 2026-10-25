// Immagini offline (come nell'app attuale): si scaricano in anticipo nella stessa memoria usata quando si sfoglia
// (cache su disco delle immagini). Scelte: solo miniature, tutto in HD o un prodotto alla volta; 6 alla volta, pausa e ripresa.
// Avanzamento salvato in "dg-offline" per riprendere dove ci si era fermati.
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { CARDS, Card, PRODUCTS, SETBY, SETS, cardsOfSet, fullUrl, hasErrata, logoUrl, packUrl, preUrl, thumbUrl } from "./data";

export const AVG = { f: 72200, t: 6350, pre: 79400, pk: 28000, lg: 21900 }; // pesi medi misurati sul sito (byte)
type Item = { u: string; w: number };

const LISTS: Record<string, Item[]> = {};
export function items(scope: string): Item[] {
  if (LISTS[scope]) return LISTS[scope];
  const seen: Record<string, 1> = {},
    list: Item[] = [];
  const add = (u: string | null, w: number) => {
    if (u && !seen[u]) {
      seen[u] = 1;
      list.push({ u, w });
    }
  };
  const addCard = (c: Card) => {
    add(thumbUrl(c), AVG.t);
    if (scope !== "t") add(fullUrl(c), AVG.f);
    if (scope !== "t" && hasErrata(c)) add(preUrl(c), AVG.pre);
  };
  const addProd = (code: string) => {
    add(packUrl(code), AVG.pk);
    add(logoUrl(code), AVG.lg);
  };
  if (scope === "t" || scope === "hd") {
    CARDS.forEach(addCard);
    SETS.forEach((x) => cardsOfSet(x.id).forEach(addCard));
    if (scope === "hd") Object.keys(PRODUCTS).forEach(addProd);
  } else if (SETBY[scope]) {
    cardsOfSet(scope).forEach(addCard);
    addProd(SETBY[scope].code);
  }
  return (LISTS[scope] = list);
}
export const weight = (scope: string) => items(scope).reduce((a, x) => a + x.w, 0);
export function mb(b: number) {
  const m = b / 1048576;
  return m >= 100 ? Math.round(m / 10) * 10 + " MB" : m >= 10 ? Math.round(m) + " MB" : (Math.round(m * 10) / 10).toLocaleString("it-IT") + " MB";
}
export const label = (scope: string) => (scope === "t" ? "Miniature" : scope === "hd" ? "Tutto in HD" : SETBY[scope] ? SETBY[scope].code + " · " + SETBY[scope].name : "Prodotto");

// stato salvato: per ogni scelta quante immagini sono già state scaricate (in ordine) e quelle non trovate sul sito
type Saved = { pos: Record<string, number>; miss: Record<string, number>; done: Record<string, number> };
export const OFF: Saved = { pos: {}, miss: {}, done: {} };
let loaded = false;
async function load() {
  if (loaded) return;
  loaded = true;
  try {
    const v = JSON.parse((await AsyncStorage.getItem("dg-offline-rn")) || "null");
    if (v) Object.assign(OFF, { pos: v.pos || {}, miss: v.miss || {}, done: v.done || {} });
  } catch (e) {}
  emit();
}
const save = () => AsyncStorage.setItem("dg-offline-rn", JSON.stringify(OFF)).catch(() => {});

// scaricamento in corso (uno alla volta)
export const RUN = { scope: "", running: false, done: 0, total: 0, bytes: 0, t0: 0 };
const subs = new Set<() => void>();
function emit() {
  subs.forEach((f) => f());
}
export function useOffline() {
  const [, set] = useState(0);
  useEffect(() => {
    const f = () => set((x) => x + 1);
    subs.add(f);
    load();
    return () => {
      subs.delete(f);
    };
  }, []);
}

export async function start(scope: string) {
  if (RUN.running) return;
  const list = items(scope);
  RUN.scope = scope;
  RUN.running = true;
  RUN.total = list.length;
  RUN.done = OFF.pos[scope] || 0;
  RUN.bytes = 0;
  RUN.t0 = Date.now();
  emit();
  let i = RUN.done,
    miss = OFF.miss[scope] || 0,
    lastSave = Date.now();
  while (RUN.running && i < list.length) {
    const chunk = list.slice(i, i + 6);
    const ok = await Promise.all(chunk.map((x) => Image.prefetch(x.u, "disk").catch(() => false)));
    ok.forEach((v, j) => {
      if (v) RUN.bytes += chunk[j].w;
      else miss++;
    });
    i += chunk.length;
    RUN.done = i;
    OFF.pos[scope] = i;
    OFF.miss[scope] = miss;
    if (Date.now() - lastSave > 3000) {
      lastSave = Date.now();
      save();
    }
    emit();
  }
  if (i >= list.length) {
    OFF.done[scope] = Date.now();
    delete OFF.pos[scope];
  }
  RUN.running = false;
  save();
  emit();
}
export function pause() {
  RUN.running = false;
  emit();
}
export async function clearAll() {
  pause();
  await Image.clearDiskCache();
  OFF.pos = {};
  OFF.miss = {};
  OFF.done = {};
  save();
  emit();
}
export const progressOf = (scope: string) => (OFF.done[scope] ? items(scope).length : RUN.scope === scope && RUN.running ? RUN.done : OFF.pos[scope] || 0);
