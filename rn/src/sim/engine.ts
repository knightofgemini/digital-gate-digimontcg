// Simulatore (ramo `simulatore`, 26 novembre 2026, richiesta dell'utente): motore delle regole del Digimon Card Game per
// una partita contro il telefono con i mazzi base ST1 Gaia Red e ST2 Cocytus Blue. Regole principali (memoria, uova e
// allevamento, digievoluzione con pesca, attacchi, Blocker, Security Attack, controlli della Sicurezza) e tutti gli
// effetti delle 32 carte dei due mazzi. Nessun import: la schermata (`src/app/simulatore.tsx`) passa le carte (`Def`)
// e un'interfaccia (`SimUI`) per le domande e le animazioni; le prove girano con node (`scripts/sim.test.mjs`).

export type Def = { code: string; n: string; lv: number; col: string; t: string; dp: number; pc: number; ec: number | null; e: string; i: string; s: string };
export type CardInst = { u: string; c: string };
export type Stack = { u: string; cards: CardInst[]; susp: boolean; fresh: boolean; buffs: { dp: number; exp: number }[]; noAB: number; mg: number };
export type Player = { key: string; ai: boolean; deck: CardInst[]; eggs: CardInst[]; hand: CardInst[]; sec: CardInst[]; trash: CardInst[]; breed: Stack | null; field: Stack[]; secBuff: { dp: number; exp: number }[]; sw: number };
export type Game = { P: [Player, Player]; cur: 0 | 1; mem: number; turn: number; phase: "breed" | "main"; over: 0 | 1 | null; busy: boolean; log: { t: string; c: string }[] };
export type Opt<T> = { label: string; sub?: string; v: T; pri?: boolean; code?: string };

// animazioni ed effetti chiesti alla schermata: ognuno si aspetta finché non è finito
export type Fx =
  | { k: "banner"; text: string; op: boolean }
  | { k: "phase"; text: string }
  | { k: "spawn"; u: string; how: "play" | "evo" | "hatch" | "draw" | "move" | "sec" | "free" }
  | { k: "attack"; from: string; to: string }
  | { k: "block"; u: string }
  | { k: "clash"; a: string; b: string; da: number; db: number }
  | { k: "delete"; u: string }
  | { k: "bounce"; u: string }
  | { k: "reveal"; pi: 0 | 1; atk: string; atkDp: number; sec: string; secDp: number | null; res: string; lost: boolean }
  | { k: "buff"; u: string; n: number }
  | { k: "effect"; pi: 0 | 1; code: string; text: string }
  | { k: "mem"; from: number; to: number }
  | { k: "trashSrc"; u: string; n: number }
  | { k: "unsusp"; u: string }
  | { k: "end"; win: 0 | 1 };

export interface SimUI {
  ask<T>(title: string, opts: Opt<T>[], cancel?: string, body?: string): Promise<T | null>;
  fx(e: Fx): Promise<void>;
  update(): void;
  isLive(g: Game): boolean;
}

export const DECKS: Record<string, { name: string; code: string; list: Record<string, number> }> = {
  red: { name: "Gaia Red", code: "ST1", list: { "ST1-01": 4, "ST1-02": 4, "ST1-03": 4, "ST1-04": 4, "ST1-05": 4, "ST1-06": 2, "ST1-07": 4, "ST1-08": 4, "ST1-09": 2, "ST1-10": 2, "ST1-11": 2, "ST1-12": 2, "ST1-13": 4, "ST1-14": 4, "ST1-15": 4, "ST1-16": 4 } },
  blue: { name: "Cocytus Blue", code: "ST2", list: { "ST2-01": 4, "ST2-02": 4, "ST2-03": 4, "ST2-04": 4, "ST2-05": 4, "ST2-06": 4, "ST2-07": 2, "ST2-08": 2, "ST2-09": 4, "ST2-10": 2, "ST2-11": 2, "ST2-12": 2, "ST2-13": 4, "ST2-14": 4, "ST2-15": 4, "ST2-16": 4 } },
};
export const SIM_CODES = Object.values(DECKS).flatMap((d) => Object.keys(d.list));

