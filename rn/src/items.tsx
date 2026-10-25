// Elementi degli elenchi di carte (ricerca, prodotto, collezione) come nell'app attuale sul telefono:
// vista a immagini (.tile: carta, barretta dei colori, nome con il cuore, tipo · livello, numero · rarità, −/+ e prezzi)
// e vista a elenco (.row.card.p1: miniatura con la barretta, nome su tutta la riga con il cuore, righe brevi, pastiglia
// dei prezzi e −/+). Pulsanti − e + nel riquadro unico: tenendo premuto ±4 (e altre 4 continuando a tenere);
// toccando il numero si scrive quante copie.
import { ReactNode, useRef, useState } from "react";
import { FlatList, Linking, Pressable, View, useWindowDimensions } from "react-native";
import { DISPLAY, Text, TextInput } from "./Text";
import Svg, { Path, Rect } from "react-native-svg";
import { Image } from "expo-image";
import { Card, fullUrl, isAce, thumbUrl } from "./data";
import { openCard } from "./nav";
import { cmCovered, cmOf, cmUrl, ctCovered, ctOf, ctUrl, eurN, usePrices } from "./prices";
import { S, favSet, isFav, owned, setQty, setView, useStore } from "./store";
import { useTheme } from "./theme";
import { ColorBand } from "./ui";
import { FitText } from "./fit";
import { useBar } from "./chrome";
import { CmMark, CtMark } from "./shops";
import { BOTTOM_PAD } from "./BottomBar";
import { favToast } from "./toast";

const HOLD = 550;

