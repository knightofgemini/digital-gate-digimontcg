// Aperture di pagine usate da più schermate.
import { router } from "expo-router";
import { Card, spoilerSet } from "./data";

// Prodotto in arrivo: pagina degli spoiler se ci sono carte svelate, altrimenti la sola scheda
export function openUpcoming(code: string) {
  const sp = spoilerSet(code);
  router.push({ pathname: "/prodotto/[id]", params: { id: sp ? sp.id : "up-" + code } });
}
export function openSet(id: string) {
  router.push({ pathname: "/prodotto/[id]", params: { id } });
}
export function openCard(c: Card) {
  router.push({ pathname: "/carta/[k]", params: { k: c.k } });
}