// carta del catalogo dell'app → dati per il motore
export function toDef(c: { code: string; name: string; lv: string; colors: string[]; ct: string; dp: string; play: string; evo: string; eff: string; inh: string; sec: string }): Def {
  const m = /Lv\.(\d+) (\w+): (\d+)/.exec(c.evo || "");
  return { code: c.code, n: c.name, lv: c.lv ? parseInt(c.lv.replace(/\D/g, "")) || 0 : 0, col: c.colors[0] || "", t: c.ct, dp: parseInt(c.dp) || 0, pc: parseInt(c.play) || 0, ec: m ? parseInt(m[3]) : null, e: (c.eff || "").trim(), i: (c.inh || "").trim(), s: (c.sec || "").trim() };
}

export class Sim {
  G!: Game;
  DB: Record<string, Def>;
  ui: SimUI;
  uid = 0;
  rnd: () => number;
  constructor(db: Record<string, Def>, ui: SimUI, rnd: () => number = Math.random) {
    this.DB = db;
    this.ui = ui;
    this.rnd = rnd;
  }
  // ---- aiuti ----
  D = (c: CardInst) => this.DB[c.c];
  mk = (c: string): CardInst => ({ u: "c" + ++this.uid, c });
  stack = (cards: CardInst[]): Stack => ({ u: "s" + ++this.uid, cards, susp: false, fresh: true, buffs: [], noAB: -9, mg: -9 });
  top = (s: Stack) => this.DB[s.cards[s.cards.length - 1].c];
  topCode = (s: Stack) => s.cards[s.cards.length - 1].c;
  nsrc = (s: Stack) => s.cards.length - 1;
  srcCodes = (s: Stack) => s.cards.slice(0, -1).map((c) => c.c);
  isDigi = (s: Stack) => this.top(s).t === "Digimon";
  P = (i: number) => this.G.P[i];
  digis = (i: number) => this.P(i).field.filter(this.isDigi);
  alive = (i: number, s: Stack) => this.P(i).field.includes(s);
  owner = (s: Stack): 0 | 1 => (this.P(0).field.includes(s) || this.P(0).breed === s ? 0 : 1);
  log(t: string, c = "") {
    this.G.log.push({ t, c });
    if (this.G.log.length > 120) this.G.log.shift();
  }
  shuffle<T>(a: T[]) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  async fx(e: Fx) {
    if (!this.ui.isLive(this.G)) return;
    await this.ui.fx(e);
  }
  newPlayer(key: string, ai: boolean): Player {
    const L = DECKS[key].list,
      deck: CardInst[] = [],
      eggs: CardInst[] = [];
    for (const k in L) for (let n = 0; n < L[k]; n++) (this.DB[k].t === "Digi-Egg" ? eggs : deck).push(this.mk(k));
    this.shuffle(deck);
    this.shuffle(eggs);
    const p: Player = { key, ai, deck, eggs, hand: [], sec: [], trash: [], breed: null, field: [], secBuff: [], sw: -9 };
    p.sec = deck.splice(0, 5);
    p.hand = deck.splice(0, 5);
    return p;
  }
  newGame(mine: string, first?: 0 | 1) {
    this.uid = 0;
    const theirs = mine === "red" ? "blue" : "red";
    this.G = { P: [this.newPlayer(mine, false), this.newPlayer(theirs, true)], cur: first ?? (this.rnd() < 0.5 ? 0 : 1), mem: 0, turn: 0, phase: "breed", over: null, busy: false, log: [] };
    this.log((this.G.cur === 0 ? "Inizi tu" : "Inizia l'avversario") + ". Il primo turno non si pesca.", "k");
    return this.G;
  }

