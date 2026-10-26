// Collegamento con la pagina del motore (WebView sul telefono, iframe sul sito): richieste con risposta.
type Pending = { res: (v: any) => void; rej: (e: any) => void };
let post: ((s: string) => void) | null = null;
let ready = false;
const queue: string[] = [];
const pending: Record<string, Pending> = {};
let seq = 0;
let onProgress: ((p: number) => void) | null = null;

export function setPoster(fn: ((s: string) => void) | null) {
  post = fn;
  ready = false;
}
export function setProgress(fn: ((p: number) => void) | null) {
  onProgress = fn;
}
export function engineMessage(data: string) {
  let m: any;
  try {
    m = JSON.parse(data);
  } catch (e) {
    return;
  }
  if (m.ev === "ready") {
    ready = true;
    while (queue.length && post) post(queue.shift()!);
    return;
  }
  if (m.ev === "progress") {
    onProgress && onProgress(m.p);
    return;
  }
  const p = pending[m.id];
  if (!p) return;
  delete pending[m.id];
  if (m.err) p.rej(new Error(m.err));
  else p.res(m);
}
// ogni richiesta ha un tempo massimo (la prima volta il motore scarica ~15 MB: tempo largo), così non resta mai sospesa
export function ask(msg: any, timeoutMs = 120000): Promise<any> {
  const id = "m" + ++seq;
  const s = JSON.stringify({ ...msg, id });
  return new Promise((res, rej) => {
    const tm = setTimeout(() => {
      if (!pending[id]) return;
      delete pending[id];
      rej(new Error("tempo scaduto"));
    }, timeoutMs);
    pending[id] = {
      res: (v) => (clearTimeout(tm), res(v)),
      rej: (e) => (clearTimeout(tm), rej(e)),
    };
    if (post && ready) post(s);
    else queue.push(s);
  });
}
// il motore si è chiuso (es. memoria finita): le richieste in attesa falliscono subito, il motore viene ricreato
export function engineGone() {
  ready = false;
  queue.length = 0;
  Object.keys(pending).forEach((id) => {
    const p = pending[id];
    delete pending[id];
    p.rej(new Error("motore chiuso"));
  });
}
