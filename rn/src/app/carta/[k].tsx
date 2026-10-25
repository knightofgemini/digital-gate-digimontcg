// Scheda carta (proposta "C - Carosello" dell'app attuale): con il dito a destra/sinistra la carta precedente/successiva
// dell'elenco da cui è stata aperta; versioni come pulsanti; nome, codice e rarità; una riga di dati; tratti;
// digievoluzioni ed effetti con le icone; prezzi; pre errata. Testi delle carte in inglese, etichette in italiano.
import { useMemo, useRef, useState } from "react";
import { FlatList, Linking, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { DISPLAY, Text } from "../../Text";
import Svg, { Path } from "react-native-svg";
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
import { ICO, Rich, iconClass, kwJoin, kwNoRem } from "../../rich";
import { FavSheet } from "../../FavSheet";
import { Heart, ListsIcon, QtyControl } from "../../items";
import { favSet, isFav, owned, useStore } from "../../store";
import { deckById } from "../../decks";
import { DeckQty, Lock } from "../../DeckQty";
import { useTheme } from "../../theme";

export default function Carta() {
  const { k, deck } = useLocalSearchParams<{ k: string; deck?: string }>();
  const c0 = BYKEY[k];
  const { width, height } = useWindowDimensions();
  // altezza reale dello spazio della scheda: ogni pagina del carosello la riempie (barre delle copie fisse in basso)
  const [h, setH] = useState(height);
  usePrices();
  // elenco per scorrere: quello da cui si è aperta la scheda (anche se si apre una sua versione)
  const list = useMemo(() => {
    if (!c0) return [];
    if (NAVLIST.indexOf(c0) >= 0) return NAVLIST;
    const vs = carVers(c0);
    return NAVLIST.some((x) => vs.indexOf(x) >= 0) ? NAVLIST : [c0];
  }, [k]);
  const start = Math.max(
    0,
    list.findIndex((x) => x === c0 || carVers(c0).indexOf(x) >= 0)
  );
  const ref = useRef<any>(null);
  if (!c0) return null;
  const goTo = (i: number) => ref.current && ref.current.scrollToIndex({ index: i, animated: true });
  return (
    <FlatList
      ref={ref}
      data={list}
      onLayout={(e) => setH(e.nativeEvent.layout.height)}
      style={{ flex: 1 }}
      horizontal
      pagingEnabled
      initialScrollIndex={start}
      getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
      keyExtractor={(x) => x.k}
      showsHorizontalScrollIndicator={false}
      windowSize={3}
      initialNumToRender={1}
      maxToRenderPerBatch={2}
      renderItem={({ item, index }) => <CardPage first={index === start ? c0 : item} width={width} height={h} deck={deck} prev={list[index - 1]} next={list[index + 1]} onNav={(d) => goTo(index + d)} />}
    />
  );
}

function CardPage({ first, width, height, deck, prev, next, onNav }: { first: Card; width: number; height: number; deck?: string; prev?: Card; next?: Card; onNav: (d: number) => void }) {
  const t = useTheme();
  const [c, setC] = useState(first);
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
    <SafeAreaView style={{ width, height, backgroundColor: t.bg }} edges={["top"]}>
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
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 14, width: maxW, alignSelf: "center" }} nestedScrollEnabled>
        <View style={{ marginTop: 4, marginBottom: 4, paddingTop: 14, paddingBottom: 6, alignItems: "center", overflow: "hidden" }}>
          {vers.length > 1 ? <View style={{ position: "absolute", top: 8, bottom: 30, width: cw - 36, borderRadius: 12, backgroundColor: t.surface2, borderWidth: 1, borderColor: t.line }} /> : null}
          {prev ? (
            <Pressable onPress={() => onNav(-1)} accessibilityLabel={"Carta precedente: " + prev.name + " (" + prev.code + ")"} style={{ position: "absolute", top: 14 + (cw * 1.4) / 2 - cw * 0.56, right: maxW / 2 + cw / 2 + 12, width: cw * 0.8, aspectRatio: 5 / 7, borderRadius: 10, overflow: "hidden", backgroundColor: t.surface2, opacity: 0.5 }}>
              <Image source={fullUrl(prev)} placeholder={thumbUrl(prev)} style={{ width: "100%", height: "100%" }} contentFit="contain" cachePolicy="disk" />
            </Pressable>
          ) : null}
          {next ? (
            <Pressable onPress={() => onNav(1)} accessibilityLabel={"Carta successiva: " + next.name + " (" + next.code + ")"} style={{ position: "absolute", top: 14 + (cw * 1.4) / 2 - cw * 0.56, left: maxW / 2 + cw / 2 + 12, width: cw * 0.8, aspectRatio: 5 / 7, borderRadius: 10, overflow: "hidden", backgroundColor: t.surface2, opacity: 0.5 }}>
              <Image source={fullUrl(next)} placeholder={thumbUrl(next)} style={{ width: "100%", height: "100%" }} contentFit="contain" cachePolicy="disk" />
            </Pressable>
          ) : null}
          <View style={{ width: cw, aspectRatio: 5 / 7, borderRadius: 12, overflow: "hidden", backgroundColor: t.surface2, boxShadow: t.dark ? "0 2px 6px rgba(0,0,0,.30), 0 10px 22px -6px rgba(0,0,0,.50)" : "0 1px 3px rgba(15,26,46,.10), 0 6px 16px -2px rgba(15,26,46,.16)" }}>
            <Image source={fullUrl(c)} placeholder={thumbUrl(c)} placeholderContentFit="contain" style={{ width: "100%", height: "100%" }} contentFit="contain" cachePolicy="disk" transition={150} recyclingKey={c.k} />
          </View>
        </View>

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
          {deckable(c) && (mx < 4 || pairs) && (
            <View style={{ marginBottom: 12, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
              <View style={{ backgroundColor: mx === 0 ? "#c0261e" : mx === 1 ? "#c77a0a" : "#7a3fb0", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12 }}>{mx === 0 ? "Bandita" : mx === 1 ? "Limitata" : "Coppia vietata con"}</Text>
              </View>
              {mx > 1 &&
                pairs!.map((o) => (
                  <Pressable key={o} onPress={() => BYCODE[o] && openCard(BYCODE[o][0])}>
                    <Text style={{ color: t.accent, fontWeight: "700", textDecorationLine: "underline" }}>
                      {o} {BYCODE[o] ? BYCODE[o][0].name : ""}
                    </Text>
                  </Pressable>
                ))}
            </View>
          )}

          {/* digievoluzioni */}
          {evo.length > 0 || ex.alt.length > 0 || ex.spec.length > 0 ? (
            <View style={{ gap: 8, marginBottom: 12 }}>
              {evo.length > 0 && <Evo title="Digievoluzione" text={evo.join(" • ")} />}
              {ex.alt.length > 0 && <Evo title="Altra Digievoluzione" text={ex.alt.join(" • ")} />}
              {ex.spec.length > 0 && <Evo title="Digievoluzione speciale" text={ex.spec.join(" • ")} />}
            </View>
          ) : null}

          {/* effetti e regole */}
          {fx
            .filter(([, v]) => v)
            .map(([title, v, sd]) => (
              <Box key={title} title={title} text={kwJoin(kwNoRem(v))} side={sd} ldp={title === "Regole Link" ? ex.ldp : ""} />
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
          <DeckQty d={dk} c={c} big />
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
          <QtyControl c={c} big />
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
function markIcon(c: Card, t: any) {
  if (!c.suf || !c.mark) return null;
  if (c.mark === "SP")
    return (
      <Text style={{ backgroundColor: "#d4a017", color: "#111", fontWeight: "800" }}>
        {" SP "}
      </Text>
    );
  return <Text style={{ color: "#f0c43a", fontWeight: "800" }}>{(c.mark === 2 ? "★★" : "★") + " "}</Text>;
}
let REGN: any = null;
try {
  REGN = new (Intl as any).DisplayNames(["it"], { type: "region" });
} catch (e) {
  REGN = null;
}
function countryName(cc?: string) {
  if (!cc) return "—";
  try {
    return REGN ? REGN.of(cc.toUpperCase()) : cc;
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

// digievoluzione (.stat.wide.evo): etichetta e righe con le icone
function Evo({ title, text }: { title: string; text: string }) {
  const t = useTheme();
  return (
    <View style={{ backgroundColor: t.surface, borderColor: t.line, borderWidth: 1, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10 }}>
      <Text style={{ color: t.ink2, fontSize: 11.2, letterSpacing: 0.9, textTransform: "uppercase", lineHeight: 16 }}>{title}</Text>
      <Rich text={text} style={{ color: t.ink, fontFamily: DISPLAY, fontWeight: "600", fontSize: 15, lineHeight: 22 }} />
    </View>
  );
}

function Box({ title, text, side, ldp }: { title: string; text: string; side?: any; ldp?: string }) {
  const t = useTheme();
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={H3(t)}>{title}</Text>
      <View style={{ backgroundColor: t.surface, borderColor: t.line, borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 }}>
      {side && (
        <View style={{ flexDirection: "row", gap: 4, marginBottom: 6 }}>
          {side.c ? (
            <Text style={{ backgroundColor: ICO.tim[0], color: "#fff", fontWeight: "700", fontSize: 12 }}>
              {" Use " + side.c + " "}
            </Text>
          ) : null}
          {(side.col || "")
            .split("/")
            .filter(Boolean)
            .map((x: string) => (
              <Text key={x} style={{ backgroundColor: t.cards[x], color: x === "White" || x === "Yellow" ? "#111" : "#fff", fontWeight: "700", fontSize: 12 }}>
                {" " + x + " "}
              </Text>
            ))}
        </View>
      )}
      <Rich text={text} style={{ color: t.ink, fontSize: 15, lineHeight: 22 }} />
      {!!ldp && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
          <View style={{ backgroundColor: ICO.grn[0], borderRadius: 5, paddingHorizontal: 7, paddingVertical: 1 }}>
            <Text style={{ color: "#fff", fontFamily: DISPLAY, fontWeight: "700", fontSize: 12 }}>LINK DP</Text>
          </View>
          <Text style={{ color: t.ink, fontFamily: DISPLAY, fontWeight: "700" }}>{ldp}</Text>
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