  // ---- valori calcolati ----
  dp(i: number, s: Stack, vs?: { cards: CardInst[] } | null) {
    const G = this.G,
      t = this.top(s);
    let v = t.dp;
    for (const c of this.srcCodes(s)) {
      if (c === "ST1-01" && G.cur === i && this.nsrc(s) >= 4) v += 1000;
      if (c === "ST1-03" && G.cur === i) v += 1000;
      if (c === "ST2-01" && G.cur === i && vs && vs.cards.length === 1) v += 1000;
    }
    for (const b of s.buffs) if (b.exp >= G.turn) v += b.dp;
    if (G.cur === i && t.t === "Digimon") v += 1000 * this.P(i).field.filter((x) => this.topCode(x) === "ST1-12").length;
    return Math.max(0, v);
  }
  secA(i: number, s: Stack) {
    const G = this.G;
    let n = 1;
    const cs = this.srcCodes(s);
    n += cs.filter((c) => c === "ST1-07").length;
    if (this.topCode(s) === "ST1-11" && G.cur === i) n += Math.floor(this.nsrc(s) / 2);
    if (cs.includes("ST2-08") && G.cur === i && this.digis(1 - i).some((x) => this.nsrc(x) === 0)) n += 1;
    if (this.P(i).sw >= G.turn) n += 1;
    return n;
  }
  secBuff = (i: number) => this.P(i).secBuff.filter((b) => b.exp >= this.G.turn).reduce((a, b) => a + b.dp, 0);
  blocker = (s: Stack) => /＜Blocker＞/.test(this.top(s).e);
  canAtk = (i: number, s: Stack) => this.isDigi(s) && !s.susp && !s.fresh && s.noAB < this.G.turn && this.P(i).field.includes(s);
  canBlock = (s: Stack) => this.isDigi(s) && !s.susp && this.blocker(s) && s.noAB < this.G.turn;
  async gain(i: number, n: number) {
    const from = this.G.mem;
    this.G.mem += i === this.G.cur ? n : -n;
    this.G.mem = Math.max(-10, Math.min(10, this.G.mem));
    await this.fx({ k: "mem", from, to: this.G.mem });
  }
  async pay(n: number) {
    const from = this.G.mem;
    this.G.mem -= n;
    if (n) await this.fx({ k: "mem", from, to: this.G.mem });
  }
  hasColor = (i: number, col: string) => [...this.P(i).field, this.P(i).breed].some((s) => s && this.top(s).col === col);
  evoTargets(i: number, card: CardInst) {
    const d = this.D(card);
    if (d.t !== "Digimon" || d.ec == null) return [];
    return [...this.P(i).field, this.P(i).breed].filter((s): s is Stack => !!s && this.top(s).lv === d.lv - 1 && this.top(s).col === d.col && this.top(s).t !== "Tamer");
  }
  canPay = (n: number) => this.G.mem - n >= -10;
  canUse(i: number, card: CardInst) {
    const d = this.D(card);
    if (d.t === "Digi-Egg") return false;
    if (d.t === "Option" && !this.hasColor(i, d.col)) return false;
    return this.canPay(d.pc);
  }

  // ---- scelte ----
  async choose(i: number, title: string, items: Stack[], aiPick: (a: Stack[]) => Stack | undefined, optional?: boolean) {
    if (!items.length) return null;
    if (this.P(i).ai) return aiPick(items) || null;
    return this.ui.ask(
      title,
      items.map((s) => ({ label: this.top(s).n, sub: "DP " + this.dp(this.owner(s), s) + " · Lv." + this.top(s).lv + (this.nsrc(s) ? " · " + this.nsrc(s) + " sotto" : ""), v: s, code: this.topCode(s) })),
      optional ? "Nessuno" : undefined,
    );
  }
  best = (i: number) => (arr: Stack[]) => arr.slice().sort((a, b) => this.dp(i, b) - this.dp(i, a))[0];

