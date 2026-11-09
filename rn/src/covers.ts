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
export const HERO_ART: Record<string, { src: number; pos: { left: string; top: string } }> = {
  LM08: { src: require("../assets/hero/LM08.webp"), pos: { left: "50%", top: "50%" } },
  LM09: { src: require("../assets/hero/LM09.webp"), pos: { left: "50%", top: "50%" } },
};
// HORIZON_ART: immagini quadrate di "All'orizzonte" (rn/assets/horizon/CODICE.webp, 600×600), al posto del banner tagliato.
export const HORIZON_ART: Record<string, number> = {
  LM09: require("../assets/horizon/LM09.webp"),
};
