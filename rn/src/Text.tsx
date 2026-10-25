// Testo con i caratteri dell'app attuale: IBM Plex Sans per i testi, Chakra Petch per titoli e numeri
// (nel sito: --font-body e --font-display). Con i caratteri caricati da file ogni spessore è un carattere a sé,
// quindi fontWeight viene trasformato nel nome giusto. fontFamily: DISPLAY sceglie Chakra Petch.
// Come nel sito (body: 15px, interlinea 1.45) i testi normali hanno 15 px e interlinea 1,45 se non indicati;
// i titoli in Chakra Petch (nel sito con "font:" abbreviato) hanno l'interlinea normale.
// Un testo dentro un altro eredita grandezza e carattere: cambia solo ciò che indica.
import { createContext, forwardRef, useContext } from "react";
import { StyleSheet, Text as RNText, TextInput as RNTextInput, TextProps, TextInputProps, TextStyle } from "react-native";
import { ChakraPetch_500Medium, ChakraPetch_600SemiBold, ChakraPetch_700Bold, ChakraPetch_700Bold_Italic } from "@expo-google-fonts/chakra-petch";
import { IBMPlexSans_400Regular, IBMPlexSans_400Regular_Italic, IBMPlexSans_500Medium, IBMPlexSans_600SemiBold } from "@expo-google-fonts/ibm-plex-sans";

export const DISPLAY = "display";
export const FONTS = {
  ChakraPetch_500Medium,
  ChakraPetch_600SemiBold,
  ChakraPetch_700Bold,
  ChakraPetch_700Bold_Italic,
  IBMPlexSans_400Regular,
  IBMPlexSans_400Regular_Italic,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
};

type Ctx = { disp: boolean; w: number; it: boolean } | null;
const Parent = createContext<Ctx>(null);

function famOf(disp: boolean, w: number, it: boolean) {
  if (disp) return w >= 700 ? (it ? "ChakraPetch_700Bold_Italic" : "ChakraPetch_700Bold") : w >= 600 ? "ChakraPetch_600SemiBold" : "ChakraPetch_500Medium";
  return w >= 600 ? "IBMPlexSans_600SemiBold" : w >= 500 ? "IBMPlexSans_500Medium" : it ? "IBMPlexSans_400Regular_Italic" : "IBMPlexSans_400Regular";
}

function resolve(style: any, parent: Ctx, input?: boolean): [TextStyle | null, Ctx] {
  const s: TextStyle = StyleSheet.flatten(style) || {};
  if (s.fontFamily && s.fontFamily !== DISPLAY) return [null, parent];
  const disp = s.fontFamily === DISPLAY ? true : parent ? parent.disp : false;
  const w = s.fontWeight != null ? (s.fontWeight === "bold" ? 700 : parseInt(String(s.fontWeight), 10) || 400) : parent ? parent.w : 400;
  const it = s.fontStyle != null ? s.fontStyle === "italic" : parent ? parent.it : false;
  const me = { disp, w, it };
  // dentro un altro testo: niente da cambiare se non indica carattere, spessore o corsivo
  if (parent && !input && s.fontFamily == null && s.fontWeight == null && s.fontStyle == null) return [null, me];
  const f = famOf(disp, w, it);
  const out: TextStyle = { fontFamily: f, fontWeight: "normal", fontStyle: f.endsWith("Italic") ? "normal" : s.fontStyle };
  if (!parent && !input) {
    const fs = s.fontSize ?? 15;
    if (s.fontSize == null) out.fontSize = 15;
    if (s.lineHeight == null && !disp) out.lineHeight = Math.round(fs * 1.45);
  }
  return [out, me];
}

export const Text = forwardRef<any, TextProps>(function Text(props, ref) {
  const parent = useContext(Parent);
  const [f, me] = resolve(props.style, parent);
  return (
    <Parent.Provider value={me}>
      <RNText ref={ref} {...props} style={f ? [props.style, f] : props.style} />
    </Parent.Provider>
  );
});

export const TextInput = forwardRef<any, TextInputProps>(function TextInput(props, ref) {
  const [f] = resolve(props.style, null, true);
  return <RNTextInput ref={ref} {...props} style={f ? [props.style, f] : props.style} />;
});