  // ---- effetti ----
  async kill(i: number, s: Stack) {
    await this.fx({ k: "delete", u: s.u });
    this.P(i).field = this.P(i).field.filter((x) => x !== s);
    this.P(i).trash.push(...s.cards);
    this.log(this.top(s).n + (i ? " (avversario)" : " (tuo)") + " viene eliminato.", "a");
    this.ui.update();
  }
  async effect(i: 0 | 1, code: string, text: string) {
    await this.fx({ k: "effect", pi: i, code, text });
  }
  async plus(i: number, n: number, exp: number, title: string) {
    const s = await this.choose(i, title, this.digis(i), this.best(i));
    if (s) {
      s.buffs.push({ dp: n, exp });
      this.log(this.top(s).n + " ottiene +" + n + " DP.", "y");
      this.ui.update();
      await this.fx({ k: "buff", u: s.u, n });
    }
  }
  async trashBottom(i: number, k: number, f: (s: Stack) => boolean) {
    const o = 1 - i,
      t = this.digis(o).filter((s) => this.nsrc(s) > 0 && f(s));
    const s = await this.choose(i, "Togli carte sotto a un Digimon avversario", t, (a) => a.slice().sort((x, y) => this.nsrc(y) - this.nsrc(x))[0]);
    if (!s) return;
    const n = Math.min(k, this.nsrc(s));
    await this.fx({ k: "trashSrc", u: s.u, n });
    const r = s.cards.splice(0, n);
    this.P(o).trash.push(...r);
    this.log("Tolte " + r.length + " carte sotto " + this.top(s).n + ".", "y");
    this.ui.update();
  }
  async runMain(i: 0 | 1, code: string) {
    const G = this.G,
      o = (1 - i) as 0 | 1;
    switch (code) {
      case "ST1-13":
        return this.plus(i, 3000, G.turn, "Shadow Wing: +3000 DP a");
      case "ST1-14":
        this.P(i).secBuff.push({ dp: 7000, exp: G.turn + 1 });
        this.log((i ? "I Digimon in Sicurezza dell'avversario" : "I tuoi Digimon in Sicurezza") + " hanno +7000 DP.", "y");
        return;
      case "ST1-15": {
        for (let k = 0; k < 2; k++) {
          const t = this.digis(o).filter((s) => this.dp(o, s) <= 4000);
          const s = await this.choose(i, "Giga Destroyer: elimina (" + (k + 1) + " di 2)", t, this.best(o), true);
          if (!s) break;
          await this.kill(o, s);
        }
        return;
      }
      case "ST1-16": {
        const s = await this.choose(i, "Gaia Force: elimina", this.digis(o), this.best(o));
        if (s) await this.kill(o, s);
        return;
      }
      case "ST2-13":
        await this.gain(i, 1);
        this.log(i ? "Avversario guadagna 1 memoria." : "Guadagni 1 memoria.", "y");
        return;
      case "ST2-14": {
        const s = await this.choose(i, "Sorrow Blue: non può attaccare né bloccare", this.digis(o).filter((x) => this.nsrc(x) === 0), this.best(o));
        if (s) {
          s.noAB = G.turn + 1;
          this.log(this.top(s).n + " non può attaccare né bloccare.", "y");
          this.ui.update();
        }
        return;
      }
      case "ST2-15": {
        const opts: { s: Stack; c: CardInst }[] = [];
        for (const s of this.digis(i)) s.cards.slice(0, -1).forEach((c) => this.D(c).t === "Digimon" && opts.push({ s, c }));
        if (!opts.length) return;
        let pick: { s: Stack; c: CardInst } | null;
        if (this.P(i).ai) pick = opts.sort((a, b) => this.D(b.c).lv - this.D(a.c).lv)[0];
        else pick = await this.ui.ask("Kaiser Nail: gioca gratis", opts.map((x) => ({ label: this.D(x.c).n, sub: "da sotto " + this.top(x.s).n, v: x, code: x.c.c })));
        if (!pick) return;
        pick.s.cards.splice(pick.s.cards.indexOf(pick.c), 1);
        const ns = this.stack([pick.c]);
        this.P(i).field.push(ns);
        this.log((i ? "Avversario gioca " : "Giochi ") + this.D(pick.c).n + " gratis.", "y");
        this.ui.update();
        await this.fx({ k: "spawn", u: ns.u, how: "free" });
        return;
      }
      case "ST2-16": {
        const s = await this.choose(i, "Cocytus Breath: torna in mano", this.digis(o), this.best(o));
        if (s) {
          await this.fx({ k: "bounce", u: s.u });
          this.P(o).field = this.P(o).field.filter((x) => x !== s);
          const t = s.cards.pop()!;
          this.P(o).trash.push(...s.cards);
          this.P(o).hand.push(t);
          this.log(this.D(t).n + (o ? " torna in mano all'avversario." : " torna nella tua mano."), "a");
          this.ui.update();
        }
        return;
      }
    }
  }
  async runSec(i: 0 | 1, card: CardInst) {
    const G = this.G,
      c = card.c,
      d = this.D(card);
    if (d.t === "Tamer") {
      const ns = this.stack([card]);
      this.P(i).field.push(ns);
      this.log(d.n + " entra in gioco dalla Sicurezza.", "y");
      this.ui.update();
      await this.fx({ k: "spawn", u: ns.u, how: "sec" });
      return true;
    }
    if (d.s) await this.effect(i, c, d.s);
    switch (c) {
      case "ST1-13":
        this.P(i).sw = G.turn + 1;
        this.log((i ? "I Digimon dell'avversario ottengono" : "I tuoi Digimon ottengono") + " Security A. +1.", "y");
        break;
      case "ST1-14":
        this.P(i).secBuff.push({ dp: 7000, exp: G.turn });
        this.log("Digimon in Sicurezza +7000 DP per il turno.", "y");
        break;
      case "ST2-13":
        await this.gain(i, 2);
        this.log(i ? "Avversario guadagna 2 memoria." : "Guadagni 2 memoria.", "y");
        break;
      case "ST2-14": {
        const s = await this.choose(i, "Sorrow Blue: non può attaccare né bloccare", this.digis(1 - i).filter((x) => this.nsrc(x) === 0), this.best(1 - i));
        if (s) {
          s.noAB = G.turn + 1;
          this.log(this.top(s).n + " non può attaccare né bloccare.", "y");
        }
        break;
      }
      default:
        await this.runMain(i, c);
    }
    return false;
  }
  async onEvo(i: 0 | 1, s: Stack) {
    const c = this.topCode(s);
    if (c === "ST1-08") {
      await this.effect(i, c, this.top(s).e);
      await this.plus(i, 3000, this.G.turn, "Garudamon: +3000 DP a");
    }
    if (c === "ST2-09") {
      await this.effect(i, c, this.top(s).e);
      await this.trashBottom(i, 2, () => true);
    }
  }

