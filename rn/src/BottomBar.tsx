// Ricerca in basso (come .mbot dell'app attuale sul telefono): sopra la barra di navigazione, con la sfumatura verso lo sfondo.
// In fila: campo con la lente arancione, poi (secondo la pagina) fotocamera, Filtri con il numero dei filtri attivi
// e la freccia che apre i tipi di prodotto. Sopra la fila le etichette dei filtri attivi, sotto la riga che si apre.
import { ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { DISPLAY, Text, TextInput } from "./Text";
import { useTheme } from "./theme";

const SHADOW = "0 8px 22px rgba(0,0,0,.22)";
// spazio in fondo agli elenchi per non finire sotto la ricerca (main 28 px + body.hasmbot 138 px − barra in basso 66 px)
export const BOTTOM_PAD = 100;

export function SearchIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={11} cy={11} r={6.5} stroke={color} strokeWidth={2.4} strokeLinecap="round" fill="none" />
      <Path d="M20 20l-4.2-4.2" stroke={color} strokeWidth={2.4} strokeLinecap="round" fill="none" />
    </Svg>
  );
}
export function FilterIcon({ color }: { color: string }) {
  const p = { stroke: color, strokeWidth: 2, strokeLinecap: "round" as const, fill: "none" };
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path {...p} d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <Circle {...p} cx={16} cy={7} r={2} />
      <Circle {...p} cx={10} cy={17} r={2} />
    </Svg>
  );
}
export function CamIcon({ color }: { color: string }) {
  return (
    <Svg width={23} height={23} viewBox="0 0 24 24">
      <Path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" />
      <Circle cx={12} cy={13.5} r={3.6} stroke={color} strokeWidth={2} fill="none" />
    </Svg>
  );
}
export function Chevron({ color, up, size = 22 }: { color: string; up?: boolean; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={up ? { transform: [{ rotate: "180deg" }] } : undefined}>
      <Path d="M6 9l6 6 6-6" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

// pulsante quadrato accanto al campo (.mbf)
export function SquareBtn({ children, on, onPress, label, badge, size = 50, shadow = true }: { children: ReactNode; on?: boolean; onPress: () => void; label: string; badge?: number; size?: number; shadow?: boolean }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} style={{ width: size, height: size, borderRadius: 14, borderWidth: 1, borderColor: on ? t.cyan : t.line, backgroundColor: on ? t.cyanSoft : t.surface, alignItems: "center", justifyContent: "center", boxShadow: shadow ? SHADOW : undefined }}>
      {children}
      {badge ? (
        <View style={{ position: "absolute", top: -6, right: -6, minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, backgroundColor: t.cyan, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: "#06222a", fontFamily: DISPLAY, fontWeight: "700", fontSize: 11.2, lineHeight: 20 }}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

// etichetta di un filtro attivo (.mbchip) con ✕
export function FltChip({ label, dot, onPress, children }: { label?: string; dot?: string; onPress: () => void; children?: ReactNode }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityLabel={"Togli il filtro " + (label || "")} style={{ height: 34, paddingHorizontal: 10, borderRadius: 99, borderWidth: 1, borderColor: t.cyan, backgroundColor: t.cyanSoft, flexDirection: "row", alignItems: "center", gap: 6 }}>
      {dot ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: dot }} /> : null}
      {children || <Text style={{ color: t.ink, fontWeight: "500", fontSize: 13.1, lineHeight: 18 }}>{label}</Text>}
      <Text style={{ color: t.cyan, fontWeight: "700", fontSize: 13.1, lineHeight: 18 }}>✕</Text>
    </Pressable>
  );
}

export function BottomBar({ q, setQ, placeholder, chips, cam, filter, x, below }: {
  q: string;
  setQ: (s: string) => void;
  placeholder: string;
  chips?: ReactNode;
  cam?: boolean;
  filter?: { n: number; onPress: () => void };
  x?: { open: boolean; onPress: () => void };
  below?: ReactNode;
}) {
  const t = useTheme();
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingTop: 18, paddingHorizontal: 14, paddingBottom: 8, gap: 8 }}>
      <Svg pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 10 100">
        <Defs>
          <LinearGradient id="mbotfade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={t.bg} stopOpacity={0} />
            <Stop offset={below ? 0.24 : 0.38} stopColor={t.bg} stopOpacity={1} />
            <Stop offset="1" stopColor={t.bg} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect width="10" height="100" fill="url(#mbotfade)" />
      </Svg>
      {chips ? <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" }}>{chips}</View> : null}
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <View style={{ flex: 1, minWidth: 0, height: 50, borderRadius: 14, borderWidth: 1, borderColor: t.line, backgroundColor: t.surface, boxShadow: SHADOW, justifyContent: "center" }}>
          <View pointerEvents="none" style={{ position: "absolute", left: 13 }}>
            <SearchIcon color={t.accent} />
          </View>
          <TextInput value={q} onChangeText={setQ} placeholder={placeholder} placeholderTextColor={t.ink2} autoCorrect={false} returnKeyType="search" style={{ height: 48, paddingLeft: 42, paddingRight: 13, color: t.ink, fontSize: 16 }} />
        </View>
        {cam ? (
          <SquareBtn onPress={() => router.push("/scansiona")} label="Scansiona una carta con la fotocamera">
            <CamIcon color={t.ink} />
          </SquareBtn>
        ) : null}
        {filter ? (
          <SquareBtn onPress={filter.onPress} on={!!filter.n} badge={filter.n} label={"Filtri" + (filter.n ? ": " + filter.n + (filter.n === 1 ? " attivo" : " attivi") : "")}>
            <FilterIcon color={t.ink} />
          </SquareBtn>
        ) : null}
        {x ? (
          <SquareBtn onPress={x.onPress} label={x.open ? "Nascondi i tipi di prodotto" : "Mostra i tipi di prodotto"}>
            <Chevron color={t.ink} up={!x.open} />
          </SquareBtn>
        ) : null}
      </View>
      {below ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ marginHorizontal: -14 }} contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 2, gap: 8 }}>
          {below}
        </ScrollView>
      ) : null}
    </View>
  );
}

// pastiglia di scelta (.chip; scelta = colori invertiti)
export function Chip({ label, on, onPress, shadow }: { label: string; on?: boolean; onPress: () => void; shadow?: boolean }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={{ paddingVertical: 7, paddingHorizontal: 13, borderRadius: 999, borderWidth: 1, borderColor: on ? t.ink : t.line, backgroundColor: on ? t.ink : t.surface, boxShadow: shadow ? "0 4px 12px rgba(0,0,0,.18)" : undefined }}>
      <Text style={{ color: on ? t.bg : t.ink, fontWeight: "500", fontSize: 13.6, lineHeight: 18 }}>{label}</Text>
    </Pressable>
  );
}
