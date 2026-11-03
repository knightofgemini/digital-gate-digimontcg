// Dal testo letto alla carta, come nell'app attuale: prima il numero stampato (BT1-084, con le correzioni delle lettere che
// l'OCR confonde), altrimenti il nome (distanza di modifica) e, tra le carte con lo stesso nome, le parole dell'effetto.
// Poi le versioni (Regular, ★, ★★, SP, ristampe) ordinate per somiglianza con l'illustrazione inquadrata.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BYCODE, CARDS, Card, NET, SETBY, fold } from "../data";
import { vurl } from "../imgstore";
import { ask } from "./bridge";

const scD = (s: string) => s.replace(/[OQD]/g, "0").replace(/[IL|]/g, "1").replace(/S/g, "5").replace(/B/g, "8").replace(/Z/g, "2").replace(/G/g, "6");
const scL = (s: string) => s.replace(/8/g, "B").replace(/0/g, "O").replace(/5/g, "S").replace(/1/g, "I").replace(/2/g, "Z").replace(/7/g, "T").replace(/4/g, "A");
const known = (code: string) => (BYCODE[code] || []).some((c) => !c.suf);

export function scanCodes(txt: string) {
  const T = String(txt || "")
    .toUpperCase()
    .replace(/[–—~_=]/g, "-");
  const re = /([A-Z0-9]{1,6})\s?-\s?([0-9OQDILSBZG|]{2,4})/g;
  const out: string[] = [],
    seen: Record<string, 1> = {};
  let m: RegExpExecArray | null;
  while ((m = re.exec(T))) {
    // il numero può avere un carattere in più letto dal simbolo vicino (es. 0860): si prova anche accorciato
    const pre = m[1],
      n0 = scD(m[2]);
    const nums = [n0, n0.slice(0, 3), n0.slice(0, 2)].filter((x, i, a) => x.length >= 2 && a.indexOf(x) === i);
    for (let a = 0; a < pre.length; a++)
      for (let k = 1; k <= 3 && a + k <= pre.length; k++)
        for (let j = 0; j < nums.length; j++) {
          const cand = scL(pre.slice(a, a + k)) + scD(pre.slice(a + k)) + "-" + nums[j];
          if (known(cand)) {
            if (!seen[cand]) {
              seen[cand] = 1;
              out.push(cand);
            }
            break;
          }
        }
  }
  return out;
}

let NAMES: [string, Card[]][] | null = null;
function names() {
  if (!NAMES) {
    const m: Record<string, Card[]> = {};
    CARDS.forEach((c) => {
      const f = fold(c.name);
      if (f.length >= 3) (m[f] = m[f] || []).push(c);
    });
    NAMES = Object.keys(m).map((f) => [f, m[f]]);
  }
  return NAMES;
}
function lev(a: string, b: string) {
  const p: number[] = [];
  for (let j = 0; j <= b.length; j++) p[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let d = p[0];
    p[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const c = p[j];
      p[j] = Math.min(p[j] + 1, p[j - 1] + 1, d + (a[i - 1] === b[j - 1] ? 0 : 1));
      d = c;
    }
  }
  return p[b.length];
}
export function scanByName(txt: string) {
  const lines = String(txt || "")
    .split(/\n+/)
    .map(fold)
    .filter((l) => l.length >= 4 && l.length <= 44);
  let best: { s: number; f: string; cards: Card[] } | null = null;
  lines.forEach((l) =>
    names().forEach(([f, cards]) => {
      if (Math.abs(f.length - l.length) > Math.max(2, l.length * 0.25)) return;
      const s = 1 - lev(l, f) / Math.max(l.length, f.length);
      if (s >= 0.8 && (!best || s > best.s || (s === best.s && f.length > best.f.length))) best = { s, f, cards };
    })
  );
  if (!best) return [];
  const words: Record<string, 1> = {};
  fold(txt)
    .split(" ")
    .forEach((w) => w.length >= 4 && (words[w] = 1));
  const codes: Record<string, Card> = {};
  (best as { cards: Card[] }).cards.forEach((c) => (codes[c.code] = c));
  return Object.keys(codes)
    .map((k) => {
      const c = codes[k];
      const u: Record<string, 1> = {};
      let hit = 0;
      fold([c.eff, c.inh, c.sec].join(" "))
        .split(" ")
        .filter((w) => w.length >= 4)
        .forEach((w) => {
          if (!u[w]) {
            u[w] = 1;
            if (words[w]) hit++;
          }
        });
      return { code: k, sc: hit / Math.max(4, Object.keys(u).length) };
    })
    .sort((a, b) => b.sc - a.sc)
    .slice(0, 4)
    .map((x) => x.code);
}