  // ---- azioni ----
  async hatch(i: 0 | 1) {
    const p = this.P(i),
      c = p.eggs.shift()!;
    p.breed = this.stack([c]);
    p.breed.fresh = false;
    this.log((i ? "Avversario schiude " : "Schiudi ") + this.D(c).n + ".");
    this.ui.update();
    await this.fx({ k: "spawn", u: p.breed.u, how: "hatch" });
  }
  async moveOut(i: 0 | 1) {
    const p = this.P(i),
      s = p.breed!;
    p.field.push(s);
    p.breed = null;
    this.log((i ? "Avversario sposta " : "Sposti ") + this.top(s).n + " in campo.");
    this.ui.update();
    await this.fx({ k: "spawn", u: s.u, how: "move" });
  }
  async play(i: 0 | 1, card: CardInst) {
    const p = this.P(i),
      d = this.D(card);
    p.hand = p.hand.filter((x) => x !== card);
    this.log((i ? "Avversario gioca " : "Giochi ") + d.n + " (costo " + d.pc + ").");
    if (d.t === "Option") {
      this.ui.update();
      await this.effect(i, card.c, d.e);
      await this.pay(d.pc);
      await this.runMain(i, card.c);
      p.trash.push(card);
      this.ui.update();
    } else {
      const ns = this.stack([card]);
      p.field.push(ns);
      this.ui.update();
      await this.fx({ k: "spawn", u: ns.u, how: "play" });
      await this.pay(d.pc);
    }
  }
  async evo(i: 0 | 1, card: CardInst, s: Stack) {
    const p = this.P(i),
      d = this.D(card);
    p.hand = p.hand.filter((x) => x !== card);
    this.log((i ? "Avversario digievolve " : "Digievolvi ") + this.top(s).n + " in " + d.n + " (costo " + d.ec + ").");
    s.cards.push(card);
    this.ui.update();
    await this.fx({ k: "spawn", u: s.u, how: "evo" });
    await this.pay(d.ec || 0);
    if (p.deck.length) {
      const c = p.deck.shift()!;
      p.hand.push(c);
      this.ui.update();
      await this.fx({ k: "spawn", u: c.u, how: "draw" });
    }
    await this.onEvo(i, s);
  }
  async attack(i: 0 | 1, s: Stack, target: Stack | "p") {
    const G = this.G,
      o = (1 - i) as 0 | 1;
    s.susp = true;
    this.log(this.top(s).n + " attacca " + (target === "p" ? "il giocatore" : this.top(target).n) + ".", "k");
    this.ui.update();
    if (/Lose 2 memory/.test(this.top(s).e)) {
      await this.effect(i, this.topCode(s), "[When Attacking] Lose 2 memory.");
      await this.pay(2);
      this.log(i ? "Avversario perde 2 memoria." : "Perdi 2 memoria.");
    }
    for (const c of this.srcCodes(s)) {
      if (c === "ST2-03") {
        await this.effect(i, c, this.DB[c].i);
        await this.trashBottom(i, 1, (x) => this.top(x).lv <= 5);
      }
      if (c === "ST2-06") {
        await this.effect(i, c, this.DB[c].i);
        await this.trashBottom(i, 1, () => true);
      }
    }
    if (this.topCode(s) === "ST2-11" && s.mg !== G.turn) {
      s.mg = G.turn;
      await this.effect(i, "ST2-11", this.top(s).e);
      s.susp = false;
      this.log("MetalGarurumon si raddrizza.", "y");
      this.ui.update();
    }
    if (!this.alive(i, s)) return;
    if (target !== "p" && !this.alive(o, target)) return;
    const bl = this.digis(o).filter((b) => this.canBlock(b) && b !== target);
    let b: Stack | null = null;
    if (bl.length) {
      if (this.P(o).ai) {
        const a = this.dp(i, s);
        b = bl.filter((x) => this.dp(o, x) >= a)[0] || (target === "p" && this.P(o).sec.length <= 1 ? bl[0] : null);
      } else {
        b = await this.ui.ask(
          "Bloccare l'attacco?",
          bl.map((x) => ({ label: "Blocca con " + this.top(x).n, sub: "DP " + this.dp(o, x), v: x, code: this.topCode(x) })),
          "Non bloccare",
          this.top(s).n + " (DP " + this.dp(i, s) + ") attacca " + (target === "p" ? "te" : this.top(target).n) + ".",
        );
      }
    }
    if (b) {
      b.susp = true;
      this.log(this.top(b).n + " blocca!", "k");
      this.ui.update();
      await this.fx({ k: "block", u: b.u });
      target = b;
      if (this.srcCodes(s).includes("ST1-09") && G.cur === i) {
        await this.effect(i, "ST1-09", this.DB["ST1-09"].i);
        await this.gain(i, 3);
        this.log(i ? "Avversario guadagna 3 memoria (MetalGreymon)." : "Guadagni 3 memoria (MetalGreymon).", "y");
      }
    }
    await this.fx({ k: "attack", from: s.u, to: target === "p" ? "sec" + o : target.u });
    if (target === "p") await this.secCheck(i, s);
    else await this.battle(i, s, target);
  }
  async battle(i: 0 | 1, a: Stack, b: Stack) {
    const o = (1 - i) as 0 | 1,
      x = this.dp(i, a, b),
      y = this.dp(o, b, a);
    this.log("Battaglia: " + this.top(a).n + " " + x + " contro " + this.top(b).n + " " + y + ".");
    await this.fx({ k: "clash", a: a.u, b: b.u, da: x, db: y });
    if (x >= y) await this.kill(o, b);
    if (y >= x) await this.kill(i, a);
  }
  async secCheck(i: 0 | 1, s: Stack) {
    const o = (1 - i) as 0 | 1,
      d = this.P(o);
    if (!d.sec.length) {
      this.G.over = i;
      this.log(i ? "L'avversario vince la partita." : "Hai vinto la partita!", "k");
      this.ui.update();
      await this.fx({ k: "end", win: i });
      return;
    }
    const n = this.secA(i, s);
    if (n > 1) this.log("Controlla " + n + " carte della Sicurezza.");
    for (let k = 0; k < n; k++) {
      if (!this.alive(i, s) || !d.sec.length) break;
      const c = d.sec.shift()!,
        cd = this.D(c);
      this.log("Sicurezza: " + cd.n + ".", "k");
      this.ui.update();
      if (cd.t === "Digimon") {
        const x = this.dp(i, s, { cards: [c] }),
          y = cd.dp + this.secBuff(o);
        this.log("Battaglia: " + this.top(s).n + " " + x + " contro " + cd.n + " " + y + ".");
        await this.fx({ k: "reveal", pi: o, atk: this.topCode(s), atkDp: x, sec: c.c, secDp: y, res: x > y ? "Controllo superato" : x === y ? "Pareggio: " + this.top(s).n + " viene eliminato" : this.top(s).n + " viene eliminato", lost: x <= y });
        d.trash.push(c);
        this.ui.update();
        if (x <= y) await this.kill(i, s);
      } else {
        await this.fx({ k: "reveal", pi: o, atk: this.topCode(s), atkDp: this.dp(i, s), sec: c.c, secDp: null, res: cd.s ? "Effetto di Sicurezza" : "Nessun effetto", lost: false });
        const kept = await this.runSec(o, c);
        if (!kept) d.trash.push(c);
        this.ui.update();
      }
    }
  }

