// Testo con i caratteri dell'app attuale: IBM Plex Sans per i testi, Chakra Petch per titoli e numeri
// (nel sito: --font-body e --font-display). Con i caratteri caricati da file ogni spessore è un carattere a sé,
// quindi fontWeight viene trasformato nel nome giusto. fontFamily: DISPLAY sceglie Chakra Petch.
import { forwardRef } from "react";
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

function face(style: any): TextStyle | null {
  const s: TextStyle = StyleSheet.flatten(style) || {};
  const disp = s.fontFamily === DISPLAY;
  if (s.fontFamily && !disp) return null;
  const w = s.fontWeight === "bold" ? 700 : parseInt(String(s.fontWeight || "400"), 10) || 400;
  const it = s.fontStyle === "italic";
  let f: string;
  if (disp) f = w >= 700 ? (it ? "ChakraPetch_700Bold_Italic" : "ChakraPetch_700Bold") : w >= 600 ? "ChakraPetch_600SemiBold" : "ChakraPetch_500Medium";
  else f = w >= 600 ? "IBMPlexSans_600SemiBold" : w >= 500 ? "IBMPlexSans_500Medium" : it ? "IBMPlexSans_400Regular_Italic" : "IBMPlexSans_400Regular";
  return { fontFamily: f, fontWeight: "normal", fontStyle: f.endsWith("Italic") ? "normal" : s.fontStyle };
}

export const Text = forwardRef<any, TextProps>(function Text(props, ref) {
  const f = face(props.style);
  return <RNText ref={ref} {...props} style={f ? [props.style, f] : props.style} />;
});

export const TextInput = forwardRef<any, TextInputProps>(function TextInput(props, ref) {
  const f = face(props.style);
  return <RNTextInput ref={ref} {...props} style={f ? [props.style, f] : props.style} />;
});
