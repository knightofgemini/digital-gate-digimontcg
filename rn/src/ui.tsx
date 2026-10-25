// Piccoli componenti condivisi dalle schermate.
import { ReactNode } from "react";
import { Pressable, StyleSheet, Text, TextStyle, View } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path, Rect, Circle } from "react-native-svg";
import { Card, logoUrl, thumbUrl } from "./data";
import { Theme, useTheme } from "./theme";

// Icone del menu (stessi disegni di src/template.html, IC)
export function Icon({ name, color, size = 24 }: { name: string; color: string; size?: number }) {
  const p = { stroke: color, strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === "home" && <Path {...p} d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />}
      {name === "sets" && (
        <>
          <Rect {...p} x={4} y={4} width={7} height={7} rx={1.5} />
          <Rect {...p} x={13} y={4} width={7} height={7} rx={1.5} />
          <Rect {...p} x={4} y={13} width={7} height={7} rx={1.5} />
          <Rect {...p} x={13} y={13} width={7} height={7} rx={1.5} />
        </>
      )}
      {name === "cards" && (
        <>
          <Circle {...p} cx={11} cy={11} r={7} />
          <Path {...p} d="M20 20l-3.5-3.5" />
        </>
      )}
      {name === "coll" && (
        <>
          <Rect {...p} x={4} y={3} width={12} height={16} rx={2} />
          <Path {...p} d="M8 21h10a2 2 0 0 0 2-2V7" />
        </>
      )}
      {name === "deck" && (
        <>
          <Rect {...p} x={7} y={3} width={13} height={17} rx={2} />
          <Path {...p} d="M4 7v12a2 2 0 0 0 2 2h9" />
          <Path {...p} d="M11 9h5M11 13h5" />
        </>
      )}
      {name === "soon" && (
        <>
          <Circle {...p} cx={12} cy={13} r={8} />
          <Path {...p} d="M12 9v4l2.5 2M9 2h6" />
        </>
      )}
      {name === "info" && (
        <>
          <Circle {...p} cx={12} cy={12} r={9} />
          <Path {...p} d="M12 11v6M12 7.5v.5" />
        </>
      )}
    </Svg>
  );
}

// Testo su una riga che si rimpicciolisce se è lungo (come la classe "fit" del sito)
export function Fit({ style, children }: { style?: TextStyle | TextStyle[]; children: ReactNode }) {
  return (
    <Text style={style} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
      {children}
    </Text>
  );
}

// Barretta dei colori della carta
export function ColorBand({ colors, height = 4 }: { colors: string[]; height?: number }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", height, borderRadius: height, overflow: "hidden", backgroundColor: t.line }}>
      {colors.map((c) => (
        <View key={c} style={{ flex: 1, backgroundColor: t.cards[c] || t.line }} />
      ))}
    </View>
  );
}

export function Tag({ text, bg, ink }: { text: string; bg?: string; ink?: string }) {
  const t = useTheme();
  if (!text) return null;
  return (
    <View style={{ backgroundColor: bg || t.surface2, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginRight: 6, marginBottom: 6 }}>
      <Text style={{ color: ink || t.ink, fontSize: 13, fontWeight: "600" }}>{text}</Text>
    </View>
  );
}

// Miniatura di una carta con codice e nome (griglie)
export function CardCell({ c, width, onPress }: { c: Card; width: number; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable style={{ width, padding: 4 }} onPress={onPress}>
      <Image source={thumbUrl(c)} style={{ width: "100%", aspectRatio: 0.716, borderRadius: 6, backgroundColor: t.surface2 }} contentFit="cover" cachePolicy="disk" transition={120} recyclingKey={c.k} />
      <View style={{ marginTop: 4 }}>
        <ColorBand colors={c.colors} height={3} />
      </View>
      <Text style={{ color: t.ink2, fontSize: 11, marginTop: 3 }} numberOfLines={1}>
        {c.code}
        {c.suf ? " · " + (c.mark === "SP" ? "SP" : c.mark === 2 ? "★★" : c.mark === 1 ? "★" : "Alt") : ""}
      </Text>
      <Text style={{ color: t.ink, fontSize: 12, fontWeight: "600" }} numberOfLines={1}>
        {c.name}
      </Text>
    </Pressable>
  );
}

export function PageTitle({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={{ color: t.ink, fontSize: 26, fontWeight: "800", marginBottom: 12 }}>{children}</Text>;
}

export function SubHead({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={{ color: t.ink2, fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6, marginTop: 18, marginBottom: 8 }}>{children}</Text>;
}

export const common = (t: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    pad: { padding: 16 },
    panel: { backgroundColor: t.surface, borderColor: t.line, borderWidth: 1, borderRadius: 12 },
    search: { backgroundColor: t.surface, borderColor: t.line, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: t.ink, fontSize: 16 },
    muted: { color: t.ink2 },
  });

// Logo del prodotto (prod/logo/ del sito)
export function Logo({ code, big }: { code: string; big?: boolean }) {
  const u = logoUrl(code);
  const st = big ? { width: "100%" as const, height: 54 } : { width: 72, height: 36 };
  if (!u) return big ? <View style={st} /> : null;
  return <Image source={u} style={st} contentFit="contain" contentPosition={big ? "left" : "center"} cachePolicy="disk" />;
}

// Pagina provvisoria per le sezioni non ancora riportate
export function Placeholder({ title, text }: { title: string; text: string }) {
  const t = useTheme();
  const s = common(t);
  return (
    <SafeAreaView style={s.screen} edges={["top"]}>
      <View style={s.pad}>
        <PageTitle>{title}</PageTitle>
        <View style={[s.panel, { padding: 16 }]}>
          <Text style={{ color: t.ink, fontSize: 15, lineHeight: 22 }}>{text}</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