// −, numero e + in un unico riquadro (body.mob .qty); fill = su tutta la larghezza (griglia); big = barra della scheda carta
// mazzo: plus = "dim" (+ spento: carta al massimo o altro limite, il tocco mostra il motivo con onBlocked), "max" (limitata già
// nel mazzo: al posto del + la scritta MAX), "lock" (bandita: lucchetti, numero sostituito da numText in rosso)
export function QtyControl({ c, value, onSet, plusOff, big, fill, plus, onBlocked, numText, size }: { c?: Card; value?: number; onSet?: (v: number) => void; plusOff?: boolean; big?: boolean; fill?: boolean; plus?: "dim" | "max" | "lock"; onBlocked?: () => void; numText?: string; size?: number }) {
  const t = useTheme();
  useStore();
  const n = value != null ? value : c ? owned(c) : 0;
  const set = onSet || ((v: number) => c && setQty(c, v));
  const [edit, setEdit] = useState(false);
  const [txt, setTxt] = useState("");
  const [pop, setPop] = useState<{ s: string; right: boolean } | null>(null);
  const timer = useRef<any>(null);
  const held = useRef(false);
  const cur = useRef(n);
  cur.current = n;
  const tot = useRef(0);
  const sz = size || (big ? 42 : 40);

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
      setPop({ s: (sign > 0 ? "+" : "−") + tot.current, right: sign > 0 });
      timer.current = setTimeout(tick, HOLD / 2);
    }, HOLD);
  }
  function stop() {
    clearTimeout(timer.current);
    if (held.current) setTimeout(() => setPop(null), 800);
  }
  const lockIco = (
    <Svg width={15} height={15} viewBox="0 0 24 24">
      <Rect x={5} y={11} width={14} height={10} rx={2} stroke={t.ink2} strokeWidth={2.2} fill="none" />
      <Path d="M8 11V8a4 4 0 0 1 8 0v3" stroke={t.ink2} strokeWidth={2.2} fill="none" strokeLinecap="round" />
    </Svg>
  );
  const btn = (label: string, isPlus: boolean, onPress: () => void, sign: number, full?: boolean, mode?: "dim" | "max" | "lock") => {
    const lock = mode === "lock";
    const dim = full || mode === "dim" || mode === "max";
    const on = isPlus && !dim && !lock;
    return (
      <Pressable
        onPress={() => {
          if (held.current) {
            held.current = false;
            return;
          }
          if (lock) return;
          if (isPlus && (mode === "dim" || mode === "max")) return onBlocked && onBlocked();
          onPress();
        }}
        onPressIn={() => !full && !mode && start(sign)}
        onPressOut={stop}
        disabled={full || lock}
        accessibilityLabel={lock ? "Carta bandita" : isPlus ? "Una in più (tieni premuto per aggiungerne 4)" : "Una in meno (tieni premuto per toglierne 4)"}
        style={{ width: sz, height: sz, borderRadius: sz < 38 ? 10 : 11, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: on ? t.accent : t.line, backgroundColor: on ? t.accent : "transparent", opacity: lock ? 0.6 : dim ? 0.35 : 1 }}
      >
        {lock ? lockIco : mode === "max" ? <Text style={{ color: t.ink, fontFamily: DISPLAY, fontWeight: "700", fontSize: 9.6 }}>MAX</Text> : <Text style={{ color: on ? t.accentInk : t.ink, fontSize: 17.6, lineHeight: 20 }}>{label}</Text>}
      </Pressable>
    );
  };
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: fill ? "space-between" : undefined, alignSelf: fill ? "stretch" : undefined, gap: 4, padding: big ? 4 : 3, borderRadius: 14, borderWidth: 1, borderColor: t.line, backgroundColor: t.bg }}>
      {btn("−", false, () => n > 0 && set(n - 1), -1, false, plus === "lock" && !n ? "lock" : undefined)}
      {numText ? (
        <Text style={{ color: "#ff5a5f", fontFamily: DISPLAY, fontWeight: "700", fontSize: 11.5, letterSpacing: 0.5, textTransform: "uppercase", paddingHorizontal: 2 }}>{numText}</Text>
      ) : edit ? (
        <TextInput
          autoFocus
          value={txt}
          onChangeText={(v) => setTxt(v.replace(/\D/g, ""))}
          keyboardType="number-pad"
          maxLength={3}
          selectTextOnFocus
          onBlur={() => {
            const v = parseInt(txt, 10);
            if (!isNaN(v) && v !== n) set(Math.max(0, Math.min(999, v)));
            setEdit(false);
          }}
          onSubmitEditing={() => setEdit(false)}
          style={{ width: 34, textAlign: "center", color: t.ink, fontFamily: DISPLAY, fontWeight: "700", fontSize: 15, borderBottomWidth: 2, borderColor: t.accent, paddingVertical: 2 }}
        />
      ) : (
        <Pressable
          onPress={() => {
            if (plusOff) return;
            setTxt(String(n));
            setEdit(true);
          }}
          accessibilityLabel="Scrivi il numero di copie"
          hitSlop={4}
        >
          <Text style={{ minWidth: 22, textAlign: "center", color: t.ink, fontFamily: DISPLAY, fontWeight: "700", fontSize: 15, fontVariant: ["tabular-nums"] }}>{n}</Text>
        </Pressable>
      )}
      {btn("+", true, () => set(n + 1), 1, plusOff, plus)}
      {pop ? (
        <View pointerEvents="none" style={{ position: "absolute", [pop.right ? "right" : "left"]: 3, top: -30, minWidth: sz, alignItems: "center", backgroundColor: t.ink, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
          <Text style={{ color: t.bg, fontFamily: DISPLAY, fontWeight: "700", fontSize: 13 }}>{pop.s}</Text>
        </View>
      ) : null}
    </View>
  );
}

const HEART = "M12 20.5s-7.5-4.6-9.3-9.2C1.5 8 3.6 4.5 7.1 4.5c2.1 0 3.6 1.1 4.9 2.8 1.3-1.7 2.8-2.8 4.9-2.8 3.5 0 5.6 3.5 4.4 6.8-1.8 4.6-9.3 9.2-9.3 9.2z";
export function Heart({ on, size = 22, color, onColor }: { on: boolean; size?: number; color: string; onColor?: string }) {
  const c = on ? onColor || color : color;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={HEART} fill={on ? c : "none"} stroke={c} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}
