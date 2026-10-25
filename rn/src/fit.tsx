// Nomi lunghi su una riga (come fitOne/fitTwo dell'app attuale): il testo si rimpicciolisce fino a minSize per stare
// su una riga; se non basta va su due righe, rimpicciolito quanto serve. La larghezza del testo è stimata con le
// proporzioni medie delle lettere (uguale su telefono e sul web, dove la misura del testo non è disponibile).
import { useState } from "react";
import { TextStyle, View, ViewStyle } from "react-native";
import { DISPLAY, Text } from "./Text";

function em(ch: string) {
  if (ch === " ") return 0.26;
  if (/[iIl.,:;'!|]/.test(ch)) return 0.27;
  if (/[fjrt()\-/]/.test(ch)) return 0.36;
  if (/[mwMW]/.test(ch)) return 0.82;
  if (/[A-Z]/.test(ch)) return 0.64;
  if (/[0-9]/.test(ch)) return 0.57;
  return 0.53;
}
export function textEm(s: string, display?: boolean) {
  let w = 0;
  for (const ch of s) w += em(ch);
  return w * (display ? 0.93 : 1);
}

// ace: simbolo "ACE" dopo il nome (Digimon ACE; non fa parte del nome)
export function FitText({ text, size, minSize = 11, style, boxStyle, lines = 2, display, ace }: { text: string; size: number; minSize?: number; style?: TextStyle; boxStyle?: ViewStyle; lines?: number; display?: boolean; ace?: boolean }) {
  const [w, setW] = useState(0);
  let fs = size,
    n = 1;
  if (w) {
    const need = (textEm(text, display) + (ace ? 2.1 : 0)) * size;
    if (need > w) {
      fs = (size * w) / need;
      if (fs < minSize) {
        // non ci sta su una riga neanche rimpicciolito: due righe, rimpicciolito solo quanto serve
        n = lines;
        fs = Math.max(minSize, Math.min(size, (size * w * lines * 0.9) / need));
      }
    }
  }
  return (
    <View style={[{ minWidth: 0 }, boxStyle]} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      <Text style={[style, { fontSize: fs, lineHeight: Math.round(fs * 1.25) }]} numberOfLines={w ? n : lines}>
        {text.replace(/\//g, "/​")}
        {ace ? (
          <Text style={{ fontFamily: DISPLAY, fontWeight: "700", fontStyle: "italic", fontSize: fs * 0.74, color: "#fff", backgroundColor: "#e0401f", letterSpacing: 0.3 }}>{" ACE "}</Text>
        ) : null}
      </Text>
    </View>
  );
}
