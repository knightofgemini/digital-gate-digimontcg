// Scheda carta (proposta "C - Carosello" dell'app attuale): con il dito a destra/sinistra la carta precedente/successiva
// dell'elenco da cui è stata aperta; versioni come pulsanti; nome, codice e rarità; una riga di dati; tratti;
// digievoluzioni ed effetti con le icone; prezzi; pre errata. Testi delle carte in inglese, etichette in italiano.
import { ReactNode, createContext, memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Linking, PanResponder, PixelRatio, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { DISPLAY, Text } from "../../Text";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { FitText } from "../../fit";
import { CmMark, CtMark } from "../../shops";
import { Chevron } from "../../BottomBar";
import { favToast } from "../../toast";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { BYKEY, Card, PAIRS, BYCODE, RARITY, SETBY, carVers, deckable, fullUrl, hasErrata, hostSet, isAce, maxCopies, preUrl, splitExtra, thumbUrl } from "../../data";
import { NAVLIST, openCard } from "../../nav";
import { bestVal, cmCovered, cmDate, cmOf, cmUrl, cmVal, ctCovered, ctDate, ctOf, ctUrl, ctVal, eur, eurN, eurT, usePrices } from "../../prices";
import { Chip, Rich, RichInline, iconClass, kwJoin, kwNoRem } from "../../rich";
import { FavSheet } from "../../FavSheet";
import { Heart, ListsIcon, QtyControl } from "../../items";
import { favSet, isFav, owned, useStore } from "../../store";
import { deckById } from "../../decks";
import { DeckQty, Lock } from "../../DeckQty";
import { useTheme } from "../../theme";

export default function Carta() {
  const { k, deck } = useLocalSearchParams<{ k: string; deck?: string }>();
  // la carta dell'elenco da cui si è aperta la scheda (le alternative presenti in due prodotti hanno la stessa chiave:
  // quella dell'elenco ha il prodotto giusto)
  const c0 = useMemo(() => NAVLIST.find((x) => x.k === k) || BYKEY[k], [k]);
  const { width } = useWindowDimensions();
  usePrices();
  // elenco per scorrere: quello da cui si è aperta la scheda (anche se si apre una sua versione)
  const list = useMemo(() => {
    if (!c0) return [];
    if (NAVLIST.indexOf(c0) >= 0) return NAVLIST;
    const vs = carVers(c0);
    return NAVLIST.some((x) => vs.indexOf(x) >= 0) ? NAVLIST : [c0];
  }, [c0]);
  // prima la carta esatta, poi una sua versione (un'alternative art non deve partire dalla posizione della Regular)
  const start = useMemo(() => {
    if (!c0) return 0;
    const i = list.indexOf(c0);
    if (i >= 0) return i;
    const vs = carVers(c0);
    return Math.max(0, list.findIndex((x) => vs.indexOf(x) >= 0));
  }, [list, c0]);
  const [cur, setCur] = useState(start);
  // versioni scelte con i pulsanti, una per carta (restano tornando su quella carta)
  const [vers, setVers] = useState<Record<number, Card>>({});
  const maxW = Math.min(width, 560);
  const cw = Math.min(290, maxW - 84);
  // distanza tra le carte della fila: le vicine spuntano ai lati senza coprire quella al centro.
  // Numero intero di pixel del telefono: Android arrotonda lo scatto ai pixel e con una distanza non intera, carta dopo carta,
  // la fila usciva dal centro (e i dettagli restavano sbiaditi)
  const dpr = PixelRatio.get();
  const S = Math.round((cw * 0.93 + 14) * dpr) / dpr;
  const scrollX = useRef(new Animated.Value(start * S)).current;
  const go = useRef<(i: number) => void>(() => {});
  // tornando su un'altra carta la pagina torna in cima (dove si vedono carta e nome)
  const sv = useRef<any>(null);
  useEffect(() => {
    sv.current && sv.current.scrollTo({ y: 0, animated: true });
  }, [cur]);
  const n = list.length;
  // dettagli (versioni, nome, effetti, prezzi) in dissolvenza: spariscono a metà strada e ricompaiono con la carta nuova
  const fade = useMemo(() => {
    const top = Math.max(1, S * (n - 1));
    const m = Animated.modulo(scrollX.interpolate({ inputRange: [0, top], outputRange: [0, top], extrapolate: "clamp" }), S);
    return {
      opacity: m.interpolate({ inputRange: [0, S * 0.32, S * 0.68, S], outputRange: [1, 0, 0, 1] }),
      transform: [{ translateY: m.interpolate({ inputRange: [0, S * 0.5, S], outputRange: [0, 12, 0] }) }],
    };
  }, [S, n]);
  // scorrendo con il dito anche sul testo si passa alla carta precedente/successiva (con la stessa animazione)
  const curRef = useRef(cur);
  curRef.current = cur;
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 18 && Math.abs(g.dx) > Math.abs(g.dy) * 1.6,
        onPanResponderTerminationRequest: () => true,
        onPanResponderRelease: (_, g) => {
          if (Math.abs(g.dx) > 50 || Math.abs(g.vx) > 0.35) go.current(Math.max(0, Math.min(n - 1, curRef.current + (g.dx < 0 ? 1 : -1))));
        },
      }),
    [n]
  );
  if (!c0) return null;
  const at = (i: number) => vers[i] || (i === start ? c0 : list[i]);
  const c = at(cur);
  const strip = (
    <Fan
      list={list}
      start={start}
      cur={cur}
      at={at}
      sel={Object.keys(vers)
        .map((i) => i + ":" + vers[+i].k)
        .join(",")}
      width={maxW}
      cw={cw}
      S={S}
      x={scrollX}
      go={go}
      onIndex={setCur}
    />
  );
  return <CardPage c={c} setC={(a) => setVers((v) => ({ ...v, [cur]: a }))} width={width} deck={deck} strip={strip} fade={fade} pan={pan.panHandlers} sv={sv} />;
}

