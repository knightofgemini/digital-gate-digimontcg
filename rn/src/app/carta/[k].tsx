// Scheda carta (proposta "C - Carosello" dell'app attuale): con il dito a destra/sinistra la carta precedente/successiva
// dell'elenco da cui è stata aperta; versioni come pulsanti; nome, codice e rarità; una riga di dati; tratti;
// digievoluzioni ed effetti con le icone; prezzi; pre errata. Testi delle carte in inglese, etichette in italiano.
import { useMemo, useState } from "react";
import { FlatList, Linking, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { BYKEY, Card, PAIRS, BYCODE, RARITY, SETBY, carVers, deckable, fullUrl, hasErrata, hostSet, isAce, maxCopies, preUrl, splitExtra, thumbUrl } from "../../data";
import { NAVLIST, openCard } from "../../nav";
import { bestVal, cmCovered, cmDate, cmOf, cmUrl, cmVal, ctCovered, ctDate, ctOf, ctUrl, ctVal, eur, eurN, eurT, usePrices } from "../../prices";
import { ICO, Rich, iconClass, kwJoin, kwNoRem } from "../../rich";
import { useTheme } from "../../theme";

export default function Carta() {
  const { k } = useLocalSearchParams<{ k: string }>();
  const c0 = BYKEY[k];
  const { width } = useWindowDimensions();
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
  if (!c0) return null;
  return (
    <FlatList
      data={list}
      horizontal
      pagingEnabled
      initialScrollIndex={start}
      getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
      keyExtractor={(x) => x.k}
      showsHorizontalScrollIndicator={false}
      windowSize={3}
      initialNumToRender={1}
      maxToRenderPerBatch={2}
      renderItem={({ item, index }) => <CardPage first={index === start ? c0 : item} width={width} />}
    />
  );
}

function CardPage({ first, width }: { first: Card; width: number }) {
  const t = useTheme();
  const [c, setC] = useState(first);
  const [cmOpen, setCmOpen] = useState(false);
  const [ctOpen, setCtOpen] = useState(false);
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
  const colBg = t.cards[c.colors[0]] || t.surface2;

  return (
    <SafeAreaView style={{ width, flex: 1, backgroundColor: t.bg }} edges={["top"]}>
      {/* intestazione: chiusura, nome del prodotto con "Carta N di M" */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 8 }}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/carte"))} hitSlop={12} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: t.surface2, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: t.ink, fontSize: 18, fontWeight: "700" }}>✕</Text>
        </Pressable>
        <View style={{ flex: 1, alignItems: "center", marginRight: 48 }}>
          <Text style={{ color: t.ink, fontWeight: "800" }} numberOfLines={1}>
            {hs ? hs.name : ""}
          </Text>
          {hs && hs.n && num && c.code.split("-")[0] === hs.code && num <= hs.n ? <Text style={{ color: t.ink2, fontSize: 12 }}>{"Carta " + num + " di " + hs.n}</Text> : null}
        </View>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 40, width: maxW, alignSelf: "center" }} nestedScrollEnabled>
        {/* carta grande sul colore della carta */}
        <View style={{ marginHorizontal: 16, borderRadius: 18, paddingVertical: 18, alignItems: "center", backgroundColor: colBg + "33" }}>
          <Image source={fullUrl(c)} placeholder={thumbUrl(c)} placeholderContentFit="contain" style={{ width: "72%", aspectRatio: 0.716, borderRadius: 12 }} contentFit="contain" cachePolicy="disk" transition={150} recyclingKey={c.k} />
        </View>

        {/* versioni */}
        {vers.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingTop: 12 }}>
            {vers.map((a) => {
              const on = a.k === c.k;
              const bv = bestVal(a);
              return (
                <Pressable key={a.k} onPress={() => setC(a)} style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 6, paddingRight: 12, borderRadius: 12, borderWidth: on ? 2 : 1, borderColor: on ? t.accent : t.line, backgroundColor: t.surface }}>
                  <Image source={thumbUrl(a)} style={{ width: 30, height: 42, borderRadius: 3 }} cachePolicy="disk" />
                  <View>
                    <Text style={{ color: t.ink, fontWeight: "700", fontSize: 13 }}>{verName(a)}</Text>
                    <Text style={{ color: t.ink2, fontSize: 12 }}>{bv == null ? "N/D" : eurT(bv)}</Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        <View style={{ paddingHorizontal: 16 }}>
          {/* nome, codice, rarità e versione */}
          <View style={{ alignItems: "center", marginTop: 14 }}>
            <Text style={{ color: t.ink, fontSize: 24, fontWeight: "800", textAlign: "center" }} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.55}>
              {c.name}
              {isAce(c) ? <Text style={{ color: t.accent }}> ACE*</Text> : null}
            </Text>
            <Text style={{ color: t.ink2, marginTop: 4, textAlign: "center" }}>
              {c.code}
              {rr ? " · " : ""}
              {markIcon(c, t)}
              {rr ? <Text style={{ color: t.ink, fontWeight: "700" }}>{RARITY[rr] || rr}</Text> : null}
              {verParts(c).map((vp) => (
                <Text key={vp}>
                  {" · "}
                  <Text style={/foil/i.test(vp) ? { color: "#c77dff", fontWeight: "700" } : undefined}>{vp}</Text>
                </Text>
              ))}
            </Text>
            {isAce(c) && <Text style={{ color: t.ink2, fontSize: 12, marginTop: 6, textAlign: "center" }}>* ACE è il simbolo stampato accanto al nome delle carte Digimon ACE: non fa parte del nome della carta.</Text>}
          </View>

          {/* una riga di dati */}
          <View style={{ flexDirection: "row", marginTop: 14, borderRadius: 12, borderWidth: 1, borderColor: t.line, backgroundColor: t.surface, overflow: "hidden" }}>
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
              <View style={{ flex: 1, padding: 8, alignItems: "center", borderLeftWidth: 1, borderColor: t.line }}>
                <Text style={{ color: t.ink2, fontSize: 11 }}>Colore</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 3, marginTop: 4 }}>
                  {c.colors.map((x) => (
                    <View key={x} style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: t.cards[x] }} />
                  ))}
                  {c.colors.length === 1 && <Text style={{ color: t.ink, fontWeight: "700", fontSize: 13 }}>{c.colors[0]}</Text>}
                </View>
              </View>
            )}
          </View>

          {/* forma | attribute | trait come sulla carta stampata */}
          {idGroups.length > 0 && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 12, justifyContent: "center" }}>
              {idGroups.map((g, gi) => (
                <View key={gi} style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                  {gi > 0 && <View style={{ width: 1, height: 16, backgroundColor: t.line }} />}
                  {g.map((v) => (
                    <View key={v} style={{ backgroundColor: t.surface2, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                      <Text style={{ color: t.ink, fontWeight: "700", fontSize: 12 }}>{v}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          )}

          {/* lista ban */}
          {deckable(c) && (mx < 4 || pairs) && (
            <View style={{ marginTop: 12, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, justifyContent: "center" }}>
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
          {evo.length > 0 && <Box title="Digievoluzione" text={evo.join(" • ")} />}
          {ex.alt.length > 0 && <Box title="Altra Digievoluzione" text={ex.alt.join(" • ")} />}
          {ex.spec.length > 0 && <Box title="Digievoluzione speciale" text={ex.spec.join(" • ")} />}

          {/* effetti e regole */}
          {fx
            .filter(([, v]) => v)
            .map(([title, v, sd]) => (
              <Box key={title} title={title} text={kwJoin(kwNoRem(v))} side={sd} ldp={title === "Regole Link" ? ex.ldp : ""} />
            ))}

          {/* prezzi affiancati: il valore apre il negozio, il resto apre/chiude i dettagli */}
          {(cmCovered(c) || ctCovered(c)) && (
            <View style={{ marginTop: 14 }}>
              <Text style={{ color: t.accent, fontWeight: "800", marginBottom: 8 }}>Prezzi</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {cmCovered(c) && <PriceBox name="Cardmarket" val={cv} tag={cmOf(c) && cmOf(c)![1] == null && cmOf(c)![0] != null ? "Trend" : "Minimo"} url={cmUrl(c)} low={low === "cm"} open={cmOpen} toggle={() => setCmOpen(!cmOpen)} />}
                {ctCovered(c) && <PriceBox name="CardTrader" val={tv} tag="Minimo" url={ctUrl(c)} low={low === "ct"} open={ctOpen} toggle={() => setCtOpen(!ctOpen)} />}
              </View>
              {cmOpen && cmCovered(c) && (
                <PriceDetails
                  title="Cardmarket"
                  rows={cmOf(c) ? [["Trend", eur(cmOf(c)![0])], ["Media 1 g", eur(cmOf(c)![2])], ["Media 7 g", eur(cmOf(c)![3])], ["Media 30 g", eur(cmOf(c)![4])]] : []}
                  note={cmOf(c) ? "Prezzi aggiornati al: " + cmDate() + ".\nSi intendono dati medi di tutte le vendite, che non distinguono lingua o condizioni della carta." : "Questa versione non è stata abbinata con certezza al prodotto giusto su Cardmarket."}
                />
              )}
              {ctOpen && ctCovered(c) && (
                <PriceDetails
                  title="CardTrader"
                  rows={[["Lingua", "Inglese"], ["Condizione", "Near Mint"]].concat(ctOf(c) && ctOf(c)![0] != null && ctOf(c)!.length > 3 ? [["Venditore", countryName(ctOf(c)![3])], ["CardTrader Zero", ctOf(c)![4] ? "Sì" : "No"]] : [])}
                  note={(ctVal(c) == null ? "Al momento su CardTrader non c'è nessuna offerta per questa carta in inglese in condizione Near Mint.\n" : "") + "Prezzi aggiornati al: " + ctDate() + "."}
                />
              )}
            </View>
          )}

          {/* pre errata */}
          {hasErrata(c) && (
            <View style={{ marginTop: 14 }}>
              <Text style={{ color: t.accent, fontWeight: "800", marginBottom: 8 }}>Pre errata</Text>
              <Text style={{ color: t.ink2, fontSize: 13, marginBottom: 8 }}>Versione stampata prima dell'errata ufficiale</Text>
              <Image source={preUrl(c)} style={{ width: "60%", aspectRatio: 0.716, borderRadius: 10 }} contentFit="contain" cachePolicy="disk" />
            </View>
          )}
        </View>
      </ScrollView>
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

function DataCell({ label, value }: { label: string; value: string }) {
  const t = useTheme();
  return (
    <View style={{ flex: label === "Tipo" && value.length > 6 ? (value.length > 8 ? 2.1 : 1.6) : 1, padding: 8, alignItems: "center", borderLeftWidth: label === "Tipo" ? 0 : 1, borderColor: t.line }}>
      <Text style={{ color: t.ink2, fontSize: 11 }}>{label}</Text>
      <Text style={{ color: t.ink, fontWeight: "800", fontSize: 15, marginTop: 2 }} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

function Box({ title, text, side, ldp }: { title: string; text: string; side?: any; ldp?: string }) {
  const t = useTheme();
  return (
    <View style={{ backgroundColor: t.surface, borderColor: t.line, borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 10 }}>
      <Text style={{ color: t.accent, fontWeight: "800", marginBottom: 6 }}>{title}</Text>
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
      <Rich text={text} style={{ color: t.ink, fontSize: 14, lineHeight: 22 }} />
      {!!ldp && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
          <Text style={{ color: t.ink2, fontSize: 12 }}>Link DP</Text>
          <Text style={{ color: t.ink, fontWeight: "800" }}>{ldp}</Text>
        </View>
      )}
    </View>
  );
}

function PriceBox({ name, val, tag, url, low, open, toggle }: { name: string; val: number | null; tag: string; url: string | null; low: boolean; open: boolean; toggle: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={toggle} style={{ flex: 1, backgroundColor: t.surface, borderColor: open ? t.accent : t.line, borderWidth: 1, borderRadius: 12, padding: 12 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: t.ink2, fontSize: 12, fontWeight: "700" }}>{name}</Text>
        <Text style={{ color: t.ink2, fontSize: 12 }}>{open ? "▴" : "▾"}</Text>
      </View>
      <Text onPress={url && val != null ? () => Linking.openURL(url) : undefined} style={{ color: val == null ? t.ink2 : t.ink, fontSize: 20, fontWeight: "800", marginTop: 4, textDecorationLine: url && val != null ? "underline" : "none" }}>
        {val == null ? "N/D" : eurN(val) + " €"}
      </Text>
      <Text style={{ color: t.ink2, fontSize: 12, marginTop: 2 }}>
        {val == null ? "Non disponibile" : tag}
        {low ? <Text style={{ color: "#46bd73", fontWeight: "700" }}> · più basso</Text> : null}
      </Text>
    </Pressable>
  );
}

function PriceDetails({ title, rows, note }: { title: string; rows: string[][]; note: string }) {
  const t = useTheme();
  return (
    <View style={{ marginTop: 8, backgroundColor: t.surface, borderColor: t.line, borderWidth: 1, borderRadius: 12, padding: 12 }}>
      <Text style={{ color: t.ink, fontWeight: "800", marginBottom: 6 }}>{title}</Text>
      {rows.map(([a, b]) => (
        <View key={a} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
          <Text style={{ color: t.ink2 }}>{a}</Text>
          <Text style={{ color: t.ink, fontWeight: "700" }}>{b}</Text>
        </View>
      ))}
      <Text style={{ color: t.ink2, fontSize: 12, marginTop: 6, lineHeight: 17 }}>{note}</Text>
    </View>
  );
}