// cuore delle preferite (.favb): grigio, arancione pieno se preferita; dopo il tocco l'avviso con "Liste e avviso"
export function FavButton({ c, size = 24, onToggled, box }: { c: Card; size?: number; onToggled?: (on: boolean) => void; box?: boolean }) {
  const t = useTheme();
  useStore();
  const on = isFav(c);
  return (
    <Pressable
      hitSlop={box ? 0 : 8}
      onPress={() => {
        favSet(c, !on);
        favToast(c, !on);
        onToggled && onToggled(!on);
      }}
      accessibilityLabel={on ? "Togli dalle preferite" : "Aggiungi alle preferite"}
      accessibilityState={{ selected: on }}
      style={box ? { width: 40, height: 34, marginVertical: -4, marginRight: 4, alignItems: "center", justifyContent: "center" } : undefined}
    >
      <Heart on={on} size={size} color={on ? t.accent : t.ink2} />
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

// riga "numero · rarità" con ★, ★★ o SP come stampati sulla carta (testo semplice, per le righe del mazzo)
export function rarLine(c: Card) {
  const r = (c.rar || "").trim();
  const mk = c.suf ? (c.mark === "SP" ? "SP " : c.mark === 2 ? "★★ " : c.mark === 1 ? "★ " : "") : "";
  return c.code + (r || mk ? " · " + mk + r : "");
}
// segno ★ / ★★ / SP (.st1, .st2, .spb)
export function Mark({ c, size }: { c: Card; size: number }) {
  const t = useTheme();
  if (!c.suf || !c.mark) return null;
  if (c.mark === "SP")
    return (
      <Text style={{ fontSize: size * 0.6, fontWeight: "700", color: t.bg, backgroundColor: t.ink2 }}>
        {" SP "}
        <Text style={{ fontSize: size, color: t.ink2, backgroundColor: "transparent" }}> </Text>
      </Text>
    );
  return <Text style={{ fontSize: size * (c.mark === 2 ? 0.74 : 0.8) }}>{c.mark === 2 ? "★★ " : "★ "}</Text>;
}
// righe brevi: 1) tipo · livello  2) numero · rarità
export function ListLines({ c }: { c: Card }) {
  const t = useTheme();
  const r = (c.rar || "").trim();
  return (
    <>
      <Text style={{ color: t.ink2, fontSize: 12.8, lineHeight: 18 }} numberOfLines={1}>
        {[c.ct, c.lv].filter(Boolean).join(" · ")}
      </Text>
      <Text style={{ color: t.ink2, fontSize: 12.8, lineHeight: 18 }} numberOfLines={1}>
        {c.code}
        {r || (c.suf && c.mark) ? " · " : ""}
        <Mark c={c} size={12.8} />
        {r}
      </Text>
    </>
  );
}

const eurC = (v: number) => (v >= 100 ? Math.round(v).toLocaleString("it-IT") : eurN(v));
const open = (u: string | null) => u && Linking.openURL(u);

// riga prezzo compatta (.pline): logo · valore · MIN/TR; toccandola si apre il negozio
function PLine({ shop, c }: { shop: "cm" | "ct"; c: Card }) {
  const t = useTheme();
  let v: number | null = null,
    tag = "";
  if (shop === "cm") {
    const p = cmOf(c);
    if (p && p[1] != null) (v = p[1]), (tag = "MIN");
    else if (p && p[0] != null) (v = p[0]), (tag = "TR");
  } else {
    const p = ctOf(c);
    if (p && p[0] != null) (v = p[0]), (tag = "MIN");
  }
  return (
    <Pressable onPress={() => open(shop === "cm" ? cmUrl(c) : ctUrl(c))} accessibilityLabel={shop === "cm" ? "Apri la carta su Cardmarket" : "Apri la carta su CardTrader"} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 5, paddingHorizontal: 8, borderRadius: 8, backgroundColor: t.surface2 }}>
      {shop === "cm" ? <CmMark /> : <CtMark />}
      <Text style={{ flex: 1, textAlign: "center", color: v == null ? t.ink2 : t.ink, fontWeight: v == null ? "500" : "600", fontSize: 12.5, lineHeight: 14, fontVariant: ["tabular-nums"] }} numberOfLines={1}>
        {v == null ? "N/D" : eurC(v) + " €"}
      </Text>
      <View style={{ width: 31, paddingVertical: 2, borderWidth: 1, borderColor: tag ? t.line : "transparent", borderRadius: 4, alignItems: "center" }}>
        <Text style={{ color: t.ink2, fontFamily: DISPLAY, fontWeight: "700", fontSize: 9.3, lineHeight: 10, letterSpacing: 0.5 }}>{tag || " "}</Text>
      </View>
    </Pressable>
  );
}
export function PriceLines({ c }: { c: Card }) {
  const cm = cmCovered(c),
    ct = ctCovered(c);
  if (!cm && !ct) return null;
  return (
    <View style={{ gap: 4 }}>
      {cm ? <PLine shop="cm" c={c} /> : null}
      {ct ? <PLine shop="ct" c={c} /> : null}
    </View>
  );
}

