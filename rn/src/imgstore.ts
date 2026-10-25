// Immagini salvate nel dispositivo (come la memoria delle immagini dell'app attuale): una cartella dell'app con un file per
// immagine, divisa in "t" (miniature) e "o" (carte grandi, pre errata, banner, confezioni, loghi), così "Immagini offline"
// può contarle ed eliminarle per tipo o per prodotto. Le immagini salvate si mostrano dal file (anche senza internet),
// le altre dalla rete con la cache di expo-image.
// Versioni (img/v.json del sito, "dg-imgv"): le immagini aggiornate hanno "?v=N" nell'indirizzo, così si riscaricano
// e le copie vecchie vengono cancellate.
// Sul web non c'è la cartella: si scarica nella cache del browser e si tiene solo l'elenco ("dg-img-web").
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { deleteAsync, documentDirectory, downloadAsync, makeDirectoryAsync, moveAsync, readDirectoryAsync } from "expo-file-system/legacy";

const SITE_RE = /^https:\/\/knightofgemini\.github\.io\/digital-gate-digimontcg\//;
const WEB = Platform.OS === "web";
const DIR = !WEB && documentDirectory ? documentDirectory + "img/" : "";
export const HAVE = new Set<string>(); // file salvati ("t/…", "o/…")
let VMAP: Record<string, number> = {};

// percorso nel sito senza parametri, es. "img/f/BT24-001.webp"
const relOf = (u: string) => decodeURIComponent(u.replace(SITE_RE, "").split("?")[0]);
const clean = (s: string) => s.replace(/[^A-Za-z0-9._=-]/g, "_");
// indirizzo con la versione dell'immagine, se è stata aggiornata
export function vurl(u: string) {
  if (!SITE_RE.test(u) || /[?&]v=\d/.test(u)) return u;
  const n = VMAP[relOf(u)];
  return n ? u + (u.indexOf("?") < 0 ? "?" : "&") + "v=" + n : u;
}
// nome del file salvato per un indirizzo (con la versione)
export function fileOf(u: string) {
  const rel = relOf(u),
    q = u.split("?")[1];
  const t = rel.indexOf("img/t/") === 0;
  return (t ? "t/" + clean(rel.slice(6)) : "o/" + clean(rel)) + (q ? "@" + clean(q) : "");
}
// indirizzo da mostrare: il file se c'è, altrimenti la rete
export function shown(u: string) {
  u = vurl(u);
  if (!DIR || !HAVE.size) return u;
  const f = fileOf(u);
  return HAVE.has(f) ? DIR + f : u;
}

let ready: Promise<void> | null = null;
export function loadImages() {
  if (ready) return ready;
  ready = (async () => {
    try {
      VMAP = JSON.parse((await AsyncStorage.getItem("dg-imgv")) || "{}") || {};
    } catch (e) {}
    try {
      if (WEB) {
        const a = JSON.parse((await AsyncStorage.getItem("dg-img-web")) || "[]");
        (Array.isArray(a) ? a : []).forEach((f: string) => HAVE.add(f));
        return;
      }
      if (!DIR) return;
      for (const sub of ["t", "o"]) {
        await makeDirectoryAsync(DIR + sub, { intermediates: true }).catch(() => {});
        const names = await readDirectoryAsync(DIR + sub).catch(() => [] as string[]);
        names.forEach((n) => {
          if (/\.part$/.test(n)) deleteAsync(DIR + sub + "/" + n, { idempotent: true }).catch(() => {});
          else HAVE.add(sub + "/" + n);
        });
      }
      dropStale();
    } catch (e) {}
  })();
  return ready;
}

let webSaveT: any = 0;
function webSave() {
  clearTimeout(webSaveT);
  webSaveT = setTimeout(() => AsyncStorage.setItem("dg-img-web", JSON.stringify([...HAVE])).catch(() => {}), 1500);
}

