// Tagli della Home scelti dall'utente nell'editor dell'app (10 novembre 2026, schermata "Tagli della Home" in
// app/tagli.tsx). Stanno nel ramo `home-art` del suo GitHub: `tagli.json` (immagini originali per codice prodotto e
// rettangoli per sezione) e `img/` (originali). L'app di tutti scarica tagli.json all'avvio e tornando nell'app (come i
// prezzi), lo salva nel telefono e mostra l'originale ritagliato al momento, nella forma vera del riquadro.
// Hanno la precedenza sulle immagini dentro l'APK (covers.ts), che restano come riserva.
import { useEffect, useState } from "react";
import { AppState, Platform, View } from "react-native";
import { Image } from "expo-image";
import { documentDirectory, readAsStringAsync, writeAsStringAsync } from "expo-file-system/legacy";
import { CutRect, cutLayout, fitRect } from "./homeLogic";
import { heroPhone } from "./covers";

export const REPO = "knightofgemini/digital-gate-digimontcg";
export const BRANCH = "home-art";
export const RAW = "https://raw.githubusercontent.com/" + REPO + "/" + BRANCH + "/";

export type ArtImg = { code: string; name?: string; asset: string; w: number; h: number; at?: string };
export type ArtCut = CutRect & { asset: string; w: number; h: number; phone?: string; [k: string]: any };
export type ArtState = { t: string; immagini: Record<string, ArtImg>; tagli: Record<string, ArtCut> };

let ART: ArtState = { t: "", immagini: {}, tagli: {} };
let version = 0;
const subs = new Set<(n: number) => void>();
function bump() {
  version++;
  subs.forEach((f) => f(version));
}
const FILE = Platform.OS !== "web" && documentDirectory ? documentDirectory + "home-art.json" : "";
const valid = (o: any): o is ArtState => !!o && typeof o === "object" && !!o.tagli && !!o.immagini;

export const artState = () => ART;
// dati più recenti di quelli in uso (t = momento dell'ultimo salvataggio nell'editor)
function take(o: any, save: boolean) {
  if (!valid(o) || (o.t || "") <= ART.t) return false;
  ART = o;
  bump();
  if (save && FILE) writeAsStringAsync(FILE, JSON.stringify(o)).catch(() => {});
  return true;
}
// dall'editor, subito dopo un salvataggio riuscito su GitHub
export function setArt(o: ArtState) {
  take(o, true);
}

let lastTry = 0,
  started = false;
export function refreshArt(force?: boolean) {
  if (!force && Date.now() - lastTry < 10 * 60 * 1000) return;
  lastTry = Date.now();
  fetch(RAW + "tagli.json?t=" + Math.floor(Date.now() / 60000), { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((o) => take(o, true))
    .catch(() => {});
}
// da _layout.tsx: prima i tagli salvati nel telefono, poi quelli del giorno da GitHub
export function startArt() {
  if (started) return;
  started = true;
  const go = () => refreshArt(true);
  if (FILE)
    readAsStringAsync(FILE)
      .then((s) => take(JSON.parse(s), false))
      .catch(() => {})
      .finally(go);
  else go();
  AppState.addEventListener("change", (st) => st === "active" && refreshArt());
}
// i riquadri della Home si ridisegnano quando arrivano tagli nuovi
export function useHomeArt() {
  const [v, setV] = useState(version);
  useEffect(() => {
    subs.add(setV);
    return () => {
      subs.delete(setV);
    };
  }, []);
  return v;
}

export type Logo = { p: string; s: number };
export type Art = { uri: string; r: CutRect; w: number; h: number; logo?: Logo };
// taglio per un prodotto e una sezione; In evidenza: prima quello proprio della larghezza del telefono, poi il comune
export function artFor(code: string, sec: "hero" | "cover" | "square" | "prod", width?: number): Art | null {
  // il banner dei prodotti può avere un'immagine sua (immagini/CODICE@ban, caricata nella pagina "Banner prodotti")
  const img = (sec === "prod" && ART.immagini[code + "@ban"]) || ART.immagini[code];
  if (!img || !img.asset) return null;
  const ok = (c?: ArtCut) => (c && c.asset === img.asset ? c : null);
  const c = (sec === "hero" && width ? ok(ART.tagli[code + "__hero@" + heroPhone(width)]) : null) || ok(ART.tagli[code + "__" + sec]);
  if (!c) return null;
  return { uri: RAW + "img/" + encodeURIComponent(img.asset), r: c, w: img.w, h: img.h, logo: c.logo && c.logo.p ? { p: String(c.logo.p), s: +c.logo.s || 0.45 } : undefined };
}

// originale ritagliato: riempie il riquadro che lo contiene (posizione assoluta), con il taglio adattato alla sua forma
export function CutImg({ a }: { a: Art }) {
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const st = box && box.w > 0 && box.h > 0 ? cutLayout(fitRect(a.r, box.w / box.h, a.w, a.h), a.w, a.h, box.w) : null;
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, overflow: "hidden" }} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {st ? <Image source={{ uri: a.uri }} style={{ position: "absolute", ...st }} contentFit="fill" cachePolicy="disk" transition={120} /> : null}
    </View>
  );
}

// logo dell'espansione sopra il banner dei prodotti (pagina "Banner prodotti" dell'editor): margine del 5% della
// larghezza, uno dei 9 punti (t/m/b + l/c/r), larghezza = s × larghezza del riquadro; come logoLay della pagina
export function LogoLay({ uri, p, s }: { uri: string; p: string; s: number }) {
  const [w, setW] = useState(0);
  const [ar, setAr] = useState(0);
  const lw = w * s;
  return (
    <View
      pointerEvents="none"
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        padding: w * 0.05,
        justifyContent: p[0] === "t" ? "flex-start" : p[0] === "m" ? "center" : "flex-end",
        alignItems: p[1] === "l" ? "flex-start" : p[1] === "c" ? "center" : "flex-end",
      }}
    >
      {w > 0 ? (
        <Image source={{ uri }} style={{ width: lw, height: ar ? lw / ar : lw * 0.4, opacity: ar ? 1 : 0 }} contentFit="contain" cachePolicy="disk" onLoad={(e) => e.source && e.source.height && setAr(e.source.width / e.source.height)} />
      ) : null}
    </View>
  );
}