// pastiglia con i due prezzi (.ppill): Cardmarket | CardTrader, ogni metà apre il suo negozio
export function PricePill({ c }: { c: Card }) {
  const t = useTheme();
  const cm = cmCovered(c),
    ct = ctCovered(c);
  if (!cm && !ct) return null;
  const p = cmOf(c),
    a = p && p[1] != null ? p[1] : p && p[0] != null ? p[0] : null;
  const q = ctOf(c),
    b = q && q[0] != null ? q[0] : null;
  const seg = (mark: ReactNode, v: number | null, url: string | null, label: string) => (
    <Pressable onPress={() => open(url)} accessibilityLabel={label} hitSlop={{ top: 6, bottom: 6 }} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      {mark}
      <Text style={{ color: v == null ? t.ink2 : t.ink, fontWeight: v == null ? "500" : "600", fontSize: 12.2, lineHeight: 16, fontVariant: ["tabular-nums"] }}>{v == null ? "N/D" : eurC(v) + " €"}</Text>
    </Pressable>
  );
  return (
    <View style={{ flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 6, height: 24, marginTop: 5, paddingHorizontal: 9, borderRadius: 99, backgroundColor: t.surface2, maxWidth: "100%" }}>
      {cm ? seg(<CmMark size={13} />, a, cmUrl(c), "Apri la carta su Cardmarket") : null}
      {cm && ct ? <View style={{ width: 1, height: 12, backgroundColor: t.line }} /> : null}
      {ct ? seg(<CtMark size={13} />, b, ctUrl(c), "Apri la carta su CardTrader") : null}
    </View>
  );
}

// vista a elenco (.row.card.p1)
// right: al posto delle copie della collezione (es. copie nel mazzo); deck: scheda aperta dall'editor del mazzo
export function ListRow({ c, list, extra, noPrice, right, deck, onOpen }: { c: Card; list: Card[]; extra?: ReactNode; noPrice?: boolean; right?: ReactNode; deck?: string; onOpen?: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={() => (onOpen && onOpen(), openCard(c, list, deck))} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingLeft: 10, paddingRight: 12, backgroundColor: t.surface, borderWidth: 1, borderColor: t.line, borderRadius: 10 }}>
      <View style={{ width: 46, gap: 4 }}>
        <Image source={thumbUrl(c)} style={{ width: 46, height: 64, borderRadius: 4, backgroundColor: t.surface2 }} contentFit="cover" cachePolicy="disk" recyclingKey={c.k} />
        <ColorBand colors={c.colors} height={4} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <FitText text={c.name} size={15} boxStyle={{ flex: 1 }} style={{ color: t.ink, fontWeight: "500" }} ace={isAce(c)} />
          {right ? null : <FavButton c={c} box />}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <ListLines c={c} />
            {noPrice ? null : <PricePill c={c} />}
            {extra}
          </View>
          {right ?? <QtyControl c={c} />}
        </View>
      </View>
    </Pressable>
  );
}

// vista a immagini (.tile)
export function GridTile({ c, list, width, extra, qty, deck, onOpen }: { c: Card; list: Card[]; width: number; extra?: ReactNode; qty?: ReactNode; deck?: string; onOpen?: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={() => (onOpen && onOpen(), openCard(c, list, deck))} style={{ width, padding: 6, gap: 5, backgroundColor: t.surface, borderWidth: 1, borderColor: t.line, borderRadius: 11 }}>
      <Image source={fullUrl(c)} placeholder={thumbUrl(c)} placeholderContentFit="cover" style={{ width: "100%", aspectRatio: 5 / 7, borderRadius: 7, backgroundColor: t.surface2 }} contentFit="cover" cachePolicy="disk" transition={120} recyclingKey={c.k} />
      <ColorBand colors={c.colors} height={5} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, minWidth: 0 }}>
        <FitText text={c.name} size={14.7} boxStyle={{ flex: 1 }} style={{ color: t.ink, fontWeight: "600" }} ace={isAce(c)} />
        {qty ? null : <FavButton c={c} box />}
      </View>
      <View>
        <ListLines c={c} />
      </View>
      <View style={{ marginTop: "auto", paddingTop: 2, alignItems: "stretch" }}>{qty ?? <QtyControl c={c} fill />}</View>
      {qty ? null : <PriceLines c={c} />}
      {extra}
    </Pressable>
  );
}