  // ---- turni ----
  async startTurn() {
    const G = this.G,
      g = G;
    G.turn++;
    const i = G.cur,
      p = this.P(i);
    for (const q of [0, 1]) {
      for (const s of this.P(q).field) s.buffs = s.buffs.filter((b) => b.exp >= G.turn);
      this.P(q).secBuff = this.P(q).secBuff.filter((b) => b.exp >= G.turn);
    }
    const ups = p.field.filter((s) => s.susp);
    for (const s of p.field) {
      s.susp = false;
      s.fresh = false;
    }
    G.phase = "breed";
    this.log("— Turno " + G.turn + ": " + (i === 0 ? "tocca a te" : "tocca all'avversario") + " (memoria " + G.mem + ") —", "k");
    this.ui.update();
    await this.fx({ k: "banner", text: i === 0 ? "Il tuo turno" : "Turno avversario", op: i === 1 });
    if (!this.ui.isLive(g)) return;
    if (ups.length) await this.fx({ k: "unsusp", u: ups.map((s) => s.u).join(",") });
    if (p.field.some((s) => this.topCode(s) === "ST2-12") && this.digis(1 - i).some((x) => this.nsrc(x) === 0)) {
      await this.effect(i, "ST2-12", this.DB["ST2-12"].e);
      await this.gain(i, 1);
      this.log("Matt Ishida: +1 memoria.", "y");
    }
    if (G.turn > 1) {
      if (!p.deck.length) {
        G.over = (1 - i) as 0 | 1;
        this.log(i ? "L'avversario non può pescare e perde." : "Non puoi pescare: hai perso.", "k");
        this.ui.update();
        await this.fx({ k: "end", win: G.over });
        return;
      }
      const c = p.deck.shift()!;
      p.hand.push(c);
      this.ui.update();
      await this.fx({ k: "spawn", u: c.u, how: "draw" });
    }
    if (!this.ui.isLive(g)) return;
    if (p.ai) await this.aiTurn();
  }
  async endTurn(pass: boolean) {
    const G = this.G;
    if (G.over != null) return;
    const nm = pass ? 3 : -G.mem;
    this.log(pass ? (G.cur ? "L'avversario passa il turno." : "Passi il turno.") : "La memoria passa all'avversario: fine turno.");
    if (pass) {
      const from = G.mem;
      G.mem = -3;
      await this.fx({ k: "mem", from, to: -3 });
    }
    G.cur = (1 - G.cur) as 0 | 1;
    G.mem = nm;
    G.phase = "breed";
    if (!this.ui.isLive(G)) return;
    await this.startTurn();
  }
  // dopo un'azione della persona: fine partita o fine turno se la memoria è passata
  async after() {
    const G = this.G;
    this.ui.update();
    if (G.over != null) return;
    if (G.mem < 0) await this.endTurn(false);
  }
  async toMain() {
    this.G.phase = "main";
    this.ui.update();
    await this.fx({ k: "phase", text: "Fase principale" });
  }

