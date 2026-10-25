// Elementi degli elenchi di carte (ricerca, prodotto, collezione): vista a elenco o a immagini, cuore delle preferite,
// pulsanti − e + per le copie (tenendo premuto ±4, e altre 4 continuando a tenere; toccando il numero si scrive quante copie).
import { useRef, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View, useWindowDimensions } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { Image } from "expo-image";
import { Card, thumbUrl } from "./data";
import { openCard } from "./nav";
import { cmCovered, cmVal, ctCovered, ctVal, eurN, usePrices } from "./prices";
import { S, favSet, isFav, owned, setQty, setView, useStore } from "./store";
import { useTheme } from "./theme";
import { ColorBand } from "./ui";

const HOLD = 550;

export function QtyControl({ c, value, onSet, plusOff, big }: { c?: Card; value?: number; onSet?: (v: number) => void; plusOff?: boolean; big?: boolean }) {
  const t = useTheme();
  useStore();
  const n = value != null ? value : c ? owned(c) : 0;
  const set = onSet || ((v: number) => c && setQty(c, v));
  const [edit, setEdit] = useState(false);
  const [txt, setTxt] = useState("");
  const [pop, setPop] = useState("");
  const timer = useRef<any>(null);
  const held = useRef(false);
  const cur = useRef(n);
  cur.current = n;
  const tot = useRef(0);
  const sz = big ? 40 : 32;

  function start(sign: number) {
    held.current = false;
    tot.current = 0;
    timer.current = setTimeout(function tick() {
      held.current = true;
      const k = sign > 0 ? 4 : Math.min(4, cur.current);
      if (!k) return;
      tot.current += k;
      cur.current = cur.current + sign * k;
      set(cur.current);
      setPop((sign > 0 ? "+" : "−") + tot.current);
      timer.current = setTimeout(tick, HOLD / 2);
    }, HOLD);
  }
  function stop() {
    clearTimeout(timer.current);
    if (held.current) setTimeout(() => setPop(""), 800);
  }
  const btn = (label: string, on: boolean, onPress: () => void, sign: number, off?: boolean) => (
    <Pressable
      onPress={() => {
        if (held.current) {
          held.current = false;
          return;
        }
        onPress();
      }}
      onPressIn={() => !off && start(sign)}
      onPressOut={stop}
      disabled={off}
      hitSlop={6}
      style={{ width: sz, height: sz, borderRadius: sz / 2, alignItems: "center", justifyContent: "center", backgroundColor: on ? t.accent : t.surface2, opacity: off ? 0.4 : 1 }}
    >
      <Text style={{ color: on ? t.accentInk : t.ink, fontSize: 20, fontWeight: "800", marginTop: -2 }}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      {btn("−", false, () => n > 0 && set(n - 1), -1)}
      {edit ? (
        <TextInput
          autoFocus
          value={txt}
          onChangeText={(v) => setTxt(v.replace(/\D/g, ""))}
          keyboardType="number-pad"
          maxLength={3}
          selectTextOnFocus
          onBlur={() => {
            const v = parseInt(txt, 10);
            if (!isNaN(v) && v !== n) set(v);
            setEdit(false);
          }}
          onSubmitEditing={() => setEdit(false)}
          style={{ minWidth: 34, textAlign: "center", color: t.ink, fontWeight: "800", fontSize: 16, borderBottomWidth: 2, borderColor: t.accent, paddingVertical: 2 }}
        />
      ) : (
        <Pressable
          onPress={() => {
            setTxt(String(n));
            setEdit(true);
          }}
          hitSlop={6}
        >
          <Text style={{ minWidth: 26, textAlign: "center", color: n ? t.ink : t.ink2, fontWeight: "800", fontSize: 16 }}>{n}</Text>
        </Pressable>
      )}
      {btn("+", !plusOff, () => set(n + 1), 1, false)}
      {!!pop && (
        <View style={{ position: "absolute", right: 0, top: -26, backgroundColor: t.ink, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 }}>
          <Text style={{ color: t.bg, fontWeight: "800" }}>{pop}</Text>
        </View>
      )}
    </View>
  );
}