// interruttore elenco / immagini (.vbtns), salvato come nell'app attuale
// value/onChange: vista separata (es. ricerca nel mazzo, "dg-dkview"); senza, quella di tutta l'app ("dgm-view")
export function ViewToggle({ value, onChange }: { value?: "list" | "grid"; onChange?: (v: "list" | "grid") => void } = {}) {
  const t = useTheme();
  useStore();
  const b = (v: "list" | "grid", label: string) => {
    const on = (value || S.view) === v;
    const col = on ? t.bg : t.ink2;
    return (
      <Pressable onPress={() => (onChange ? onChange(v) : setView(v))} accessibilityLabel={label} accessibilityState={{ selected: on }} style={{ width: 36, height: 32, borderRadius: 8, borderWidth: 1, borderColor: on ? t.ink : t.line, backgroundColor: on ? t.ink : t.surface, alignItems: "center", justifyContent: "center" }}>
        <Svg width={18} height={18} viewBox="0 0 24 24">
          {v === "list" ? (
            <Path d="M4 6h16M4 12h16M4 18h16" stroke={col} strokeWidth={2} strokeLinecap="round" />
          ) : (
            <>
              <Rect x={3.5} y={4} width={7} height={16} rx={1.5} stroke={col} strokeWidth={2} fill="none" strokeLinejoin="round" />
              <Rect x={13.5} y={4} width={7} height={16} rx={1.5} stroke={col} strokeWidth={2} fill="none" strokeLinejoin="round" />
            </>
          )}
        </Svg>
      </Pressable>
    );
  };
  return (
    <View style={{ flexDirection: "row", gap: 6 }}>
      {b("list", "Vista a elenco")}
      {b("grid", "Vista a immagini")}
    </View>
  );
}

// riga "N carte" con l'interruttore della vista (.group-title.withv)
export function CountRow({ n, top = 14 }: { n: number; top?: number }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: top, marginBottom: 8 }}>
      <Text style={{ color: t.ink2, fontFamily: DISPLAY, fontWeight: "500", fontSize: 12.5, letterSpacing: 1.5, textTransform: "uppercase" }}>{n + (n === 1 ? " carta" : " carte")}</Text>
      <ViewToggle />
    </View>
  );
}

// elenco di carte già filtrato, nella vista scelta (griglia a due colonne o elenco)
export function CardList({ list, header, empty, extra, padBottom = BOTTOM_PAD }: { list: Card[]; header?: React.ReactElement; empty?: string; extra?: (c: Card) => ReactNode; padBottom?: number }) {
  const t = useTheme();
  useStore();
  usePrices();
  const { width } = useWindowDimensions();
  const bar = useBar();
  const grid = S.view === "grid";
  const tw = Math.floor((width - 28 - 6) / 2);
  return (
    <FlatList
      key={grid ? "g" : "l"}
      data={list}
      numColumns={grid ? 2 : 1}
      keyExtractor={(c) => c.k}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      ListHeaderComponent={header}
      columnWrapperStyle={grid ? { gap: 6 } : undefined}
      ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
      onScroll={bar.onScroll} scrollEventThrottle={16}
      contentContainerStyle={{ paddingHorizontal: 14, paddingTop: bar.pad, paddingBottom: padBottom }}
      initialNumToRender={grid ? 8 : 10}
      windowSize={7}
      renderItem={({ item }) => (grid ? <GridTile c={item} list={list} width={tw} extra={extra && extra(item)} /> : <ListRow c={item} list={list} extra={extra && extra(item)} />)}
      ListEmptyComponent={empty ? <Text style={{ color: t.ink2, textAlign: "center", paddingVertical: 30 }}>{empty}</Text> : undefined}
    />
  );
}
