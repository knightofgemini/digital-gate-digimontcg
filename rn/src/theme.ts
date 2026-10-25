// Colori presi da src/template.html (variabili CSS del tema chiaro e scuro).
import { useColorScheme } from "react-native";

const light = {
  bg: "#f1f4f9",
  surface: "#ffffff",
  surface2: "#e7ecf4",
  line: "#d3dbe8",
  ink: "#0f1a2e",
  ink2: "#51607a",
  accent: "#e0531a",
  accentInk: "#ffffff",
  cards: { Red: "#d6403a", Blue: "#2f6fe0", Yellow: "#e2b21a", Green: "#2e9e57", Black: "#2a2d36", Purple: "#8a4fd0", White: "#c4cad6" } as Record<string, string>,
};

const dark: typeof light = {
  bg: "#0b1120",
  surface: "#131b2e",
  surface2: "#1c2640",
  line: "#26324f",
  ink: "#e8edf7",
  ink2: "#93a1bd",
  accent: "#ff7a3d",
  accentInk: "#1a0b03",
  cards: { Red: "#ef5b55", Blue: "#5b92f5", Yellow: "#f0c43a", Green: "#46bd73", Black: "#6b7388", Purple: "#a878e8", White: "#e3e7ef" },
};

export type Theme = typeof light;
export function useTheme(): Theme {
  return useColorScheme() === "dark" ? dark : light;
}