// Fila delle carte "a ventaglio": la carta al centro è dritta e grande, le vicine spuntano ai lati più piccole,
// inclinate e ruotate come carte tenute in mano. Trascinando, la vicina arriva al centro raddrizzandosi.
// Tutte le trasformazioni sono calcolate sul thread nativo dalla posizione di scorrimento (nessun lavoro in JS).
function Fan({ list, start, cur, at, sel, width, cw, S, x, go, onIndex }: { list: Card[]; start: number; cur: number; at: (i: number) => Card; sel: string; width: number; cw: number; S: number; x: Animated.Value; go: { current: (i: number) => void }; onIndex: (i: number) => void }) {
  const ref = useRef<any>(null);
  const last = useRef(start);
  const pad = Math.max(0, (width - S) / 2);
  go.current = (i: number) => ref.current && ref.current.scrollToOffset({ offset: i * S, animated: true });
  // se cambia la larghezza (pieghevoli, schermo diviso) la carta scelta torna al centro
  const firstS = useRef(S);
  useEffect(() => {
    if (firstS.current === S) return;
    firstS.current = S;
    ref.current && ref.current.scrollToOffset({ offset: last.current * S, animated: false });
  }, [S]);
  const press = useCallback((i: number) => i !== last.current && go.current(i), []);
  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { x } } }], {
        useNativeDriver: true,
        listener: (e: any) => {
          const i = Math.max(0, Math.min(list.length - 1, Math.round(e.nativeEvent.contentOffset.x / S)));
          if (i !== last.current) {
            last.current = i;
            onIndex(i);
          }
        },
      }),
    [S, list]
  );
  return (
    <CurCtx.Provider value={cur}>
    <Animated.FlatList
      ref={ref}
      data={list}
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={Platform.OS === "android" ? S + 0.5 / PixelRatio.get() : S}
      decelerationRate="fast"
      disableIntervalMomentum
      // la carta i è al centro quando lo scorrimento vale i × S (il margine iniziale centra la prima)
      getItemLayout={(_, i) => ({ length: S, offset: S * i, index: i })}
      initialScrollIndex={start}
      contentContainerStyle={{ paddingHorizontal: pad, paddingTop: 18, paddingBottom: 26 }}
      style={{ flexGrow: 0 }}
      windowSize={5}
      initialNumToRender={3}
      maxToRenderPerBatch={3}
      onScroll={onScroll}
      scrollEventThrottle={16}
      keyExtractor={(c: Card) => c.k}
      extraData={sel}
      CellRendererComponent={FanCell}
      renderItem={({ index }: { item: Card; index: number }) => <FanCard c={at(index)} i={index} S={S} cw={cw} x={x} onPress={press} />}
    />
    </CurCtx.Provider>
  );
}

// la carta al centro sta sopra le vicine (le vicine inclinate altrimenti la coprirebbero un poco)
const CurCtx = createContext(0);
function FanCell({ index, style, ...props }: any) {
  const cur = useContext(CurCtx);
  return <View style={[style, { zIndex: index === cur ? 3 : 1 }]} {...props} />;
}

const FanCard = memo(function FanCard({ c, i, S, cw, x, onPress }: { c: Card; i: number; S: number; cw: number; x: Animated.Value; onPress: (i: number) => void }) {
  const t = useTheme();
  // posizione della carta rispetto al centro: -1 = una a sinistra, 0 = al centro, +1 = una a destra
  // (calcolata una volta sola: ricrearla a ogni ridisegno faceva sfarfallare la carta per un fotogramma)
  const style = useMemo(() => {
  const r = [S * (i - 1), S * i, S * (i + 1)];
  const it = (o: (number | string)[]) => x.interpolate({ inputRange: r, outputRange: o as any, extrapolate: "clamp" });
  return {
    opacity: it([0.55, 1, 0.55]),
    transform: [
      { perspective: 900 },
      { translateX: it([-S * 0.06, 0, S * 0.06]) },
      { translateY: it([18, 0, 18]) },
      { rotateY: it(["-28deg", "0deg", "28deg"]) },
      { rotateZ: it(["7deg", "0deg", "-7deg"]) },
      { scale: it([0.86, 1, 0.86]) },
    ],
  };
  }, [x, S, i]);
  return (
    <View style={{ width: S, alignItems: "center" }}>
      <Animated.View style={style}>
        <Pressable onPress={() => onPress(i)} accessibilityLabel={c.name + " (" + c.code + ")"} style={{ width: cw, aspectRatio: 5 / 7, borderRadius: 12, overflow: "hidden", backgroundColor: t.surface2, boxShadow: t.dark ? "0 2px 6px rgba(0,0,0,.30), 0 10px 22px -6px rgba(0,0,0,.50)" : "0 1px 3px rgba(15,26,46,.10), 0 6px 16px -2px rgba(15,26,46,.16)" }}>
          <Image source={fullUrl(c)} placeholder={thumbUrl(c)} placeholderContentFit="contain" style={{ width: "100%", height: "100%" }} contentFit="contain" cachePolicy="disk" transition={150} recyclingKey={c.k} />
        </Pressable>
      </Animated.View>
    </View>
  );
});

