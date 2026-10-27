// Elementi grafici dell'app attuale usati in più pagine: banner dei prodotti (.bn), riquadro del prodotto (.pv),
// etichette sul banner (.badge), barre di avanzamento (.progress, .pg2/.hpg), pulsanti (.btn), titoletti (.sec-h), riquadri (.panel).
import { ReactNode, useState } from "react";
import { Pressable, View, ViewStyle } from "react-native";
import { Image } from "expo-image";
import Svg, { Circle, Defs, Path, RadialGradient, LinearGradient, Rect, Stop } from "react-native-svg";
import { DISPLAY, Text } from "./Text";
import { PRODUCTS, SITE, bannerUrl, logoUrl, packUrl } from "./data";
import { useTheme } from "./theme";

const stroke = (color: string, w = 2) => ({ stroke: color, strokeWidth: w, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" });
export const Clock = ({ color, size = 10 }: { color: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Circle {...stroke(color, 2.2)} cx={12} cy={13} r={8} />
    <Path {...stroke(color, 2.2)} d="M12 9v4l2.5 2M9 2h6" />
  </Svg>
);
export const Spark = ({ color, size = 10 }: { color: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path {...stroke(color)} d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
    <Path {...stroke(color)} d="M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" />
  </Svg>
);
export const ICO_ARROW = "M5 12h14M13 6l6 6-6 6";
export const ICO_PLUS = "M12 5v14M5 12h14";

// etichetta sul banner (.badge, .badge.new)
export function Badge({ icon, text, isNew, small }: { icon: "clock" | "spark"; text: string; isNew?: boolean; small?: boolean }) {
  return (
    <View style={{ position: "absolute", top: small ? 5 : 8, left: small ? 5 : 8, flexDirection: "row", alignItems: "center", gap: 3, paddingVertical: small ? 2 : 3, paddingLeft: small ? 4 : 5, paddingRight: small ? 5 : 6, borderRadius: 6, backgroundColor: isNew ? "rgba(88,40,140,.9)" : "rgba(11,17,32,.82)", boxShadow: "0 0 0 1px rgba(255,255,255,.12)" }}>
      {icon === "clock" ? <Clock color="#e8edf7" size={small ? 8 : 10} /> : <Spark color="#e8edf7" size={small ? 8 : 10} />}
      <Text style={{ color: "#e8edf7", fontFamily: DISPLAY, fontWeight: "700", fontSize: small ? 8.3 : 9.6, lineHeight: small ? 9 : 10, letterSpacing: 0.5, textTransform: "uppercase" }}>{text}</Text>
    </View>
  );
}

// sfondo con sfumatura disegnata (i gradienti CSS non esistono in React Native)
function Glow({ id, kind }: { id: string; kind: "bn" | "pv" }) {
  return (
    <Svg style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100">
      <Defs>
        {kind === "bn" ? (
          <>
            <LinearGradient id={id + "l"} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#1c2a52" />
              <Stop offset="1" stopColor="#0b1120" />
            </LinearGradient>
            <RadialGradient id={id + "r"} cx="30" cy="20" rx="72" ry="54" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor="#ff7a3d" stopOpacity={0.33} />
              <Stop offset="1" stopColor="#ff7a3d" stopOpacity={0} />
            </RadialGradient>
          </>
        ) : (
          <RadialGradient id={id + "r"} cx="30" cy="15" rx="77" ry="63" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#26365a" />
            <Stop offset="1" stopColor="#0e1628" />
          </RadialGradient>
        )}
      </Defs>
      {kind === "bn" && <Rect width="100" height="100" fill={`url(#${id}l)`} />}
      <Rect width="100" height="100" fill={`url(#${id}r)`} />
    </Svg>
  );
}

// banner del prodotto (.bn): illustrazione, altrimenti codice e nome su sfondo sfumato
export function Banner({ code, name, ratio = 16 / 9, radius = 12, ring = true, children, onPress }: { code: string; name?: string; ratio?: number; radius?: number; ring?: boolean; children?: ReactNode; onPress?: () => void }) {
  const t = useTheme();
  const u = bannerUrl(code);
  return (
    <Pressable onPress={onPress} accessibilityLabel={code + (name ? " " + name : "")} style={{ width: "100%", aspectRatio: ratio, borderRadius: radius, overflow: "hidden", backgroundColor: t.surface2, boxShadow: ring ? `0 0 0 1px ${t.line}` : undefined }}>
      {u ? (
        <Image source={u} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" contentPosition={{ left: "50%", top: "40%" }} cachePolicy="disk" transition={120} />
      ) : (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 12 }}>
          <Glow id={"bn" + code} kind="bn" />
          <Text style={{ color: "#fff", fontFamily: DISPLAY, fontWeight: "700", fontStyle: "italic", fontSize: 33.6, letterSpacing: 1.3 }}>{code}</Text>
          {name ? <Text style={{ color: "#fff", opacity: 0.85, fontFamily: DISPLAY, fontSize: 12.8, textAlign: "center" }}>{name}</Text> : null}
        </View>
      )}
      {children}
    </Pressable>
  );
}

// riquadro del prodotto (.pv): banner, altrimenti logo, confezione o codice
export function ProdVisual({ code, radius = 0, codeSize = 32, children }: { code: string; radius?: number; codeSize?: number; children?: ReactNode }) {
  const p = PRODUCTS[code];
  const b = bannerUrl(code);
  // dalle funzioni dei dati: così valgono le immagini salvate (Immagini offline) e le versioni aggiornate
  const lg = !b ? logoUrl(code) : null;
  const pk = !b && !lg ? packUrl(code) : null;
  return (
    // con l'illustrazione lo sfondo sfumato (disegnato) resterebbe coperto: un colore pieno basta ed è molto più leggero
    <View style={{ width: "100%", aspectRatio: 16 / 9, borderRadius: radius, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: b ? "#1a2540" : undefined }}>
      {b ? null : <Glow id={"pv" + code} kind="pv" />}
      {b ? (
        <Image source={b} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" contentPosition={{ left: "50%", top: "40%" }} cachePolicy="disk" transition={120} />
      ) : lg ? (
        <Image source={lg} style={{ width: "80%", height: "64%" }} contentFit="contain" cachePolicy="disk" />
      ) : pk ? (
        <Image source={pk} style={{ width: "100%", height: "86%" }} contentFit="contain" cachePolicy="disk" />
      ) : (
        <Text style={{ color: "#c7d2e8", fontFamily: DISPLAY, fontWeight: "700", fontStyle: "italic", fontSize: codeSize, letterSpacing: 1.2 }}>{code}</Text>
      )}
      {children}
    </View>
  );
}

// barra di avanzamento (.progress)
export function Progress({ h, n, height = 4, color, style }: { h: number; n: number; height?: number; color?: string; style?: ViewStyle }) {
  const t = useTheme();
  return (
    <View style={[{ height, backgroundColor: t.surface2, borderRadius: height / 2, overflow: "hidden" }, style]}>
      <View style={{ height: "100%", width: `${n ? Math.min(100, (h / n) * 100) : 0}%`, backgroundColor: color || t.accent }} />
    </View>
  );
}
// barra con il conteggio accanto (.pg2, .hpg); completata = verde
export function ProgLine({ h, n, size = 11.8, style }: { h: number; n: number; size?: number; style?: ViewStyle }) {
  const t = useTheme();
  const done = !!n && h === n;
  return (
    <View style={[{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }, style]}>
      <Progress h={h} n={n} color={done ? t.ok : undefined} style={{ flex: 1 }} />
      <Text style={{ color: done ? t.ok : t.ink2, fontFamily: DISPLAY, fontWeight: "600", fontSize: size, fontVariant: ["tabular-nums"] }}>{n ? h + "/" + n : "—"}</Text>
    </View>
  );
}

// pulsante (.btn, .btn.pri)
export function Btn({ label, pri, icon, onPress, style, height = 42, fs = 14.1 }: { label: string; pri?: boolean; icon?: string; onPress: () => void; style?: ViewStyle; height?: number; fs?: number }) {
  const t = useTheme();
  const ink = pri ? t.accentInk : t.ink;
  return (
    <Pressable onPress={onPress} style={[{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: pri ? t.accent : t.line, backgroundColor: pri ? t.accent : t.surface }, style]}>
      {icon ? (
        <Svg width={16} height={16} viewBox="0 0 24 24">
          <Path {...stroke(ink, 2.2)} d={icon} />
        </Svg>
      ) : null}
      <Text style={{ color: ink, fontWeight: "600", fontSize: fs }} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

// titoletto di sezione con collegamento a destra (.sec-h)
export function SecHead({ title, link, onLink, top = 30 }: { title: string; link?: string; onLink?: () => void; top?: number }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginTop: top, marginBottom: 12 }}>
      <Text style={{ color: t.ink2, fontFamily: DISPLAY, fontWeight: "600", fontSize: 12.5, letterSpacing: 2.5, textTransform: "uppercase" }}>{title}</Text>
      {link ? (
        <Pressable onPress={onLink} hitSlop={8} style={{ paddingVertical: 4 }}>
          <Text style={{ color: t.cyan, fontWeight: "600", fontSize: 13.6 }}>{link}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// riquadro (.panel) con titoletto (.panel > h4)
export function Panel({ title, children, style }: { title?: string; children: ReactNode; style?: ViewStyle }) {
  const t = useTheme();
  return (
    <View style={[{ backgroundColor: t.surface, borderWidth: 1, borderColor: t.line, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 18 }, style]}>
      {title ? <Text style={{ color: t.ink2, fontFamily: DISPLAY, fontWeight: "600", fontSize: 11.5, letterSpacing: 1.85, textTransform: "uppercase", marginBottom: 12 }}>{title}</Text> : null}
      {children}
    </View>
  );
}

// griglia a due colonne con larghezze esatte (come grid-template-columns: repeat(2, 1fr)): l'ultima carta da sola resta mezza
export function Grid2({ gap, children }: { gap: number; children: (w: number) => ReactNode }) {
  const [w, setW] = useState(0);
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ flexDirection: "row", flexWrap: "wrap", gap }}>
      {w ? children(Math.floor((w - gap) / 2)) : null}
    </View>
  );
}
