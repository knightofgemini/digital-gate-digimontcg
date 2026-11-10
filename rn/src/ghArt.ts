// Scrittura dei tagli della Home sul GitHub dell'utente (ramo home-art) dall'editor dell'app (app/tagli.tsx).
// La chiave è un "fine-grained personal access token" creato dall'utente (solo questo progetto, Contents: Read and
// write): sta solo nel suo telefono, in un file privato dell'app; non è nell'APK e gli altri non la vedono.
import { Platform } from "react-native";
import { deleteAsync, documentDirectory, readAsStringAsync, writeAsStringAsync } from "expo-file-system/legacy";
import { ArtState, BRANCH, REPO, artState, setArt } from "./homeArt";

const KEYFILE = Platform.OS !== "web" && documentDirectory ? documentDirectory + "gh-key.txt" : "";
const API = "https://api.github.com/repos/" + REPO + "/contents/";
let KEY = "";
const keySubs = new Set<() => void>();
export const hasKey = () => !!KEY;
export const getKey = () => KEY;
export function onKey(f: () => void) {
  keySubs.add(f);
  return () => {
    keySubs.delete(f);
  };
}
export async function loadKey() {
  if (!KEYFILE) return;
  try {
    KEY = (await readAsStringAsync(KEYFILE)).trim();
  } catch (e) {
    KEY = "";
  }
  keySubs.forEach((f) => f());
}
export async function saveKey(k: string) {
  KEY = k.trim();
  if (KEYFILE) {
    if (KEY) await writeAsStringAsync(KEYFILE, KEY);
    else await deleteAsync(KEYFILE, { idempotent: true }).catch(() => {});
  }
  keySubs.forEach((f) => f());
}

// ---- base64 di testo UTF-8 (i nomi possono avere lettere accentate)
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function utf8(s: string): number[] {
  const out: number[] = [];
  for (const ch of s) {
    let c = ch.codePointAt(0)!;
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return out;
}
export function toB64(s: string): string {
  const b = utf8(s);
  let o = "";
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i] << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    o += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < b.length ? B64[(n >> 6) & 63] : "=") + (i + 2 < b.length ? B64[n & 63] : "=");
  }
  return o;
}
export function fromB64(s: string): string {
  const clean = s.replace(/[^A-Za-z0-9+/]/g, "");
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const n = (B64.indexOf(clean[i]) << 18) | (B64.indexOf(clean[i + 1]) << 12) | ((B64.indexOf(clean[i + 2]) & 63) << 6) | (B64.indexOf(clean[i + 3]) & 63);
    bytes.push((n >> 16) & 255);
    if (clean[i + 2] !== undefined) bytes.push((n >> 8) & 255);
    if (clean[i + 3] !== undefined) bytes.push(n & 255);
  }
  let o = "";
  for (let i = 0; i < bytes.length; ) {
    const c = bytes[i];
    let cp: number, len: number;
    if (c < 0x80) (cp = c), (len = 1);
    else if (c < 0xe0) (cp = c & 31), (len = 2);
    else if (c < 0xf0) (cp = c & 15), (len = 3);
    else (cp = c & 7), (len = 4);
    for (let k = 1; k < len; k++) cp = (cp << 6) | (bytes[i + k] & 63);
    o += String.fromCodePoint(cp);
    i += len;
  }
  return o;
}

// ---- chiamate a GitHub
const head = (k: string) => ({ Authorization: "Bearer " + k, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" });
class GhError extends Error {
  status: number;
  constructor(status: number, msg: string) {
    super(msg);
    this.status = status;
  }
}
function why(status: number) {
  if (status === 401) return "la chiave non è valida o è scaduta";
  if (status === 403 || status === 404) return "la chiave non ha il permesso di scrivere in questo progetto";
  if (status === 409 || status === 422) return "il file è cambiato nel frattempo";
  return "GitHub ha risposto con l'errore " + status;
}
async function getFile(k: string, path: string): Promise<{ sha: string; text: string }> {
  let r: Response;
  try {
    r = await fetch(API + path + "?ref=" + BRANCH + "&t=" + Date.now(), { headers: head(k), cache: "no-store" });
  } catch (e) {
    throw new GhError(0, "nessuna connessione a internet");
  }
  if (!r.ok) throw new GhError(r.status, why(r.status));
  const j = await r.json();
  return { sha: j.sha, text: fromB64(j.content || "") };
}
async function putFile(k: string, path: string, b64: string, message: string, sha?: string) {
  let r: Response;
  try {
    r = await fetch(API + path, { method: "PUT", headers: { ...head(k), "Content-Type": "application/json" }, body: JSON.stringify({ message, content: b64, branch: BRANCH, ...(sha ? { sha } : {}) }) });
  } catch (e) {
    throw new GhError(0, "nessuna connessione a internet");
  }
  if (!r.ok) throw new GhError(r.status, why(r.status));
}

// prova della chiave: deve poter leggere tagli.json del ramo home-art
export async function checkKey(k: string): Promise<string | null> {
  try {
    await getFile(k.trim(), "tagli.json");
    return null;
  } catch (e: any) {
    return e && e.message ? e.message : "errore sconosciuto";
  }
}
// stato più recente direttamente da GitHub (raw.githubusercontent.com può restare indietro di qualche minuto)
export async function fetchFresh(): Promise<ArtState> {
  const f = await getFile(KEY, "tagli.json");
  const o = JSON.parse(f.text) as ArtState;
  setArt(o);
  return artState().t >= (o.t || "") ? artState() : o;
}

// modifica di tagli.json: si rilegge, si applica la modifica e si salva; se intanto è cambiato si riprova una volta.
// Le modifiche passano una alla volta (coda), così due salvataggi di fila non si pestano i piedi.
let queue: Promise<any> = Promise.resolve();
export function editArt(change: (s: ArtState) => void, message: string): Promise<ArtState> {
  const run = async () => {
    for (let tries = 0; ; tries++) {
      const f = await getFile(KEY, "tagli.json");
      const s = JSON.parse(f.text) as ArtState;
      s.immagini = s.immagini || {};
      s.tagli = s.tagli || {};
      change(s);
      const now = new Date().toISOString();
      s.t = now > (s.t || "") ? now : s.t + "+";
      try {
        await putFile(KEY, "tagli.json", toB64(JSON.stringify(s, null, 1)), message, f.sha);
        setArt(s);
        return s;
      } catch (e: any) {
        if (tries < 1 && e && (e.status === 409 || e.status === 422)) continue;
        throw e;
      }
    }
  };
  const p = queue.then(run, run);
  queue = p.catch(() => {});
  return p;
}
// immagine nuova (già ridotta e in base64 dalla pagina dell'editor) in img/: nome nuovo a ogni caricamento, così i
// telefoni non tengono la vecchia nella cache
export async function uploadImage(code: string, b64: string, ext: string): Promise<string> {
  const safe = (code || "IMG").toUpperCase().replace(/[^A-Z0-9-]/g, "") || "IMG";
  const name = safe + "-" + Date.now().toString(36) + "." + (ext === "jpg" ? "jpg" : "webp");
  await putFile(KEY, "img/" + name, b64, "Tagli della Home: immagine di " + safe);
  return name;
}
