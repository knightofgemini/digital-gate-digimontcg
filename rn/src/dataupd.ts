// Carte aggiornate senza installare un APK nuovo (31 ottobre 2026): il sito pubblica i dati anche come file a parte
// (www/dati/ di tools/build.py: data.json, products.json e ver.json con impronta "h" e momento della pubblicazione "t").
// All'avvio (dopo qualche secondo) e tornando nell'app dopo 3 ore si legge ver.json; se i dati sono più recenti di quelli
// in uso si scaricano e si salvano nel dispositivo, poi un avviso propone "Aggiorna" (riavvio veloce dell'app).
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
const NAMES = { d: "dg-data.json", p: "dg-products.json", v: "dg-ver.json" };
const BUNDLED: Ver = bundledVer as any;

// dati in uso in questa sessione (quelli dell'APK o gli ultimi scaricati)
export let CURVER: Ver = BUNDLED;
let PENDING: Ver | null = null; // scaricati ma non ancora in uso (si usano riaprendo l'app o con "Aggiorna")

// chiamata da data.ts prima di costruire carte e prodotti: legge in modo sincrono i dati salvati, se più recenti
export function pickData<D, P>(raw: D, products: P): { raw: D; products: P } {
  if (!NATIVE) return { raw, products };
  try {
    const vf = new File(Paths.document, NAMES.v);
    if (!vf.exists) return { raw, products };
    const v: Ver = JSON.parse(vf.textSync());
    if (!v || !(v.t > (BUNDLED.t || 0))) return { raw, products };
    const d = JSON.parse(new File(Paths.document, NAMES.d).textSync());
    const p = JSON.parse(new File(Paths.document, NAMES.p).textSync());
    if (!d || !d.cards || !d.sets || !p) return { raw, products };
    CURVER = v;
    return { raw: d, products: p };
  } catch (e) {
    return { raw, products };
  }
}

let busy = false;
async function check(onNew: () => void) {
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
    // prima i dati, ver.json per ultimo: se lo scaricamento si interrompe a metà restano in uso quelli di prima
    await writeAsStringAsync(documentDirectory + NAMES.d, d);
    await writeAsStringAsync(documentDirectory + NAMES.p, p);
    await writeAsStringAsync(documentDirectory + NAMES.v, JSON.stringify(v));
    PENDING = v;
    onNew();
  } catch (e) {
  } finally {
    busy = false;
  }
}

export const applyNewData = () => reloadAppAsync("Carte aggiornate").catch(() => {});

let started = false;
export function startDataUpdates(onNew: () => void) {
  if (!NATIVE || started) return;
  started = true;
  setTimeout(() => check(onNew), 4000);
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
