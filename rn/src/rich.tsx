// Testo delle carte con le icone colorate per [ ], ＜ ＞ e ⟦ ⟧ (stesse regole e colori di rich()/iconClass() del sito)
// e i colori scritti nel testo (Red, Blue...) come tag colorati. Il testo resta sempre in inglese come stampato.
// Toccando una keyword (＜Raid＞, ＜Security A. +1＞...) si apre sotto il testo la spiegazione della regola.
import { useState } from "react";
import { Pressable, StyleSheet, TextStyle, View } from "react-native";
import Svg, { Defs, LinearGradient, Polygon, Rect, Stop } from "react-native-svg";
import { DISPLAY, Text } from "./Text";
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

// come .ico.<classe> del sito: sfumatura dall'alto in basso [stop] e bordino interno (box-shadow inset 1px)
const GRAD: Record<string, { s: [number, string][]; b?: string }> = {
  tim: { s: [[0, "#2c4fb4"], [1, "#1b2a72"]], b: "#5d7fd6" },
  zon: { s: [[0, "#9c2c86"], [1, "#5f0f52"]], b: "#c25aab" },
  opt: { s: [[0, "#d8161c"], [1, "#9a0006"]], b: "#f0585c" },
  spc: { s: [[0, "#2d6694"], [1, "#173a57"]], b: "#5f93bd" },
  grn: { s: [[0, "#14ad96"], [1, "#0a7a6a"]] },
  kw: { s: [[0, "#d8661f"], [1, "#a2400c"]] },
  ovf: { s: [[0, "#f4f6f8"], [0.45, "#b9c0c8"], [0.55, "#8a939d"], [1, "#d5dade"]], b: "#6f7882" },
};
// spostamento verticale del riquadro rispetto alla riga (in em del riquadro): come vertical-align .08em del sito
export const ICO_DY = 0.3;

// Riquadro di un'icona dentro il testo (.ico del sito): angoli .35em, margini .1em, testo Chakra Petch 700 a .78em.
// cls = classe (tim, kw, ovf...) oppure "col" con bg/ink dati (colori, tag del tipo); kw = esagono arancione.
export function Chip({ text, cls, fs, bg, ink, line, onPress, open, maxW, dy }: { text: string; cls: string; fs: number; bg?: string; ink?: string; line?: string; onPress?: () => void; open?: boolean; maxW?: number; dy?: number }) {
  const fc = fs * 0.78;
  const hex = cls === "kw";
  const g = GRAD[cls];
  const fill = bg || (ICO[cls] ? ICO[cls][0] : "#888");
  const color = ink || (ICO[cls] ? ICO[cls][1] : "#fff");
  const id = "ico" + cls;
  const r = fc * 0.35;
  const body = (
    <Text style={{ color, fontFamily: DISPLAY, fontWeight: "700", fontSize: fc, lineHeight: fc * 1.25, paddingVertical: fc * 0.08, paddingHorizontal: fc * (hex ? 0.75 : 0.5), textAlign: "center" }}>
      {text}
      {open ? <Text style={{ fontSize: fc * 0.85 }}>{" \u25BE"}</Text> : null}
    </Text>
  );
  const st: any = { marginHorizontal: fc * 0.1, transform: [{ translateY: (dy == null ? ICO_DY : dy) * fc }], maxWidth: maxW };
  // esagono in tre pezzi (punta sinistra, centro, punta destra) che si allungano da soli con il riquadro
  const grad = (
    <Defs>
      <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        {g ? g.s.map(([o, c]) => <Stop key={o} offset={o} stopColor={c} />) : null}
      </LinearGradient>
    </Defs>
  );
  const tip = fc * 0.45;
  const bgEl = hex ? (
    <View style={[StyleSheet.absoluteFill, { flexDirection: "row" }]} pointerEvents="none">
      <Svg width={tip} height="100%" viewBox="0 0 1 1" preserveAspectRatio="none">
        {grad}
        <Polygon points="1,0 0,0.5 1,1" fill={"url(#" + id + ")"} />
      </Svg>
      <Svg style={{ flex: 1, marginHorizontal: -0.5 }} height="100%" viewBox="0 0 1 1" preserveAspectRatio="none">
        {grad}
        <Rect x="0" y="0" width="1" height="1" fill={"url(#" + id + ")"} />
      </Svg>
      <Svg width={tip} height="100%" viewBox="0 0 1 1" preserveAspectRatio="none">
        {grad}
        <Polygon points="0,0 1,0.5 0,1" fill={"url(#" + id + ")"} />
      </Svg>
    </View>
  ) : g ? (
    <View style={[StyleSheet.absoluteFill, { borderRadius: r, overflow: "hidden" }]} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            {g.s.map(([o, c]) => <Stop key={o} offset={o} stopColor={c} />)}
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={"url(#" + id + ")"} />
      </Svg>
      {g.b ? <View style={[StyleSheet.absoluteFill, { borderRadius: r, borderWidth: 1, borderColor: g.b }]} /> : null}
    </View>
  ) : (
    <View style={[StyleSheet.absoluteFill, { borderRadius: r, backgroundColor: fill, borderWidth: line ? 1 : 0, borderColor: line }]} pointerEvents="none" />
  );
  return onPress ? (
    <Pressable onPress={onPress} style={st} hitSlop={4}>
      {bgEl}
      {body}
    </Pressable>
  ) : (
    <View style={st}>
      {bgEl}
      {body}
    </View>
  );
}

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