// versioni della carta (come scVers dell'app attuale): la carta, le alternative dal prodotto più recente
// al più vecchio, poi le ristampe con lo stesso numero in altri prodotti
export function scVers(code: string) {
  const all = BYCODE[code] || [];
  const bases = all.filter((c) => !c.suf);
  if (!bases.length) return [];
  const dt = (e: Card) => (e.from && SETBY[e.from] && SETBY[e.from].date) || "";
  const alts: Card[] = [];
  const img: Record<string, 1> = {};
  all.forEach((a) => a.suf && !img[a.img || a.k] && (img[a.img || a.k] = 1) && alts.push(a));
  alts.sort((x, y) => (dt(y) < dt(x) ? -1 : dt(y) > dt(x) ? 1 : (x.img || "") < (y.img || "") ? -1 : 1));
  const seen: Record<string, 1> = {};
  const out: Card[] = [];
  [bases[0], ...alts, ...bases.slice(1)].forEach((a) => !seen[a.k] && (seen[a.k] = 1) && out.push(a));
  return out;
}

export type ScanResult = { codes: string[]; sure: boolean; sig: number[] | null };
// legge una foto (dataURL); crop = cornice nella vista della fotocamera, y0 = da dove parte la zona del testo
export async function readPhoto(img: string, crop: any, y0: number): Promise<ScanResult | null> {
  const r = await ask({ op: "ocr", img, crop, y0 });
  const codes = scanCodes(r.text);
  if (codes.length) return { codes, sure: true, sig: r.sig };
  const byName = scanByName(r.text);
  if (byName.length) return { codes: byName, sure: false, sig: r.sig };
  return null;
}
export async function rankVers(vers: Card[], sig: number[] | null): Promise<{ a: Card; d: number | null }[]> {
  if (!sig || vers.length < 2) return vers.map((a) => ({ a, d: null }));
  const r = await ask({ op: "rank", sig, urls: vers.map((a) => vurl(NET.t(a))) }); // dalla rete: la pagina del riconoscimento non legge i file dell'app
  return vers
    .map((a, i) => ({ a, d: r.d[i] as number | null, i }))
    .sort((x, y) => {
      if (x.d == null && y.d == null) return x.i - y.i;
      if (x.d == null) return 1;
      if (y.d == null) return -1;
      return Math.abs(x.d - y.d) < 0.02 ? x.i - y.i : x.d - y.d;
    })
    .map(({ a, d }) => ({ a, d }));
}
export const warm = () => ask({ op: "warm" });

// ---- cronologia delle scansioni (nel dispositivo, "dg-scans" come nell'app attuale)
export type ScanItem = { t: number; code: string; k: string; sure: number; add?: number };
export let SCH: ScanItem[] = [];
let loaded = false;
export async function loadHistory() {
  if (loaded) return;
  loaded = true;
  try {
    const v = JSON.parse((await AsyncStorage.getItem("dg-scans")) || "[]");
    SCH = (Array.isArray(v) ? v : []).filter((it: ScanItem) => it && known(it.code));
  } catch (e) {
    SCH = [];
  }
}
export function saveHistory() {
  if (SCH.length > 300) SCH.length = 300;
  AsyncStorage.setItem("dg-scans", JSON.stringify(SCH)).catch(() => {});
}
export function setHistory(v: ScanItem[]) {
  SCH = v;
  saveHistory();
}
export function schEntry(it: ScanItem) {
  const vs = scVers(it.code);
  return vs.find((a) => a.k === it.k) || vs[0];
}
