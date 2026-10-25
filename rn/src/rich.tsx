// Testo delle carte con le icone colorate per [ ], ＜ ＞ e ⟦ ⟧ (stesse regole e colori di rich()/iconClass() del sito)
// e i colori scritti nel testo (Red, Blue...) come tag colorati. Il testo resta sempre in inglese come stampato.
// Toccando una keyword (＜Raid＞, ＜Security A. +1＞...) si apre sotto il testo la spiegazione della regola.
import { useState } from "react";
import { Pressable, Text, TextStyle, View } from "react-native";
import { kwInfo } from "./keywords";
import { useTheme } from "./theme";

const TIMING = /^(On Play|When Digivolving|When Attacking|On Deletion|Your Turn|Opponent's Turn|All Turns|Main|Start of Your Main Phase|Start of Opponent's Main Phase|Start of Your Turn|Start of Opponent's Turn|End of Your Turn|End of Opponent's Turn|End of All Turns|End of Attack|When Linking|When Moving|Counter|Security)$/;
const ZONE = /^(Hand|Trash|Breeding)$/;
const SPECIAL = /^(Digivolve|DNA Digivolve|Burst Digivolve|App Fusion|Fusionize)$/;
const GREEN = /^(DigiXros\s*-\d+|Assembly\s*-\d+|Link|Arts Digivolve)$/;
export const EVOTAG = /^(Digivolve|DNA Digivolve|Burst Digivolve|App Fusion|Fusionize)$/;

// [sfondo, testo]
export const ICO: Record<string, [string, string]> = {
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

export function iconClass(inner: string) {
  inner = inner.replace(/ /g, " ");
  if (/^(Once|Twice) Per Turn$/.test(inner)) return "opt";
  if (TIMING.test(inner)) return "tim";
  if (ZONE.test(inner)) return "zon";
  if (SPECIAL.test(inner)) return "spc";
  if (GREEN.test(inner)) return "grn";
  if (inner === "Rule") return "rul";
  return "trt";
}

// le righe fatte solo di keyword vanno tutte su una riga sola
export function kwJoin(text: string) {
  const out: string[] = [];
  let run: string[] = [];
  String(text)
    .split("\n")
    .forEach((l) => {
      if (/^\s*(＜[^＞]+＞\s*)+$/.test(l)) {
        run.push(l.trim());
        return;
      }
      if (run.length) {
        out.push(run.join(" "));
        run = [];
      }
      out.push(l);
    });
  if (run.length) out.push(run.join(" "));
  return out.join("\n");
}
// la spiegazione tra parentesi dopo ＜Alliance＞ non si mostra: si legge toccandola
export const kwNoRem = (text: string) => String(text).replace(/(＜Alliance＞)[ \t]*\((?:[^()\n]|\([^()\n]*\))*\)/g, "$1");

const COLRE = /(^|[^\w-])(Red|Blue|Yellow|Green|Black|Purple|White)(?![\w-])/g;

function Ico({ text, cls, fs, onPress, open }: { text: string; cls: string; fs: number; onPress?: () => void; open?: boolean }) {
  const [bg, ink] = ICO[cls];
  return (
    <Text onPress={onPress} suppressHighlighting style={{ backgroundColor: bg, color: ink, fontWeight: "700", fontSize: fs * 0.86 }}>
      {" " + text + (onPress ? (open ? " ▴" : " ▾") : "") + " "}
    </Text>
  );
}

export function Rich({ text, style, noKw }: { text: string; style?: TextStyle; noKw?: boolean }) {
  const t = useTheme();
  const [open, setOpen] = useState<string[]>([]);
  const fs = style?.fontSize || 14;
  const parts = String(text).split(/(\[[^\]\n]+\]|＜[^＞\n]+＞|⟦[^⟧\n]+⟧)/);
  const nodes: any[] = [];
  parts.forEach((part, i) => {
    if (!part) return;
    if (!(i % 2)) {
      // colori nel testo libero
      let last = 0,
        m: RegExpExecArray | null;
      COLRE.lastIndex = 0;
      while ((m = COLRE.exec(part))) {
        const st = m.index + m[1].length;
        if (st > last) nodes.push(part.slice(last, st));
        const w = m[2];
        nodes.push(
          <Text key={i + "c" + st} style={{ backgroundColor: t.cards[w], color: w === "White" || w === "Yellow" ? "#111" : "#fff", fontWeight: "700", fontSize: fs * 0.86 }}>
            {" " + w + " "}
          </Text>
        );
        last = st + w.length;
      }
      if (last < part.length) nodes.push(part.slice(last));
      return;
    }
    const inner = part.slice(1, -1).replace(/ /g, " ");
    const cls = part.charAt(0) === "⟦" ? "ovf" : part.charAt(0) === "＜" ? (/^Arts Digivolve/.test(inner) ? "grn" : "kw") : iconClass(inner);
    const can = !noKw && (cls === "kw" || cls === "ovf" || /^(Arts Digivolve|DigiXros\s*-\d+|Assembly\s*-\d+|Link$)/.test(inner)) && !!kwInfo(inner);
    const isOpen = open.indexOf(inner) >= 0;
    nodes.push(<Ico key={i} text={inner} cls={cls} fs={fs} open={isOpen} onPress={can ? () => setOpen(isOpen ? open.filter((x) => x !== inner) : open.concat(inner)) : undefined} />);
  });
  return (
    <View>
      <Text style={style}>{nodes}</Text>
      {open.map((k) => (
        <Pressable key={k} onPress={() => setOpen(open.filter((x) => x !== k))} style={{ marginTop: 8, padding: 10, borderRadius: 8, borderLeftWidth: 3, borderLeftColor: ICO.kw[0], backgroundColor: t.surface2 }}>
          <Text style={{ color: t.ink, fontWeight: "800", marginBottom: 4 }}>{/^-\d+$/.test(k) ? "Overflow " + k : k.length > 24 ? k.replace(/\s*\(.*$/, "") : k}</Text>
          <Rich text={kwInfo(k) || ""} style={{ color: t.ink, fontSize: 13, lineHeight: 19 }} noKw />
        </Pressable>
      ))}
    </View>
  );
}
