// Aperture di pagine usate da più schermate.
import { router } from "expo-router";
import { Card, spoilerSet } from "./data";

// elenco da cui è stata aperta la scheda carta: con il dito a destra/sinistra si passa alla precedente/successiva
export let NAVLIST: Card[] = [];

// Prodotto in arrivo: pagina degli spoiler se ci sono carte svelate, altrimenti la sola scheda
export function openUpcoming(code: string) {
  const sp = spoilerSet(code);
  router.push({ pathname: "/prodotto/[id]", params: { id: sp ? sp.id : "up-" + code } });
}
export function openSet(id: string) {
  router.push({ pathname: "/prodotto/[id]", params: { id } });
}
// deck: scheda aperta dall'editor di un mazzo (mostra anche le copie nel mazzo)
export function openCard(c: Card, list?: Card[], deck?: string) {
  NAVLIST = list && list.indexOf(c) >= 0 ? list : [c];
  router.push({ pathname: "/carta/[k]", params: deck ? { k: c.k, deck } : { k: c.k } });
}
export function openDeck(id: string) {
  router.push({ pathname: "/mazzo/[id]", params: { id } });
}