// riquadri verdi (DigiXros, Assembly, Link, Arts Digivolve)
const GKW = /^(Arts Digivolve|DigiXros\s*-\d+|Assembly\s*-\d+|Link)$/;
const COLRE = /(^|[^\w-])(Red|Blue|Yellow|Green|Black|Purple|White)(?![\w-])/g;

export function Rich({ text, style, noKw }: { text: string; style?: TextStyle; noKw?: boolean }) {
  const t = useTheme();
  const [open, setOpen] = useState<string[]>([]);
  const [w, setW] = useState(0);
  const fs = style?.fontSize || 14;
  const maxW = w ? w - fs * 0.2 : undefined;
  // nella spiegazione di una keyword i tag bianchi hanno il bordino (.kwexb .ico.trt)
  const edge = noKw ? t.line : undefined;
  // una riga alla volta: la spiegazione di una keyword si apre subito dopo la sua riga (più spiegazioni nell'ordine delle keyword)
  const lines = String(text).split("\n");
  const out: any[] = [];
  lines.forEach((ln, li) => {
    const parts = ln.split(/(\[[^\]\n]+\]|＜[^＞\n]+＞|⟦[^⟧\n]+⟧)/);
    const nodes: any[] = [];
    const here: string[] = [];
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
          const wd = m[2];
          nodes.push(<Chip key={i + "c" + st} text={wd} cls="col" fs={fs} bg={t.cards[wd]} ink={wd === "White" ? "#111" : "#fff"} line={wd === "White" ? edge : undefined} />);
          last = st + wd.length;
        }
        if (last < part.length) nodes.push(part.slice(last));
        return;
      }
      const inner = part.slice(1, -1).replace(/\u00a0/g, " ");
      const cls = part.charAt(0) === "⟦" ? "ovf" : part.charAt(0) === "＜" ? (/^Arts Digivolve/.test(inner) ? "grn" : "kw") : iconClass(inner);
      const can = !noKw && (cls === "kw" || cls === "ovf" || /^(Arts Digivolve|DigiXros\s*-\d+|Assembly\s*-\d+|Link$)/.test(inner)) && !!kwInfo(inner);
      const key = li + "|" + i + "|" + inner;
      const isOpen = open.indexOf(key) >= 0;
      if (isOpen) here.push(key);
      nodes.push(<Chip key={i} text={inner} cls={cls} fs={fs} maxW={maxW} line={cls === "trt" ? edge : undefined} open={isOpen} onPress={can ? () => setOpen(isOpen ? open.filter((x) => x !== key) : open.concat(key)) : undefined} />);
    });
    out.push(
      <Text key={"l" + li} style={style}>
        {nodes.length ? nodes : " "}
      </Text>
    );
    here.forEach((key) => {
      const k = key.split("|").slice(2).join("|");
      out.push(
        <Pressable key={key} onPress={() => setOpen(open.filter((x) => x !== key))} style={{ marginTop: 6, marginBottom: 8, paddingTop: 8, paddingHorizontal: 11, paddingBottom: 9, borderRadius: 10, borderLeftWidth: 3, borderLeftColor: GKW.test(k) ? "#0a7a6a" : "#d8661f", backgroundColor: t.surface2 }}>
          <Text style={{ color: GKW.test(k) ? "#0f9a85" : t.accent, fontFamily: DISPLAY, fontWeight: "700", fontSize: 12.2, letterSpacing: 0.25, marginBottom: 2 }}>{/^-\d+$/.test(k) ? "Overflow " + k : k.length > 24 ? k.replace(/\s*\(.*$/, "") : k}</Text>
          <Rich text={kwInfo(k) || ""} style={{ color: t.ink, fontSize: 14.4, lineHeight: 21.6 }} noKw />
        </Pressable>
      );
    });
  });
  return <View onLayout={(e) => setW(e.nativeEvent.layout.width)}>{out}</View>;
}

// solo le parti (testo + icone) senza riquadri delle spiegazioni: per misurare quanto è larga una riga
export function RichInline({ text, fs }: { text: string; fs: number }) {
  const t = useTheme();
  const out: any[] = [];
  String(text)
    .split(/(\[[^\]\n]+\]|＜[^＞\n]+＞|⟦[^⟧\n]+⟧)/)
    .forEach((part, i) => {
      if (!part) return;
      if (!(i % 2)) {
        let last = 0,
          m: RegExpExecArray | null;
        COLRE.lastIndex = 0;
        while ((m = COLRE.exec(part))) {
          const st = m.index + m[1].length;
          if (st > last) out.push(part.slice(last, st));
          out.push(<Chip key={i + "c" + st} text={m[2]} cls="col" fs={fs} bg={t.cards[m[2]]} />);
          last = st + m[2].length;
        }
        if (last < part.length) out.push(part.slice(last));
        return;
      }
      const inner = part.slice(1, -1).replace(/\u00a0/g, " ");
      const cls = part.charAt(0) === "⟦" ? "ovf" : part.charAt(0) === "＜" ? (/^Arts Digivolve/.test(inner) ? "grn" : "kw") : iconClass(inner);
      out.push(<Chip key={i} text={inner} cls={cls} fs={fs} />);
    });
  return <>{out}</>;
}
