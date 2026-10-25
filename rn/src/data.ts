// Dati delle carte: stesso src/data.json del sito (copiato in rn/data/ da scripts/sync-data.js).
import raw from "../data/data.json";

// Formato carta: [code,name,lv,colors,ct,form,attr,trait,dp,play,evo,eff,inh,sec,extra,rar,setId,{x}]
type RawCard = [string, string, string, string, string, string, string, string, string, string, string, string, string, string, string, string, string, any?];

export type Card = {
  idx: number;
  code: string;
  name: string;
  lv: string;
  colors: string[];
  type: string;
  form: string;
  attr: string;
  trait: string;
  dp: string;
  play: string;
  evo: string;
  eff: string;
  inh: string;
  sec: string;
  extra: string;
  rar: string;
  setId: string;
  search: string;
};

export type CardSet = { id: string; code: string; name: string; type: string; date: string };

const FOLDMAP: Record<string, string> = { "ß": "ss", "æ": "ae", "œ": "oe", "ø": "o", "ł": "l", "đ": "d", "ð": "d", "þ": "th", "ı": "i" };
export function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[ßæœøłđðþı]/g, (ch) => FOLDMAP[ch] || ch);
}

export const CARDS: Card[] = (raw.cards as unknown as RawCard[]).map((c, idx) => ({
  idx,
  code: c[0],
  name: c[1],
  lv: c[2],
  colors: c[3] ? c[3].split("/") : [],
  type: c[4],
  form: c[5],
  attr: c[6],
  trait: c[7],
  dp: c[8],
  play: c[9],
  evo: c[10],
  eff: c[11],
  inh: c[12],
  sec: c[13],
  extra: c[14],
  rar: c[15],
  setId: c[16],
  search: fold(c[0] + " " + c[1]),
}));

// Dal numero più recente al più vecchio come i prodotti, dentro lo stesso set in ordine di numero.
const SETS: CardSet[] = raw.sets as CardSet[];
const SETINFO = new Map(SETS.map((s, i) => [s.id, { set: s, order: i }]));
export function setOf(c: Card): CardSet | undefined {
  return SETINFO.get(c.setId)?.set;
}
CARDS.sort((a, b) => {
  const oa = SETINFO.get(a.setId)?.order ?? 999;
  const ob = SETINFO.get(b.setId)?.order ?? 999;
  return oa - ob || a.code.localeCompare(b.code, "en", { numeric: true });
});

const IMG = "https://knightofgemini.github.io/digital-gate-digimontcg/img/";
export const thumbUrl = (c: Card) => IMG + "t/" + encodeURIComponent(c.code) + ".webp";
export const fullUrl = (c: Card) => IMG + "f/" + encodeURIComponent(c.code) + ".webp";

export const RARITY: Record<string, string> = {
  C: "Common",
  U: "Uncommon",
  R: "Rare",
  SR: "Super Rare",
  SEC: "Secret Rare",
  UR: "Ultra Rare",
  P: "Promo",
};
