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
export function ask(msg: any): Promise<any> {
  const id = "m" + ++seq;
  const s = JSON.stringify({ ...msg, id });
  return new Promise((res, rej) => {
    pending[id] = { res, rej };
    if (post && ready) post(s);
    else queue.push(s);
  });
}