function CardPage({ c, setC, width, deck, strip, fade, pan, sv }: { c: Card; setC: (c: Card) => void; width: number; deck?: string; strip: ReactNode; fade: any; pan: any; sv: { current: any } }) {
  const t = useTheme();
  const [cmOpen, setCmOpen] = useState(false);
  const [ctOpen, setCtOpen] = useState(false);
  const [favFor, setFavFor] = useState<Card | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const dk = deck ? deckById(deck) : null;
  useStore();
  const vers = carVers(c);
  const hs = SETBY[hostSet(c)];
  const num = parseInt(c.code.split("-")[1] || "", 10);
  const ex = splitExtra(c, iconClass);
  const rr = (c.rar || "").trim();
  const maxW = Math.min(width, 560);

  // tratti scritti nelle regole ("also treated as having the [X] trait")
  const rForm: string[] = [],
    rAttr: string[] = [],
    rTrait: string[] = [];
  ex.rule.forEach((r) => {
    if (!/trait/i.test(r)) return;
    r = r.replace(/Name:[^\[]*\[[^\]]+\]/g, "");
    r.replace(/\[([^\]]+)\](\s+(Attribute|Form))?/g, (m, tt, x, kk) => {
      (kk === "Attribute" ? rAttr : kk === "Form" ? rForm : rTrait).push(tt);
      return m;
    });
  });
  const idGroups = [[c.form, ...rForm], [c.attr, ...rAttr], [...(c.sp || "").split("/"), ...rTrait]].map((g) => g.map((v) => (v || "").trim()).filter(Boolean)).filter((g) => g.length);

  const ace = ex.ace.map((l) => {
    const m = l.match(/Overflow\s*＜(-\d+)＞/);
    return m ? "⟦Overflow " + m[1] + "⟧ " + ((c.x && c.x.o) || "(As this card moves from the battle area or under a card to another area, lose " + m[1].slice(1) + " memory.)") : l;
  });
  const side = c.x && c.x.d;
  const fx: [string, string, any?][] = [
    ["Effetto", c.eff],
    ["Effetto ereditato", c.inh],
    ["Effetto di sicurezza", c.sec],
    ["Effetto Option", side ? side.l.join("\n") : "", side],
    ["Regole", ex.rule.join("\n")],
    ["Regole Link", ex.link.join("\n")],
    ["Regole Assembly", ex.asm.join("\n")],
    ["Regole DigiXros", ex.xros.join("\n")],
    ["Regole Ace Overflow", ace.join("\n")],
    ["Altre regole", ex.other.join("\n")],
  ];
  const evo = (c.evo || "")
    .split(";")
    .map((x) => x.trim())
    .filter(Boolean);

  const mx = deckable(c) ? maxCopies(c) : 4;
  const pairs = PAIRS[c.code];
  const cv = cmVal(c),
    tv = ctVal(c);
  const low = cv != null && tv != null && cv !== tv ? (cv < tv ? "cm" : "ct") : "";
  const cw = Math.min(290, maxW - 84);
  const insB = useSafeAreaInsets().bottom;
  const copies = vers.reduce((n, a) => n + owned(a), 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top"]}>
      {/* intestazione (.chead): chiusura, nome del prodotto con "Carta N di M", cuore e liste */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 14, paddingRight: 8, paddingTop: 10, paddingBottom: 10, borderBottomWidth: 1, borderColor: t.line, backgroundColor: t.bg }}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/carte"))} accessibilityLabel="Chiudi" style={headBtn(t)}>
          <Svg width={20} height={20} viewBox="0 0 24 24">
            <Path d="M6 6l12 12M18 6L6 18" stroke={t.ink} strokeWidth={2} strokeLinecap="round" />
          </Svg>
        </Pressable>
        <View style={{ flex: 1, minWidth: 0, alignItems: "center" }}>
          <Text style={{ color: t.ink, fontWeight: "600", fontSize: 15.2, lineHeight: 18 }} numberOfLines={1}>
            {hs ? hs.name : ""}
          </Text>
          {hs && hs.n && num && c.code.split("-")[0] === hs.code && num <= hs.n ? <Text style={{ color: t.ink2, fontSize: 12.5, lineHeight: 15 }}>{"Carta " + num + " di " + hs.n}</Text> : null}
        </View>
        <View style={{ flexDirection: "row", gap: 6 }}>
          <FavBig c={c} />
          <Pressable onPress={() => setFavFor(c)} accessibilityLabel="Liste e avviso di prezzo" style={headBtn(t)}>
            <ListsIcon color={t.ink} size={20} />
          </Pressable>
        </View>
      </View>
      <ScrollView ref={sv} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 14, width: maxW, alignSelf: "center" }} nestedScrollEnabled>
        {/* fila delle carte a ventaglio (precedente e successiva ai lati) */}
        {strip}

        <Animated.View style={fade} {...pan}>
        {/* versioni */}
        {vers.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 6 }} contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: 14, paddingVertical: 2, gap: 8 }}>
            {vers.map((a) => {
              const on = a.k === c.k;
              const bv = bestVal(a);
              return (
                <Pressable key={a.k} onPress={() => setC(a)} accessibilityState={{ selected: on }} style={{ flexDirection: "row", alignItems: "center", gap: 8, height: 52, paddingVertical: on ? 4 : 5, paddingLeft: on ? 4 : 5, paddingRight: on ? 11 : 12, borderRadius: 12, borderWidth: on ? 2 : 1, borderColor: on ? t.accent : t.line, backgroundColor: t.surface }}>
                  <Image source={thumbUrl(a)} style={{ width: 29, height: 40, borderRadius: 4, backgroundColor: t.surface2 }} contentFit="contain" cachePolicy="disk" />
                  <View>
                    <Text style={{ color: t.ink, fontWeight: "700", fontSize: 14.1, lineHeight: 17 }}>{verName(a)}</Text>
                    <Text style={{ color: t.ink2, fontSize: 12.2, lineHeight: 15 }}>{bv == null ? "N/D" : eurT(bv)}</Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        <View style={{ paddingHorizontal: 14 }}>
          {/* nome, codice, rarità e versione */}
          <View style={{ alignItems: "center", marginBottom: 12 }}>
            <FitText text={c.name + (isAce(c) ? "" : "")} size={25.6} minSize={16} display ace={isAce(c)} boxStyle={{ alignSelf: "stretch" }} style={{ color: t.ink, fontFamily: DISPLAY, fontWeight: "700", textAlign: "center" }} />
            <Text style={{ color: t.ink2, marginTop: 4, textAlign: "center", fontSize: 14.4 }}>
              {c.code}
              {rr ? " · " : ""}
              {markIcon(c, t)}
              {rr ? <Text style={{ color: RARCOL[rr] || t.ink, fontWeight: "700" }}>{RARITY[rr] || rr}</Text> : null}
              {verParts(c).map((vp) => (
                <Text key={vp}>
                  {" · "}
                  <Text style={/foil/i.test(vp) ? { color: "#c77dff", fontWeight: "700" } : undefined}>{vp}</Text>
                </Text>
              ))}
              {vers.length > 1 ? " · " + (copies === 1 ? "1 copia in tutto" : copies + " copie in tutto") : ""}
            </Text>
            {isAce(c) && <Text style={{ color: t.ink2, fontSize: 11.8, marginTop: 6, textAlign: "center" }}>* ACE è il simbolo stampato accanto al nome delle carte Digimon ACE: non fa parte del nome della carta.</Text>}
          </View>

          {/* una riga di dati */}
          <View style={{ flexDirection: "row", marginBottom: 10, borderRadius: 14, borderWidth: 1, borderColor: t.line, backgroundColor: t.surface, overflow: "hidden" }}>
            {(
              [
                ["Tipo", c.ct],
                ["Livello", c.lv],
                ["Costo", c.ct === "Digimon/Option" ? "" : c.play],
                ["DP", c.dp],
              ] as [string, string][]
            )
              .filter(([, v]) => v)
              .map(([l, v]) => (
                <DataCell key={l} label={l} value={v} />
              ))}
            {c.colors.length > 0 && (
              <View style={{ flex: 1, paddingVertical: 8, paddingHorizontal: 4, gap: 2, alignItems: "center", borderLeftWidth: 1, borderColor: t.line }}>
                <Text style={CDL(t)}>Colore</Text>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, minHeight: 22 }}>
                  {c.colors.map((x) => (
                    <View key={x} style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.cards[x] }} />
                  ))}
                  {c.colors.length === 1 && <Text style={{ color: t.ink, fontWeight: "600", fontSize: 15.2 }}>{c.colors[0]}</Text>}
                </View>
              </View>
            )}
          </View>

          {/* forma | attribute | trait come sulla carta stampata */}
          {idGroups.length > 0 && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, marginBottom: 10, justifyContent: "center" }}>
              {idGroups.map((g, gi) => (
                <View key={gi} style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                  {gi > 0 && <View style={{ width: 2, height: 18, borderRadius: 1, marginHorizontal: 2, backgroundColor: t.ink2, opacity: 0.55 }} />}
                  {g.map((v) => (
                    <View key={v} style={{ backgroundColor: t.surface2, borderRadius: 4.5, paddingHorizontal: 10, paddingVertical: 3 }}>
                      <Text style={{ color: t.ink, fontFamily: DISPLAY, fontWeight: "700", fontSize: 12.8, lineHeight: 17 }}>{v}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          )}

          {/* lista ban */}
          {deckable(c) && (mx < 2 || pairs) && (
            <View style={{ marginTop: -4, marginBottom: 12, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
              <View style={{ backgroundColor: mx === 0 ? "#c8102e" : mx === 1 ? "#d9661f" : "#8a4bd8", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, maxWidth: "100%" }}>
                <Text style={{ color: "#fff", fontFamily: DISPLAY, fontWeight: "700", fontSize: 11.2, letterSpacing: 0.45, lineHeight: mx > 1 ? 18 : 15 }}>
                  {mx === 0 ? "Bandita" : mx === 1 ? "Limitata" : "Coppia vietata con "}
                  {mx > 1 &&
                    pairs!.map((o, i) => (
                      <Text key={o}>
                        {i ? " o " : ""}
                        <Text onPress={() => BYCODE[o] && openCard(BYCODE[o][0])} suppressHighlighting style={{ textDecorationLine: "underline" }}>
                          {o + " " + (BYCODE[o] ? BYCODE[o][0].name : "")}
                        </Text>
                      </Text>
                    ))}
                </Text>
              </View>
            </View>
          )}

          {/* digievoluzioni */}
          {evo.length > 0 || ex.alt.length > 0 || ex.spec.length > 0 ? (
            <View style={{ gap: 8, marginBottom: 12 }}>
              {evo.length > 0 && <Evo key={c.k + "e1"} title="Digievoluzione" text={evo.join(" • ")} />}
              {ex.alt.length > 0 && <Evo key={c.k + "e2"} title="Altra Digievoluzione" text={ex.alt.join(" • ")} one />}
              {ex.spec.length > 0 && <Evo key={c.k + "e3"} title="Digievoluzione speciale" text={ex.spec.join(" • ")} />}
            </View>
          ) : null}

          {/* effetti e regole */}
          {fx
            .filter(([, v]) => v)
            .map(([title, v, sd]) => (
              <Box key={c.k + "|" + title} title={title} text={kwJoin(kwNoRem(v))} side={sd} ldp={title === "Regole Link" ? ex.ldp : ""} />
            ))}

          {/* prezzi affiancati: il valore apre il negozio, il resto apre/chiude i dettagli */}
          {(cmCovered(c) || ctCovered(c)) && (
            <View style={{ marginTop: 4, marginBottom: 12 }}>
              <Text style={H3(t)}>Prezzi</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {cmCovered(c) && <PriceBox shop="cm" name="Cardmarket" val={cv} tag={cmOf(c) && cmOf(c)![1] == null && cmOf(c)![0] != null ? "Trend" : "Minimo"} url={cmUrl(c)} low={low === "cm"} open={cmOpen} toggle={() => setCmOpen(!cmOpen)} />}
                {ctCovered(c) && <PriceBox shop="ct" name="CardTrader" val={tv} tag="Minimo" url={ctUrl(c)} low={low === "ct"} open={ctOpen} toggle={() => setCtOpen(!ctOpen)} />}
              </View>
              {cmOpen && cmCovered(c) && (
                <PriceDetails
                  shop="cm"
                  title="Cardmarket"
                  rows={cmOf(c) ? [["Trend", eur(cmOf(c)![0])], ["Media 1 g", eur(cmOf(c)![2])], ["Media 7 g", eur(cmOf(c)![3])], ["Media 30 g", eur(cmOf(c)![4])]] : []}
                  note={cmOf(c) ? "Prezzi aggiornati al: " + cmDate() + ".\nSi intendono dati medi di tutte le vendite, che non distinguono lingua o condizioni della carta." : "Questa versione non è stata abbinata con certezza al prodotto giusto su Cardmarket."}
                />
              )}
              {ctOpen && ctCovered(c) && (
                <PriceDetails
                  shop="ct"
                  title="CardTrader"
                  rows={[["Lingua", "Inglese"], ["Condizione", "Near Mint"]].concat(ctOf(c) && ctOf(c)![0] != null && ctOf(c)!.length > 3 ? [["Venditore", countryName(ctOf(c)![3])], ["CardTrader Zero", ctOf(c)![4] ? "Sì" : "No"]] : [])}
                  note={(ctVal(c) == null ? "Al momento su CardTrader non c'è nessuna offerta per questa carta in inglese in condizione Near Mint.\n" : "") + "Prezzi aggiornati al: " + ctDate() + "."}
                />
              )}
            </View>
          )}

          {/* pre errata */}
          {hasErrata(c) && (
            <View style={{ marginTop: 26 }}>
              <Text style={H3(t)}>Pre errata</Text>
              <Text style={{ color: t.ink2, fontSize: 13, marginBottom: 8 }}>Versione stampata prima dell'errata ufficiale</Text>
              <Image source={preUrl(c)} style={{ width: "60%", aspectRatio: 0.716, borderRadius: 10 }} contentFit="contain" cachePolicy="disk" />
            </View>
          )}
        </View>
        </Animated.View>
      </ScrollView>
      {/* barra fissa in basso: copie nel mazzo (se aperta dall'editor) e copie possedute della versione aperta */}
      {dk && deckable(c) && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingTop: 10, borderTopWidth: 1, borderColor: t.line, backgroundColor: t.surface }}>
          <View style={{ flex: 1, paddingLeft: 2 }}>
            <Text style={{ color: t.ink, fontWeight: "600", lineHeight: 19 }}>Copie nel mazzo</Text>
            <Text style={{ color: t.ink2, fontSize: 12.8, lineHeight: 16 }} numberOfLines={1}>
              {dk.name}
            </Text>
          </View>
          <DeckQty key={c.k} d={dk} c={c} big />
        </View>
      )}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingTop: dk ? 8 : 10, paddingBottom: 10 + insB, borderTopWidth: dk ? 0 : 1, borderColor: t.line, backgroundColor: t.surface }}>
        <View style={{ flex: 1, paddingLeft: 2 }}>
          <Text style={{ color: t.ink, fontWeight: "600", lineHeight: 19 }}>Copie possedute</Text>
          <Text style={{ color: t.ink2, fontSize: 12.8, lineHeight: 16 }}>{verName(c)}</Text>
        </View>
        {dk && !unlocked ? (
          <Pressable onPress={() => setUnlocked(true)} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: t.surface2 }} accessibilityLabel="Sblocca la modifica della collezione">
            <Lock color={t.ink2} />
            <Text style={{ color: t.ink, fontWeight: "800" }}>{owned(c)}</Text>
          </Pressable>
        ) : (
          <QtyControl key={c.k} c={c} big />
        )}
      </View>
      <FavSheet c={favFor} onClose={() => setFavFor(null)} />
    </SafeAreaView>
  );
}

