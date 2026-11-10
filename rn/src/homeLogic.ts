// Scelte della Home che non dipendono dalla grafica (6 novembre 2026, nuova Home): set da completare, righe di
// "All'orizzonte" con i prodotti della stessa data accorpati, date brevi ("11 DIC", "GEN 2027").
// Niente import: le prove in scripts/home-logic.test.mjs le usano direttamente con Node.

export type GoalSet = { id: string; date: string };
export type GoalStat = { n: number; h: number };

// Set da completare: tra quelli già usciti, con almeno una carta posseduta e almeno una mancante (h e n come in
// setStats dello store: carte e illustrazioni del prodotto), quello più vicino al completamento (h/n più alto);
// a parità il più recente.
// goals: tutti i set da completare in quest'ordine (fila scorrevole della Home); pickGoal: il primo.
export function goals<T extends GoalSet>(sets: T[], stats: Record<string, GoalStat | undefined>, released: (s: T) => boolean): T[] {
  const ok = sets.filter((s) => {
    const st = stats[s.id];
    return !!st && st.n > 0 && st.h > 0 && st.h < st.n && released(s);
  });
  // confronto delle frazioni senza divisioni: h/n > bh/bn  ⇔  h·bn > bh·n
  return ok.sort((a, b) => {
    const A = stats[a.id]!,
      B = stats[b.id]!;
    return B.h * A.n - A.h * B.n || ((b.date || "") > (a.date || "") ? 1 : (b.date || "") < (a.date || "") ? -1 : 0);
  });
}
export function pickGoal<T extends GoalSet>(sets: T[], stats: Record<string, GoalStat | undefined>, released: (s: T) => boolean): T | null {
  return goals(sets, stats, released)[0] || null;
}

// ---- "In evidenza" scorrevole (scelta dell'utente, 6 novembre 2026): prima il prodotto in arrivo con gli spoiler
// più recenti; poi, per ogni tipo (Booster, Extra Booster, Starter, Limited, Premium Bandai), il prossimo in arrivo
// se ha già carte nel catalogo, altrimenti l'ultimo uscito di quel tipo.
export type HeroUp = { code: string; type: string; cards: number; last: string }; // last = data dell'ultimo spoiler
export type HeroSet = { id: string; code: string; type: string; date: string };
export type Slide = { kind: "spoiler" | "up"; code: string } | { kind: "set"; id: string; code: string };
export function heroSlides(ups: HeroUp[], released: HeroSet[], types: string[]): Slide[] {
  const out: Slide[] = [];
  const withCards = ups.filter((u) => u.cards > 0);
  // a parità di data dell'ultimo spoiler vince il primo in ordine di uscita (ups è già in ordine)
  const sp = withCards.reduce<HeroUp | null>((b, u) => (!b || u.last > b.last ? u : b), null);
  if (sp) out.push({ kind: "spoiler", code: sp.code });
  for (const t of types) {
    const u = withCards.find((x) => x.type === t);
    if (u) {
      if (!sp || u.code !== sp.code) out.push({ kind: "up", code: u.code });
      continue;
    }
    const s = released.filter((x) => x.type === t).sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0))[0];
    if (s) out.push({ kind: "set", id: s.id, code: s.code });
  }
  return out;
}

export type UpLike = { code: string; name: string; from?: string; to?: string; prec?: string; kind?: string };

// Due prodotti stanno nella stessa riga solo se escono lo stesso giorno (data esatta), sono dello stesso tipo e hanno
// le stesse uscite per regione (relKey): mai con date solo mensili o da definire.
export function sameDay(a: UpLike, b: UpLike, relKey: (u: UpLike) => string) {
  return a.prec === "day" && b.prec === "day" && !!a.from && a.from === b.from && (a.to || a.from) === (b.to || b.from) && (a.kind || "") === (b.kind || "") && relKey(a) === relKey(b);
}

// Righe di "All'orizzonte": al massimo `max` righe, ognuna con uno o due prodotti (stesso giorno, vedi sameDay).
// `ups` è già in ordine (upSorted) e senza il prodotto in evidenza.
export function upRows<T extends UpLike>(ups: T[], max: number, relKey: (u: UpLike) => string): T[][] {
  const rows: T[][] = [];
  for (const u of ups) {
    const last = rows[rows.length - 1];
    if (last && last.length < 2 && sameDay(last[0], u, relKey)) last.push(u);
    else if (rows.length < max) rows.push([u]);
    else break;
  }
  return rows;
}

