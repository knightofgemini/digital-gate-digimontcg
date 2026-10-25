// Testo delle carte con le icone colorate per [ ], ＜ ＞ e ⟦ ⟧ (stesse regole e colori di rich()/iconClass() del sito).
// Il testo resta sempre in inglese come stampato.
import { Text, TextStyle } from "react-native";

const TIMING = /^(On Play|When Digivolving|When Attacking|On Deletion|Your Turn|Opponent's Turn|All Turns|Main|Start of Your Main Phase|Start of Opponent's Main Phase|Start of Your Turn|Start of Opponent's Turn|End of Your Turn|End of Opponent's Turn|End of All Turns|End of Attack|When Linking|When Moving|Counter|Security)$/;
const ZONE = /^(Hand|Trash|Breeding)$/;
const SPECIAL = /^(Digivolve|DNA Digivolve|Burst Digivolve|App Fusion|Fusionize)$/;
const GREEN = /^(DigiXros\s*-\d+|Assembly\s*-\d+|Link|Arts Digivolve)$/;

// [sfondo, testo]
const ICO: Record<string, [string, string]> = {
  tim: ["#23409a", "#fff"], // timing blu (anche Security)
  zon: ["#7e1e6c", "#fff"], // Trash/Hand/Breeding viola
  opt: ["#c00d13", "#fff"], // Once/Twice Per Turn rosso
  spc: ["#235079", "#fff"], // Digivolve/DNA/Burst/App Fusion blu-petrolio
  grn: ["#0f9682", "#fff"], // DigiXros/Assembly/Link verdi
  rul: ["#e4e4e4", "#111"], // Rule grigio chiaro
  trt: ["#ffffff", "#000"], // trait bianchi con testo nero
  kw: ["#c25417", "#fff"], // keyword arancioni
  ovf: ["#b9c0c8", "#1a1d22"], // Overflow grigio metallizzato
};

function iconClass(inner: string) {
  if (/^(Once|Twice) Per Turn$/.test(inner)) return "opt";
  if (TIMING.test(inner)) return "tim";
  if (ZONE.test(inner)) return "zon";
  if (SPECIAL.test(inner)) return "spc";
  if (GREEN.test(inner)) return "grn";
  if (inner === "Rule") return "rul";
  return "trt";
}

export function Rich({ text, style }: { text: string; style?: TextStyle }) {
  const parts = String(text).split(/(\[[^\]\n]+\]|＜[^＞\n]+＞|⟦[^⟧\n]+⟧)/);
  return (
    <Text style={style}>
      {parts.map((part, i) => {
        if (!part) return null;
        if (!(i % 2)) return part;
        const inner = part.slice(1, -1).replace(/ /g, " ");
        const cls = part.charAt(0) === "⟦" ? "ovf" : part.charAt(0) === "＜" ? (/^Arts Digivolve/.test(inner) ? "grn" : "kw") : iconClass(inner);
        const [bg, ink] = ICO[cls];
        return (
          <Text key={i} style={{ backgroundColor: bg, color: ink, fontWeight: "700", fontSize: (style?.fontSize || 14) * 0.86 }}>
            {" " + inner + " "}
          </Text>
        );
      })}
    </Text>
  );
}