export function Heart({ on, size = 22, color }: { on: boolean; size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 20.5s-7.5-4.6-9.3-9.2C1.5 8 3.6 4.5 7.1 4.5c2.1 0 3.6 1.1 4.9 2.8 1.3-1.7 2.8-2.8 4.9-2.8 3.5 0 5.6 3.5 4.4 6.8-1.8 4.6-9.3 9.2-9.3 9.2z" fill={on ? "#e5484d" : "none"} stroke={on ? "#e5484d" : color} strokeWidth={2} strokeLinejoin="round" />
    </Svg>
  );
}
export function FavButton({ c, size = 22, onToggled }: { c: Card; size?: number; onToggled?: (on: boolean) => void }) {
  const t = useTheme();
  useStore();
  const on = isFav(c);
  return (
    <Pressable
      hitSlop={8}
      onPress={() => {
        favSet(c, !on);
        onToggled && onToggled(!on);
      }}
      accessibilityLabel={on ? "Togli dalle preferite" : "Aggiungi alle preferite"}
    >
      <Heart on={on} size={size} color={t.ink2} />
    </Pressable>
  );
}
export function ListsIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M9 6h11M9 12h11M9 18h7" stroke={color} strokeWidth={2.2} strokeLinecap="round" fill="none" />
      <Path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" stroke={color} strokeWidth={3} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

// riga "numero · rarità" con ★, ★★ o SP come stampati sulla carta
export function rarLine(c: Card) {
  const r = (c.rar || "").trim();
  const mk = c.suf ? (c.mark === "SP" ? "SP " : c.mark === 2 ? "★★ " : c.mark === 1 ? "★ " : "") : "";
  return c.code + (r || mk ? " · " + mk + r : "");
}

// pastiglia con i due prezzi (Cardmarket · CardTrader)
function PricePill({ c }: { c: Card }) {
  const t = useTheme();
  const cm = cmCovered(c),
    ct = ctCovered(c);
  if (!cm && !ct) return null;
  const a = cmVal(c),
    b = ctVal(c);
  const f = (v: number | null) => (v == null ? "N/D" : (v >= 100 ? Math.round(v).toLocaleString("it-IT") : eurN(v)) + " €");
  return (
    <View style={{ flexDirection: "row", alignSelf: "flex-start", marginTop: 4, borderRadius: 8, backgroundColor: t.surface2, paddingHorizontal: 8, paddingVertical: 2, gap: 8 }}>
      {cm && (
        <Text style={{ color: t.ink2, fontSize: 12 }}>
          CM <Text style={{ color: t.ink, fontWeight: "700" }}>{f(a)}</Text>
        </Text>
      )}
      {ct && (
        <Text style={{ color: t.ink2, fontSize: 12 }}>
          CT <Text style={{ color: t.ink, fontWeight: "700" }}>{f(b)}</Text>
        </Text>
      )}
    </View>
  );
}

export function ListRow({ c, list, extra }: { c: Card; list: Card[]; extra?: React.ReactNode }) {
  const t = useTheme();
  return (
    <Pressable onPress={() => openCard(c, list)} style={{ flexDirection: "row", gap: 10, paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 1, borderColor: t.line, alignItems: "center" }}>
      <View style={{ width: 52 }}>
        <Image source={thumbUrl(c)} style={{ width: 52, height: 73, borderRadius: 4, backgroundColor: t.surface2 }} cachePolicy="disk" recyclingKey={c.k} />
        <View style={{ marginTop: 3 }}>
          <ColorBand colors={c.colors} height={3} />
        </View>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ flex: 1, color: t.ink, fontWeight: "700", fontSize: 15 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
            {c.name}
          </Text>
          <FavButton c={c} size={20} />
        </View>
        <Text style={{ color: t.ink2, fontSize: 12 }} numberOfLines={1}>
          {[c.ct, c.lv].filter(Boolean).join(" · ")}
        </Text>
        <Text style={{ color: t.ink2, fontSize: 12 }} numberOfLines={1}>
          {rarLine(c)}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 }}>
          <PricePill c={c} />
          <QtyControl c={c} />
        </View>
        {extra}
      </View>
    </Pressable>
  );
}