// nome della versione: Regular, oppure "Alt-Art" seguito da ★, ★★ o SP; codice del prodotto se è di un altro
function verName(a: Card) {
  const fs = SETBY[hostSet(a)],
    bs = SETBY[a.set];
  const pre = fs && bs && fs.id !== bs.id ? fs.code + " " : "";
  const mk = a.mark === 1 ? "★" : a.mark === 2 ? "★★" : a.mark === "SP" ? "SP" : "";
  if (!a.suf) return pre + "Regular";
  if (mk || /alternative art/i.test(a.ver || "")) return pre + "Alt-Art" + (mk ? " " + mk : "");
  const v = a.ver && a.ver !== "Normal" ? (/pre release/i.test(a.ver) ? "Pre-release" : a.ver) : "";
  return pre + (v || "Alt-Art");
}
const RN: Record<string, 1> = {};
Object.values(RARITY).forEach((v) => (RN[v.toLowerCase()] = 1));
function verParts(c: Card) {
  if (!c.suf || !c.ver || c.ver === "Normal") return [];
  return c.ver.split(/\s*-\s*/).filter((vp) => !RN[vp.toLowerCase()] && !/^(promo|rare|alternative art)$/i.test(vp));
}
// ★, ★★ (sfalsate) e SP davanti alla rarità, come .st1/.st2/.spb del sito: stelle del colore della rarità, SP su fondo grigio
function markIcon(c: Card, t: any) {
  if (!c.suf || !c.mark) return null;
  const col = RARCOL[(c.rar || "").trim()] || t.ink;
  const f = 14.4;
  if (c.mark === "SP")
    return (
      <View style={{ marginRight: 5, transform: [{ translateY: -0.05 * f }], borderRadius: 0.6 * f * 0.28, backgroundColor: t.ink2, paddingHorizontal: 0.6 * f * 0.24, paddingVertical: 0.6 * f * 0.12 }}>
        <Text style={{ color: t.dark ? "#0b1120" : "#ffffff", fontWeight: "700", fontSize: 0.6 * f, lineHeight: 0.6 * f * 1.05 }}>SP</Text>
      </View>
    );
  if (c.mark === 2)
    return (
      <View style={{ flexDirection: "row", marginRight: 5, transform: [{ translateY: 0.18 * f }] }}>
        <Text style={{ color: col, fontWeight: "700", fontSize: 0.74 * f, lineHeight: 0.74 * f, transform: [{ translateY: -0.32 * 0.74 * f }] }}>★</Text>
        <Text style={{ color: col, fontWeight: "700", fontSize: 0.74 * f, lineHeight: 0.74 * f, marginLeft: -0.05 * 0.74 * f, transform: [{ translateY: 0.28 * 0.74 * f }] }}>★</Text>
      </View>
    );
  return <Text style={{ color: col, fontWeight: "700", fontSize: 0.8 * f }}>{"★ "}</Text>;
}
// nazioni dei venditori CardTrader (il motore JavaScript di Android non ha i nomi delle nazioni: si usa questa tabella)
const NAZ: Record<string, string> = {
  IT: "Italia", DE: "Germania", FR: "Francia", ES: "Spagna", NL: "Paesi Bassi", BE: "Belgio", AT: "Austria", PT: "Portogallo", GB: "Regno Unito", UK: "Regno Unito", IE: "Irlanda",
  US: "Stati Uniti", CA: "Canada", JP: "Giappone", PL: "Polonia", CH: "Svizzera", LU: "Lussemburgo", DK: "Danimarca", SE: "Svezia", FI: "Finlandia", NO: "Norvegia",
  CZ: "Repubblica Ceca", SK: "Slovacchia", SI: "Slovenia", HR: "Croazia", HU: "Ungheria", RO: "Romania", BG: "Bulgaria", GR: "Grecia", CY: "Cipro", MT: "Malta",
  EE: "Estonia", LV: "Lettonia", LT: "Lituania", SG: "Singapore", HK: "Hong Kong", KR: "Corea del Sud", TW: "Taiwan", CN: "Cina", AU: "Australia", NZ: "Nuova Zelanda",
  MX: "Messico", BR: "Brasile", SM: "San Marino", MC: "Monaco", LI: "Liechtenstein", IS: "Islanda", TH: "Thailandia", MY: "Malesia", PH: "Filippine", ID: "Indonesia",
};
let REGN: any = null;
try {
  REGN = new (Intl as any).DisplayNames(["it"], { type: "region" });
} catch (e) {
  REGN = null;
}
function countryName(cc?: string) {
  if (!cc) return "—";
  try {
    const u = cc.toUpperCase();
    return NAZ[u] || (REGN ? REGN.of(u) : u);
  } catch (e) {
    return cc;
  }
}