// Nome di una riga con più prodotti: la parte comune prima di " · " (es. "Digimon Alysion · Rubeusdramon" e
// "Digimon Alysion · Yukinamon" → "Digimon Alysion"), altrimenti i nomi uniti da " + ".
export function groupName(names: string[]) {
  if (names.length < 2) return names[0] || "";
  if (names.every((n) => n === names[0])) return names[0];
  const heads = names.map((n) => n.split(" · ")[0].trim());
  if (heads[0] && heads.every((h) => h === heads[0]) && names.every((n) => n.indexOf(" · ") > 0)) return heads[0];
  return names.join(" + ");
}

const MON = ["GEN", "FEB", "MAR", "APR", "MAG", "GIU", "LUG", "AGO", "SET", "OTT", "NOV", "DIC"];
const MONTH = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
// Data breve per il riquadro del banner e la colonna di "All'orizzonte": giorno e mese se la data è esatta
// ("11" / "DIC"), mese e anno se si conosce solo il mese ("GEN" / "2027"), niente se è da definire.
// label: la stessa data per esteso, per la lettura ad alta voce.
export function dateParts(u: { from?: string; prec?: string }): { big: string; small: string; label: string } | null {
  if (u.prec === "none" || !u.from) return null;
  const p = u.from.split("-");
  const m = +p[1] - 1;
  if (!(m >= 0 && m < 12)) return null;
  if (u.prec === "day" && p[2]) return { big: p[2].padStart(2, "0"), small: MON[m], label: +p[2] + " " + MONTH[m] + " " + p[0] };
  return { big: MON[m], small: p[0], label: MONTH[m] + " " + p[0] };
}

// Taglio scelto a mano per i riquadri di "All'orizzonte" (quadrati) e "Set da completare" (formato carta) (9 novembre
// 2026, scelta dell'utente): per ogni banner il punto da tenere al centro, `x`/`y` in frazioni dell'immagine, e `r` =
// larghezza/altezza del banner (src/bannerFocus.json). Restituisce la posizione per contentPosition di expo-image
// (come object-position: "30%" allinea il 30% dell'immagine al 30% del riquadro), fermata ai bordi dell'immagine.
export type Focus = { x?: number; y?: number; r: number };
const pct = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 1000) / 10 + "%";
export function focusPos(f: Focus | undefined, box: number, def = { left: "50%", top: "40%" }) {
  if (!f || !(f.r > 0) || !(box > 0)) return def;
  const fx = f.x ?? 0.5;
  const fy = f.y ?? 0.4;
  if (f.r > box) {
    // immagine più larga del riquadro: si sceglie solo il taglio di lato
    return { left: pct((fx * f.r - box / 2) / (f.r - box)), top: "50%" };
  }
  if (f.r < box) {
    // immagine più alta del riquadro: si sceglie solo il taglio in alto/basso
    return { left: "50%", top: pct((fy / f.r - 1 / (2 * box)) / (1 / f.r - 1 / box)) };
  }
  return { left: "50%", top: "50%" };
}

// ---- tagli della Home scelti nell'editor (ramo home-art, vedi homeArt.tsx)
// rettangolo in frazioni dell'originale (x0,y0,x1,y1); W×H = misure dell'originale in pixel.
export type CutRect = { x0: number; y0: number; x1: number; y1: number };
// Taglio salvato adattato a un riquadro di forma `ar` (larghezza/altezza), come le anteprime dell'editor: stesso centro e
// stessa altezza, più o meno largo; se ai lati l'originale non basta si riduce tutto attorno allo stesso centro.
export function fitRect(r: CutRect, ar: number, W: number, H: number): CutRect {
  const cx = ((r.x0 + r.x1) / 2) * W,
    cy = ((r.y0 + r.y1) / 2) * H;
  let h = (r.y1 - r.y0) * H,
    w = h * ar;
  const lim = 2 * Math.min(cx, W - cx);
  if (w > lim) {
    w = lim;
    h = w / ar;
  }
  return { x0: (cx - w / 2) / W, y0: (cy - h / 2) / H, x1: (cx + w / 2) / W, y1: (cy + h / 2) / H };
}
// posizione dell'immagine intera (W×H) dentro un riquadro bw×bh perché si veda esattamente il rettangolo r
export function cutLayout(r: CutRect, W: number, H: number, bw: number) {
  const s = bw / ((r.x1 - r.x0) * W);
  return { width: W * s, height: H * s, left: -r.x0 * W * s, top: -r.y0 * H * s };
}
