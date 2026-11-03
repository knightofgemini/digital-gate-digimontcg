// Colori presi da src/template.html (variabili CSS del tema chiaro e scuro).
// Tema: segue il telefono finché l'utente non sceglie chiaro/scuro dal menu "Altro" (salvato in "dg-theme", come nel sito).
import { useSyncExternalStore } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const light = {
  dark: false,
  bg: "#f1f4f9",
  surface: "#ffffff",
  surface2: "#e7ecf4",
  line: "#d3dbe8",
  ink: "#0f1a2e",
  ink2: "#51607a",
  accent: "#e0531a",
  accentInk: "#ffffff",
  accentSoft: "rgba(224,83,26,.13)",
  blue: "#1f4fd8",
  ok: "#17803d",
  cyan: "#0c7084",
  cyanSoft: "#e3f3f6",
  scrim: "rgba(10,16,30,.55)",
  cards: { Red: "#d6403a", Blue: "#2f6fe0", Yellow: "#e2b21a", Green: "#2e9e57", Black: "#2a2d36", Purple: "#8a4fd0", White: "#c4cad6" } as Record<string, string>,
};

const dark: typeof light = {
  dark: true,
  bg: "#0b1120",
  surface: "#131b2e",
  surface2: "#1c2640",
  line: "#26324f",
  ink: "#e8edf7",
  ink2: "#93a1bd",
  accent: "#ff7a3d",
  accentInk: "#1a0b03",
  accentSoft: "rgba(255,122,61,.13)",
  blue: "#7fa2ff",
  ok: "#4ade80",
  cyan: "#63d5ee",
  cyanSoft: "#12303a",
  scrim: "rgba(0,0,0,.65)",
  cards: { Red: "#ef5b55", Blue: "#5b92f5", Yellow: "#f0c43a", Green: "#46bd73", Black: "#6b7388", Purple: "#a878e8", White: "#e3e7ef" },
};

export type Theme = typeof light;

let PREF: "" | "light" | "dark" = "";
const subs = new Set<() => void>();
export async function loadThemePref() {
  try {
    const v = await AsyncStorage.getItem("dg-theme");
    if (v === "light" || v === "dark") PREF = v;
  } catch {}
}
export function setThemePref(v: "light" | "dark") {
  PREF = v;
  AsyncStorage.setItem("dg-theme", v).catch(() => {});
  subs.forEach((f) => f());
}
const sub = (f: () => void) => (subs.add(f), () => subs.delete(f));

export function useTheme(): Theme {
  const sys = useColorScheme();
  const pref = useSyncExternalStore(sub, () => PREF, () => PREF);
  return (pref || sys) === "dark" ? dark : light;
}