  // ---- IA ----
  aiCands(i: 0 | 1) {
    const p = this.P(i),
      o = 1 - i,
      out: { sc: number; cost: number; go: () => Promise<void> }[] = [],
      od = this.digis(o);
    const big = od.length ? Math.max(...od.map((s) => this.top(s).lv)) : 0;
    for (const c of p.hand) {
      const d = this.D(c);
      for (const s of this.evoTargets(i, c)) out.push({ sc: 20 + d.lv * 2 + (s === p.breed ? 1 : 0), cost: d.ec || 0, go: () => this.evo(i, c, s) });
      if (d.t === "Digimon") {
        const n = p.field.filter(this.isDigi).length;
        out.push({ sc: (d.lv === 3 ? 10 : d.lv === 4 ? 7 : 3) - n * 2, cost: d.pc, go: () => this.play(i, c) });
      }
      if (d.t === "Tamer" && !p.field.some((s) => this.topCode(s) === c.c)) out.push({ sc: 9, cost: d.pc, go: () => this.play(i, c) });
      if (d.t === "Option" && this.hasColor(i, d.col)) {
        let sc = 0;
        if (c.c === "ST1-16" || c.c === "ST2-16") sc = big >= 5 ? 24 : big >= 4 && od.length ? 12 : 0;
        if (c.c === "ST1-15") sc = od.filter((s) => this.dp(o, s) <= 4000).length * 9;
        if (c.c === "ST2-13") sc = 15;
        if (c.c === "ST2-14") sc = od.some((s) => this.nsrc(s) === 0 && !s.susp) ? 5 : 0;
        if (c.c === "ST2-15") sc = this.digis(i).some((s) => s.cards.slice(0, -1).some((x) => this.D(x).t === "Digimon" && this.D(x).lv >= 4)) ? 11 : 0;
        if (sc > 0) out.push({ sc, cost: d.pc, go: () => this.play(i, c) });
      }
    }
    return out.filter((x) => this.canPay(x.cost));
  }
  async aiTurn() {
    const G = this.G,
      i = G.cur,
      p = this.P(i),
      o = (1 - i) as 0 | 1;
    const live = () => this.ui.isLive(G);
    if (!p.breed && p.eggs.length) await this.hatch(i);
    else if (p.breed && (this.top(p.breed).lv >= 4 || (this.top(p.breed).lv === 3 && !p.field.some(this.isDigi)))) await this.moveOut(i);
    G.phase = "main";
    this.ui.update();
    if (!live()) return;
    for (let n = 0; n < 20 && G.cur === i && G.over == null; n++) {
      const c = this.aiCands(i)
        .filter((x) => G.mem - x.cost >= 0)
        .sort((a, b) => b.sc - a.sc)[0];
      if (!c || c.sc <= 0) break;
      await c.go();
      if (!live()) return;
      if (G.mem < 0) break;
    }
    if (G.cur === i && G.over == null && G.mem >= 0) {
      for (const s of p.field.slice()) {
        if (G.over != null || G.mem < 0) break;
        if (!this.alive(i, s) || !this.canAtk(i, s)) continue;
        const a = this.dp(i, s);
        const prey = this.digis(o)
          .filter((x) => x.susp && this.dp(o, x) < a)
          .sort((x, y) => this.top(y).lv - this.top(x).lv)[0];
        if (prey) await this.attack(i, s, prey);
        else if (a >= 3000 || this.P(o).sec.length <= 2) await this.attack(i, s, "p");
        else continue;
        if (!live()) return;
      }
    }
    if (G.over != null) return;
    if (G.mem >= 0 && G.cur === i) {
      const c = this.aiCands(i)
        .filter((x) => G.mem - x.cost >= -3)
        .sort((a, b) => b.sc - a.sc)[0];
      if (c && c.sc > 0 && G.mem - c.cost < 0) await c.go();
      if (!live()) return;
    }
    if (G.over != null) return;
    await this.endTurn(G.mem >= 0);
  }
}
