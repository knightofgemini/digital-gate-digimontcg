// Prezzi Cardmarket e CardTrader (src/prices.json da tools/cardmarket_prices.py), come nel sito:
// Cardmarket per versione [trend, più basso, media 1 g, 7 g, 30 g, idProduct]; CardTrader [più basso EN Near Mint, n. offerte, blueprint, paese, Zero].
// All'avvio si scaricano quelli del giorno dal ramo "prezzi", così non serve una nuova versione dell'app.
import { useEffect, useState } from "react";
import { AppState, Platform } from "react-native";
import { documentDirectory, readAsStringAsync, writeAsStringAsync } from "expo-file-system/legacy";
import raw from "../data/prices.json";
import { Card, MONTHS } from "./data";

type Prices = { d?: string; sets: string[]; p: Record<string, any[]>; ct?: { d?: string; sets: string[]; p: Record<string, any[]> } };
const URL = "https://raw.githubusercontent.com/knightofgemini/digital-gate-digimontcg/prezzi/prices.json";

let PRICES: Prices = raw as any;
let PCOV: Record<string, 1> = {};
let CTCOV: Record<string, 1> = {};
function setPrices(o: Prices) {
  PRICES = o && o.p ? o : { p: {}, sets: [] };
  PCOV = {};
  (PRICES.sets || []).forEach((id) => (PCOV[id] = 1));
  CTCOV = {};
  ((PRICES.ct && PRICES.ct.sets) || []).forEach((id) => (CTCOV[id] = 1));
}
setPrices(PRICES);
const stamp = (o: Prices) => (o && o.p ? (o.d || "") + "|" + ((o.ct && o.ct.d) || "") : "");

let version = 0;
const subs = new Set<(n: number) => void>();
let started = false;
function bump() {
  version++;
  subs.forEach((f) => f(version));
}
// i componenti che mostrano prezzi si ridisegnano quando arrivano quelli nuovi; restituisce un numero che cambia con i prezzi
export function usePrices() {
  const [v, setV] = useState(version);
  useEffect(() => {
    subs.add(setV);
    refreshPrices();
    return () => {
      subs.delete(setV);
    };
  }, []);
  return v;
}

// Ultimi prezzi scaricati salvati in un file (come "dg-prices" dell'app attuale): senza internet si usano quelli,
// se sono più recenti di quelli inclusi nell'app. Lo scaricamento parte all'avvio e, se non riesce, si riprova
// tornando nell'app (al massimo una volta ogni 10 minuti).
const FILE = Platform.OS !== "web" && documentDirectory ? documentDirectory + "prices.json" : "";
export async function loadSavedPrices() {
  if (!FILE) return;
  try {
    const o = JSON.parse(await readAsStringAsync(FILE));
    if (o && o.p && stamp(o) > stamp(PRICES)) {
      setPrices(o);
      bump();
    }
  } catch (e) {}
}
let lastTry = 0,
  gotToday = "";
export function refreshPrices() {
  const day = new Date().toISOString().slice(0, 10);
  if (gotToday === day || Date.now() - lastTry < 10 * 60 * 1000) return;
  lastTry = Date.now();
  if (!started) {
    started = true;
    AppState.addEventListener("change", (st) => st === "active" && refreshPrices());
  }
  fetch(URL + "?d=" + day, { cache: "no-store" })
    .then((r) => (r.ok ? r.text() : null))
    .then((txt) => {
      if (!txt) return;
      const o = JSON.parse(txt);
      if (!o || !o.p) return;
      gotToday = day;
      if (stamp(o) <= stamp(PRICES)) return;
      setPrices(o);
      bump();
      if (FILE) writeAsStringAsync(FILE, txt).catch(() => {});
    })
    .catch(() => {});
}

const hostSet = (c: Card) => (c.suf ? c.from || c.set : c.set);
export const cmCovered = (c: Card) => !!PCOV[hostSet(c)];
export const ctCovered = (c: Card) => !!CTCOV[hostSet(c)];
export const cmOf = (c: Card) => (PRICES.p || {})[c.k] || null;
export const ctOf = (c: Card) => ((PRICES.ct && PRICES.ct.p) || {})[c.k] || null;
export function cmVal(c: Card): number | null {
  if (!cmCovered(c)) return null;
  const p = cmOf(c);
  return p ? (p[1] != null ? p[1] : p[0] != null ? p[0] : null) : null;
}
export function ctVal(c: Card): number | null {
  if (!ctCovered(c)) return null;
  const p = ctOf(c);
  return p && p[0] != null ? p[0] : null;
}
export function bestVal(c: Card) {
  const a = cmVal(c),
    b = ctVal(c);
  return a == null ? b : b == null ? a : Math.min(a, b);
}
export const cmUrl = (c: Card) => {
  const p = cmCovered(c) && cmOf(c);
  return p && p[5] ? "https://www.cardmarket.com/it/Digimon/Products?idProduct=" + p[5] : null;
};
export const ctUrl = (c: Card) => {
  const p = ctCovered(c) && ctOf(c);
  return p && p[2] ? "https://www.cardtrader.com/it/cards/" + p[2] : null;
};
export function eurN(v: number) {
  return v.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export const eur = (v: number | null | undefined) => (v == null ? "—" : eurN(v) + " €");
export const eurT = (v: number) => (v >= 1000 ? Math.round(v).toLocaleString("it-IT") + " €" : eurN(v) + " €");
export function fmtDate(s?: string) {
  if (!s) return "—";
  const p = s.split("-");
  return +p[2] + " " + MONTHS[+p[1] - 1] + " " + p[0];
}
export const cmDate = () => fmtDate(PRICES.d);
export const ctDate = () => fmtDate(PRICES.ct && PRICES.ct.d);