export function GridTile({ c, list, width, extra }: { c: Card; list: Card[]; width: number; extra?: React.ReactNode }) {
  const t = useTheme();
  return (
    <Pressable onPress={() => openCard(c, list)} style={{ width, padding: 4 }}>
      <Image source={thumbUrl(c)} style={{ width: "100%", aspectRatio: 0.716, borderRadius: 6, backgroundColor: t.surface2 }} contentFit="cover" cachePolicy="disk" transition={120} recyclingKey={c.k} />
      <View style={{ marginTop: 4 }}>
        <ColorBand colors={c.colors} height={3} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 3, gap: 4 }}>
        <Text style={{ flex: 1, color: t.ink, fontSize: 12, fontWeight: "700" }} numberOfLines={1}>
          {c.name}
        </Text>
        <FavButton c={c} size={16} />
      </View>
      <Text style={{ color: t.ink2, fontSize: 11 }} numberOfLines={1}>
        {rarLine(c)}
      </Text>
      <View style={{ alignItems: "center", marginTop: 4 }}>
        <QtyControl c={c} />
      </View>
      {extra}
    </Pressable>
  );
}

// interruttore elenco / immagini (salvato come nell'app attuale)
export function ViewToggle() {
  const t = useTheme();
  useStore();
  const b = (v: "list" | "grid", icon: React.ReactNode) => (
    <Pressable onPress={() => setView(v)} hitSlop={6} style={{ padding: 6, borderRadius: 8, backgroundColor: S.view === v ? t.surface2 : "transparent" }}>
      {icon}
    </Pressable>
  );
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {b(
        "list",
        <Svg width={20} height={20} viewBox="0 0 24 24">
          <Path d="M4 6h16M4 12h16M4 18h16" stroke={S.view === "list" ? t.accent : t.ink2} strokeWidth={2} strokeLinecap="round" />
        </Svg>
      )}
      {b(
        "grid",
        <Svg width={20} height={20} viewBox="0 0 24 24">
          <Rect x={3.5} y={4} width={7} height={16} rx={1.5} stroke={S.view === "grid" ? t.accent : t.ink2} strokeWidth={2} fill="none" />
          <Rect x={13.5} y={4} width={7} height={16} rx={1.5} stroke={S.view === "grid" ? t.accent : t.ink2} strokeWidth={2} fill="none" />
        </Svg>
      )}
    </View>
  );
}

// elenco di carte già filtrato, nella vista scelta
export function CardList({ list, header, empty, extra }: { list: Card[]; header?: React.ReactElement; empty?: string; extra?: (c: Card) => React.ReactNode }) {
  const t = useTheme();
  useStore();
  usePrices();
  const { width } = useWindowDimensions();
  const grid = S.view === "grid";
  const cols = grid ? Math.max(2, Math.floor(width / 150)) : 1;
  return (
    <FlatList
      key={grid ? "g" + cols : "l"}
      data={list}
      numColumns={cols}
      keyExtractor={(c) => c.k}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      ListHeaderComponent={header}
      contentContainerStyle={{ paddingHorizontal: grid ? 6 : 0, paddingBottom: 30 }}
      initialNumToRender={grid ? 12 : 10}
      windowSize={7}
      renderItem={({ item }) => (grid ? <GridTile c={item} list={list} width={(width - 12) / cols} extra={extra && extra(item)} /> : <ListRow c={item} list={list} extra={extra && extra(item)} />)}
      ListEmptyComponent={empty ? <Text style={{ color: t.ink2, padding: 16 }}>{empty}</Text> : undefined}
    />
  );
}

