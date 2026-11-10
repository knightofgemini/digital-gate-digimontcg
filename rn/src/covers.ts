// Immagini scelte dall'utente per singole sezioni della Home (9 novembre 2026), dentro l'APK.
// COVERS: copertine verticali dei riquadri formato carta di "Set da completare" (rn/assets/covers/CODICE.webp, circa
// 300 px di larghezza): hanno la precedenza sul banner tagliato.
// HERO_ART: illustrazioni del riquadro grande "In evidenza" (rn/assets/hero/CODICE.webp, circa 1100 px), solo lì: nelle
// altre sezioni resta il banner del prodotto. `pos` = punto da inquadrare (come contentPosition di expo-image).
// Le immagini sono già ritagliate con l'inquadratura scelta (vedi "Modello per i banner" in CLAUDE.md).
export const COVERS: Record<string, number> = {
  BT25: require("../assets/covers/BT25.webp"),
  LM06: require("../assets/covers/LM06.webp"),
  LM07: require("../assets/covers/LM07.webp"),
  LM09: require("../assets/covers/LM09.webp"),
};
// `by`: posizione propria per una larghezza di telefono (catena sganciata nella pagina "Tagli della Home"), chiave
// s/m/l/f come i telefoni della pagina (360/411/448/600 dp): si usa al posto di `src` su quella larghezza (heroPhone).
export type HeroArt = { src: number; pos: { left: string; top: string }; by?: Partial<Record<"s" | "m" | "l" | "f", number>> };
export const HERO_ART: Record<string, HeroArt> = {
  LM08: { src: require("../assets/hero/LM08.webp"), pos: { left: "50%", top: "50%" } },
  LM09: { src: require("../assets/hero/LM09.webp"), pos: { left: "50%", top: "50%" } },
};
// HORIZON_ART: immagini quadrate di "All'orizzonte" (rn/assets/horizon/CODICE.webp, 600×600), al posto del banner tagliato.
export const HORIZON_ART: Record<string, number> = {
  LM09: require("../assets/horizon/LM09.webp"),
};

// telefono della pagina "Tagli della Home" più vicino alla larghezza dello schermo (dp)
export function heroPhone(width: number): "s" | "m" | "l" | "f" {
  return width < 385 ? "s" : width < 430 ? "m" : width < 524 ? "l" : "f";
}
export function heroSrc(art: HeroArt, width: number): number {
  return (art.by && art.by[heroPhone(width)]) || art.src;
}