// scarica un'immagine nella cartella: "ok", "miss" (il sito non ce l'ha) o "net" (errore di rete, da riprovare)
export async function saveImg(u: string): Promise<"ok" | "miss" | "net"> {
  const f = fileOf(u);
  if (HAVE.has(f)) return "ok";
  if (WEB) {
    try {
      const r = await fetch(u);
      if (!r.ok) return r.status >= 400 && r.status < 500 ? "miss" : "net";
      await r.blob();
      HAVE.add(f);
      webSave();
      return "ok";
    } catch (e) {
      return "net";
    }
  }
  if (!DIR) return "net";
  const tmp = DIR + f + ".part";
  try {
    const r = await downloadAsync(u, tmp);
    if (r.status >= 200 && r.status < 300) {
      await moveAsync({ from: tmp, to: DIR + f });
      HAVE.add(f);
      return "ok";
    }
    await deleteAsync(tmp, { idempotent: true }).catch(() => {});
    return r.status >= 400 && r.status < 500 ? "miss" : "net";
  } catch (e) {
    await deleteAsync(tmp, { idempotent: true }).catch(() => {});
    return "net";
  }
}

// elimina alcune immagini (indirizzi) o un tipo intero ("t" = miniature, "o" = tutto il resto)
export async function dropImgs(urls: string[]) {
  const fs = urls.map(fileOf).filter((f) => HAVE.has(f));
  fs.forEach((f) => HAVE.delete(f));
  if (WEB) return webSave();
  await Promise.all(fs.map((f) => deleteAsync(DIR + f, { idempotent: true }).catch(() => {})));
}
export async function dropKind(sub: "t" | "o") {
  [...HAVE].forEach((f) => f.indexOf(sub + "/") === 0 && HAVE.delete(f));
  if (WEB) return webSave();
  if (!DIR) return;
  await deleteAsync(DIR + sub, { idempotent: true }).catch(() => {});
  await makeDirectoryAsync(DIR + sub, { intermediates: true }).catch(() => {});
}
export async function dropAll() {
  await dropKind("t");
  await dropKind("o");
}

// copie superate: stesso percorso con un'altra versione (o senza versione) rispetto a quella pubblicata ora
function dropStale() {
  const cur: Record<string, string> = {};
  Object.keys(VMAP).forEach((rel) => {
    const t = rel.indexOf("img/t/") === 0;
    cur[(t ? "t/" + clean(rel.slice(6)) : "o/" + clean(rel))] = "v=" + VMAP[rel];
  });
  const old: string[] = [];
  HAVE.forEach((f) => {
    const base = f.split("@")[0],
      v = cur[base],
      m = f.match(/[@_]v=(\d+)/);
    if (v && (!m || "v=" + m[1] !== v)) old.push(f);
  });
  if (!old.length) return;
  old.forEach((f) => HAVE.delete(f));
  if (WEB) return webSave();
  old.forEach((f) => deleteAsync(DIR + f, { idempotent: true }).catch(() => {}));
}

// versioni pubblicate dal sito: true se sono cambiate
export async function loadVersions() {
  try {
    const r = await fetch("https://knightofgemini.github.io/digital-gate-digimontcg/img/v.json?t=" + Date.now(), { cache: "no-store" });
    if (!r.ok) return false;
    const v = await r.json();
    if (!v || typeof v !== "object") return false;
    const a = JSON.stringify(v);
    if (a === JSON.stringify(VMAP)) return false;
    VMAP = v;
    AsyncStorage.setItem("dg-imgv", a).catch(() => {});
    dropStale();
    return true;
  } catch (e) {
    return false;
  }
}

// conteggio per tipo e peso stimato delle immagini salvate
export function haveStats(avg: { f: number; t: number; pre: number; b: number; pk: number; lg: number }) {
  let nT = 0,
    nF = 0,
    nO = 0,
    w = 0;
  HAVE.forEach((f) => {
    if (f.indexOf("t/") === 0) {
      nT++;
      w += avg.t;
    } else if (f.indexOf("o/img_f_") === 0) {
      nF++;
      w += avg.f;
    } else {
      nO++;
      w += f.indexOf("o/img_pre_") === 0 ? avg.pre : f.indexOf("o/banners_") === 0 ? avg.b : f.indexOf("o/prod_logo_") === 0 ? avg.lg : avg.pk;
    }
  });
  return { nT, nF, nO, w };
}