const RARCOL: Record<string, string> = { C: "#9aa4b6", U: "#3fbf75", R: "#4c8dff", SR: "#b06bff", SEC: "#f2b230", UR: "#ff5470", P: "#2fc6c0" };
const headBtn = (t: any) => ({ width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: t.line, backgroundColor: t.surface, alignItems: "center" as const, justifyContent: "center" as const });
// titoletto delle sezioni (.fx h3)
const H3 = (t: any) => ({ color: t.ink2, fontFamily: DISPLAY, fontWeight: "500" as const, fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase" as const, marginBottom: 4 });
// etichetta della riga di dati (.cdc > span)
const CDL = (t: any) => ({ color: t.ink2, fontFamily: DISPLAY, fontWeight: "600" as const, fontSize: 10.6, letterSpacing: 0.85, textTransform: "uppercase" as const });

// cuore nel riquadro (.favb.big): arancione con lo sfondo tenue se preferita
function FavBig({ c }: { c: Card }) {
  const t = useTheme();
  useStore();
  const on = isFav(c);
  return (
    <Pressable
      onPress={() => {
        favSet(c, !on);
        favToast(c, !on);
      }}
      accessibilityLabel={on ? "Togli dalle preferite" : "Aggiungi alle preferite"}
      accessibilityState={{ selected: on }}
      style={[headBtn(t), on ? { borderColor: t.accent, backgroundColor: t.accentSoft } : null]}
    >
      <Heart on={on} size={20} color={on ? t.accent : t.ink} />
    </Pressable>
  );
}

function DataCell({ label, value }: { label: string; value: string }) {
  const t = useTheme();
  return (
    <View style={{ flex: label === "Tipo" && value.length > 8 ? 2 : 1, minWidth: 0, paddingVertical: 8, paddingHorizontal: 4, gap: 2, alignItems: "center", borderLeftWidth: label === "Tipo" ? 0 : 1, borderColor: t.line }}>
      <Text style={CDL(t)}>{label}</Text>
      <Text style={{ color: t.ink, fontWeight: "600", fontSize: 15.2, lineHeight: 22 }} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

// digievoluzione (.stat.wide.evo): etichetta e righe con le icone.
// one = "Altra Digievoluzione" (.l.fit.one del sito): si rimpicciolisce per stare su una riga (min 8 px), altrimenti va a capo
function Evo({ title, text, one }: { title: string; text: string; one?: boolean }) {
  const t = useTheme();
  const [avail, setAvail] = useState(0);
  const [nat, setNat] = useState(0);
  const fs = one && avail && nat > avail + 0.5 ? Math.max(8, Math.floor(((15 * avail) / nat) * 2) / 2) : 15;
  const st = { color: t.ink, fontFamily: DISPLAY, fontWeight: "600" as const, fontSize: fs, lineHeight: fs * 1.5 };
  return (
    <View style={{ backgroundColor: t.surface, borderColor: t.line, borderWidth: 1, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10 }}>
      <Text style={{ color: t.ink2, fontSize: 11.2, letterSpacing: 0.9, textTransform: "uppercase", lineHeight: 16 }}>{title}</Text>
      <View onLayout={one ? (e) => setAvail(e.nativeEvent.layout.width) : undefined}>
        {one && (
          <View style={{ position: "absolute", left: 0, top: 0, width: 4000, opacity: 0, flexDirection: "row" }} pointerEvents="none">
            <View onLayout={(e) => setNat(e.nativeEvent.layout.width)}>
              <Text style={{ color: t.ink, fontFamily: DISPLAY, fontWeight: "600", fontSize: 15, lineHeight: 22.5 }}>
                <RichInline text={text} fs={15} />
              </Text>
            </View>
          </View>
        )}
        <Rich text={text} style={st} />
      </View>
    </View>
  );
}

function Box({ title, text, side, ldp }: { title: string; text: string; side?: any; ldp?: string }) {
  const t = useTheme();
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={H3(t)}>{title}</Text>
      <View style={{ backgroundColor: t.surface, borderColor: t.line, borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 }}>
      {side && (side.c || side.col) ? (
        <Text style={{ color: t.ink, fontSize: 15, lineHeight: 22 }}>
          {side.c ? <Chip text={"Use " + side.c} cls="tim" fs={15} /> : null}
          {(side.col || "")
            .split("/")
            .filter(Boolean)
            .map((x: string) => (
              <Chip key={x} text={x} cls="col" fs={15} bg={t.cards[x]} ink={x === "White" ? "#111" : "#fff"} />
            ))}
        </Text>
      ) : null}
      <Rich text={text} style={{ color: t.ink, fontSize: 15, lineHeight: 22 }} />
      {!!ldp && (
        <View style={{ flexDirection: "row", alignSelf: "flex-start", alignItems: "center", gap: 8, marginTop: 4, paddingVertical: 3, paddingLeft: 4, paddingRight: 10, borderRadius: 8, backgroundColor: t.surface2 }}>
          <View style={{ borderRadius: 6, overflow: "hidden", paddingHorizontal: 11.5 * 0.55, paddingVertical: 11.5 * 0.15 }}>
            <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
              <Defs>
                <LinearGradient id="ldpg" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset={0} stopColor="#14ad96" />
                  <Stop offset={1} stopColor="#0a7a6a" />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#ldpg)" />
            </Svg>
            <Text style={{ color: "#fff", fontFamily: DISPLAY, fontWeight: "700", fontSize: 11.5, letterSpacing: 0.7, lineHeight: 15 }}>LINK DP</Text>
          </View>
          <Text style={{ color: t.ink, fontFamily: DISPLAY, fontWeight: "700", fontSize: 16 }}>{ldp}</Text>
        </View>
      )}
      </View>
    </View>
  );
}

function PriceBox({ shop, name, val, tag, url, low, open, toggle }: { shop: "cm" | "ct"; name: string; val: number | null; tag: string; url: string | null; low: boolean; open: boolean; toggle: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={toggle} accessibilityState={{ expanded: open }} accessibilityLabel={"Dettagli prezzo " + name} style={{ flex: 1, minWidth: 0, gap: 2, backgroundColor: t.surface, borderColor: open ? t.ink2 : t.line, borderWidth: 1, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {shop === "cm" ? <CmMark size={18} /> : <CtMark size={18} />}
        <Text style={{ color: t.ink2, fontSize: 13.6, fontWeight: "600", flexShrink: 1 }} numberOfLines={1}>
          {name}
        </Text>
        <View style={{ marginLeft: "auto" }}>
          <Chevron color={t.ink2} up={open} size={16} />
        </View>
      </View>
      <Text onPress={url && val != null ? () => Linking.openURL(url) : undefined} style={{ color: val == null ? t.ink2 : t.ink, fontFamily: DISPLAY, fontWeight: val == null ? "500" : "700", fontSize: 21.6, lineHeight: 27, fontVariant: ["tabular-nums"] }}>
        {val == null ? "N/D" : eurN(val) + " €"}
      </Text>
      <Text style={{ color: t.ink2, fontSize: 11.8, lineHeight: 15 }}>
        {val == null ? "Non disponibile" : tag}
        {low ? (
          <Text style={{ color: t.ok, fontWeight: "600" }}>
            {" · "}
            più basso
          </Text>
        ) : null}
      </Text>
    </Pressable>
  );
}

function PriceDetails({ shop, title, rows, note }: { shop: "cm" | "ct"; title: string; rows: string[][]; note: string }) {
  const t = useTheme();
  return (
    <View style={{ marginTop: 8, backgroundColor: t.surface, borderColor: t.line, borderWidth: 1, borderRadius: 14, paddingTop: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingBottom: 8 }}>
        {shop === "cm" ? <CmMark size={18} /> : <CtMark size={18} />}
        <Text style={{ color: t.ink, fontWeight: "600", fontSize: 14.1 }}>{title}</Text>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: 12 }}>
        {rows.map(([a, b]) => (
          <View key={a} style={{ width: "48.5%", flexGrow: 1, flexDirection: "row", justifyContent: "space-between", gap: 8, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 8, backgroundColor: t.surface2 }}>
            <Text style={{ color: t.ink2, fontSize: 12.5 }}>{a}</Text>
            <Text style={{ color: t.ink, fontWeight: "600", fontSize: 12.5, flexShrink: 1 }} numberOfLines={1}>
              {b}
            </Text>
          </View>
        ))}
      </View>
      {note.split("\n").map((n, i) => (
        <Text key={i} style={{ color: t.ink2, fontSize: 11.5, lineHeight: 16, paddingHorizontal: 12, paddingTop: i ? 0 : 6, paddingBottom: 10 }}>
          {n}
        </Text>
      ))}
    </View>
  );
}
