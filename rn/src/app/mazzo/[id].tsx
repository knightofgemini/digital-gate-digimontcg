// Editor del mazzo (come sul telefono nell'app attuale): nome, azioni (esporta, importa, svuota, copertina, elimina), conteggi,
// curva che porta al livello, stato (valido / bozza / problemi), il mazzo in pile per livello con "+ Aggiungi",
// barra "Cerca e aggiungi carte…" che apre il foglio di ricerca, e la vista Statistiche.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Linking, Modal, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { DISPLAY, Text, TextInput } from "../../Text";
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { Chevron, FilterIcon, SearchIcon, SquareBtn } from "../../BottomBar";
import { Btn, ICO_PLUS, Panel, Progress } from "../../visual";
import { FitText } from "../../fit";
import { BanNote, ConfirmBox, ImportPanel } from "../../deckui";
import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { CARDS, Card, SETS, deckable, normQ, relevance, thumbUrl, verLabel } from "../../data";
import { BanBadge, DeckQty } from "../../DeckQty";
import { banEffective, banNote, banSource, deckColors, deckCover, deckCurve, deckGroups, deckById, deckStats, deckText, deleteDeck, dkGroups, isEgg } from "../../decks";
import { ActiveChips, FilterSheet, fltCount } from "../../FilterSheet";
import { EMPTY, Filters, anyFlt, cardMatches, qmHolder, srcCards } from "../../filters";
import { openCard } from "../../nav";
import { owned, saveDecks, useStore } from "../../store";
import { useTheme } from "../../theme";
import { toast } from "../../toast";
import { ColorBand, common } from "../../ui";
import { Screen, setTabHidden, useKbd, useBarState } from "../../chrome";
import { GridTile, ListRow, ViewToggle } from "../../items";

const ORDER: Record<string, number> = {};
SETS.forEach((s, i) => (ORDER[s.id] = i));
const ALL = CARDS.slice().sort((a, b) => (ORDER[a.set] ?? 999) - (ORDER[b.set] ?? 999) || a.code.localeCompare(b.code, "en", { numeric: true }));

export default function Mazzo() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const s = common(t);
  const bar = useBarState();
  useStore();
  const d = deckById(id);
  const [acts, setActs] = useState(false);
  const [view, setView] = useState<"deck" | "stats">("deck");
  const [sel, setSel] = useState<string | null>(null);
  const [imp, setImp] = useState(false);
  const [cover, setCover] = useState(false);
  const [cfm, setCfm] = useState("");
  const [add, setAdd] = useState<Filters | null>(null);
  const [name, setName] = useState(d ? d.name : "");
  const [nameFocus, setNameFocus] = useState(false);
  const [addF, setAddF] = useState(false);
  const kbd = useKbd();
  const [dkNew, setDkNew] = useState<string | null>(null);
  const { height: winH } = useWindowDimensions();
  // aprendo la ricerca il mazzo torna alla prima carta, così le pile restano visibili sopra il foglio
  useEffect(() => {
    if (!add) return;
    const g0 = d ? dkGroups(d)[0] : null;
    setTimeout(() => g0 && pos.current[g0[0]] != null && scroll.current?.scrollTo({ y: yOf(g0[0]), animated: true }), 250);
  }, [!!add]);
  // la scheda di una carta aperta dal foglio di ricerca va sopra: il foglio si nasconde e ricompare tornando qui
  const [away, setAway] = useState(false);
  useFocusEffect(useCallback(() => setAway(false), []));
  const scroll = useRef<any>(null);
  const pos = useRef<Record<string, number>>({});
  if (!d)
    return (
      <SafeAreaView style={s.screen}>
        <Text style={{ color: t.ink2, padding: 16 }}>Mazzo non trovato.</Text>
      </SafeAreaView>
    );
  const st = deckStats(d);
  const tot = st.main + st.egg;
  const groups = dkGroups(d);
  const curve = deckCurve(d);
  const cmax = Math.max(1, ...curve.map((b) => b[1]));
  const others = st.problems.filter((x) => !/^Il mazzo principale deve avere esattamente 50 carte: ora ne mancano/.test(x));
  // posizione di un gruppo nel mazzo (dentro il riquadro delle pile, che parte da __base)
  const yOf = (g: string) => (pos.current.__base || 0) + pos.current[g] - 64;
  const goTo = (g: string) => pos.current[g] != null && scroll.current?.scrollTo({ y: yOf(g), animated: true });

  // "+ Aggiungi" di un gruppo: ricerca già filtrata per quel tipo e livello
  function addTo(g: string) {
    const f = { ...EMPTY };
    if (g === "Digi-Egg") f.ct = "Digi-Egg";
    else if (/^Lv\./.test(g)) {
      f.ct = "Digimon";
      f.lv = g;
    } else if (g === "Digimon") f.ct = "Digimon";
    else f.ct = g;
    setAdd(f);
  }

  return (
    <Screen bs={bar}>
      <ScrollView ref={scroll} onScroll={bar.onScroll} scrollEventThrottle={16} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 4 + bar.pad, paddingBottom: add ? winH * 0.64 : view === "deck" ? 100 : 28 }}>
        {/* intestazione (.mdkh): indietro, nome del mazzo, freccia che apre le azioni */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginHorizontal: -6, marginTop: 10, marginBottom: 8 }}>
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/mazzi"))} accessibilityLabel="I miei mazzi" style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
            <Svg width={22} height={22} viewBox="0 0 24 24">
              <Path d="M15 5l-7 7 7 7" stroke={t.ink} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </Svg>
          </Pressable>
          <TextInput
            value={name}
            onChangeText={setName}
            maxLength={60}
            accessibilityLabel="Nome del mazzo"
            onFocus={() => setNameFocus(true)}
            onBlur={() => setNameFocus(false)}
            onEndEditing={() => {
              d.name = name.trim() || d.name;
              setName(d.name);
              d.upd = Date.now();
              saveDecks();
            }}
            style={{ flex: 1, minWidth: 0, color: t.ink, fontFamily: DISPLAY, fontWeight: "700", fontSize: 19.2, paddingVertical: 6, borderBottomWidth: 1.5, borderStyle: "dashed", borderColor: nameFocus ? t.accent : "transparent" }}
          />
          <Pressable onPress={() => setActs(!acts)} accessibilityLabel={(acts ? "Nascondi" : "Mostra") + " le azioni del mazzo: esporta, importa, svuota, copertina, elimina"} accessibilityState={{ expanded: acts }} style={{ width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: t.line, backgroundColor: t.surface, alignItems: "center", justifyContent: "center" }}>
            <Chevron color={t.ink} up={acts} />
          </Pressable>
        </View>
        {acts ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
            <Btn
              label="Esporta"
              style={{ flex: 1, paddingHorizontal: 8 }}
              onPress={async () => {
                await Clipboard.setStringAsync(deckText(d));
                toast("Lista copiata negli appunti.");
              }}
            />
            <Btn label="Importa" style={{ flex: 1, paddingHorizontal: 8 }} onPress={() => setImp(true)} />
            <Btn label="Svuota" style={{ flex: 1, paddingHorizontal: 8 }} onPress={() => setCfm("empty")} />
            <Pressable onPress={() => setCfm("del")} accessibilityLabel="Elimina mazzo" style={{ width: 44, height: 42, borderRadius: 10, borderWidth: 1, borderColor: t.line, backgroundColor: t.surface, alignItems: "center", justifyContent: "center" }}>
              <Svg width={19} height={19} viewBox="0 0 24 24">
                <Path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" stroke={t.cards.Red} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </Svg>
            </Pressable>
            <Btn label="Modifica copertina mazzo" icon="M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M15 9.5h.01" style={{ width: "100%" }} onPress={() => setCover(true)} />
          </View>
        ) : null}
        {imp ? (
          <ImportPanel
            label="Sostituisci il contenuto"
            onClose={() => setImp(false)}
            onDone={(cards) => {
              d.cards = cards;
              d.upd = Date.now();
              saveDecks();
              setImp(false);
              setActs(false);
            }}
          />
        ) : null}

        {/* conteggi + curva + stato (.dstat) */}
        <View style={{ backgroundColor: t.surface, borderWidth: 1, borderColor: t.line, borderRadius: 12, padding: 12, flexDirection: "row", flexWrap: "wrap", columnGap: 12, rowGap: 12 }}>
          {(
            [
              ["Principale", st.main, 50, st.main === 50],
              ["Digi-Egg", st.egg, 5, st.egg <= 5],
            ] as [string, number, number, boolean][]
          ).map(([l, v, mx, ok]) => (
            <View key={l} style={{ flex: 1, minWidth: 120 }}>
              <Text style={{ color: t.ink2, fontSize: 11.2, letterSpacing: 0.9, textTransform: "uppercase", lineHeight: 16 }}>{l}</Text>
              <Text style={{ color: ok ? t.ok : t.ink, fontFamily: DISPLAY, fontWeight: "700", fontSize: 19.2 }}>{v + " / " + mx}</Text>
              <Progress h={v} n={mx} color={v > mx ? t.cards.Red : undefined} style={{ marginTop: 6 }} />
            </View>
          ))}
          {st.main > 0 ? (
            <View style={{ width: "100%", marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderColor: t.line }}>
              <Text style={{ color: t.ink2, fontFamily: DISPLAY, fontWeight: "600", fontSize: 10.6, letterSpacing: 1.3, textTransform: "uppercase", marginBottom: 6 }}>{view === "deck" ? "Curva · tocca un livello per andarci" : "Curva dei livelli"}</Text>
              <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6, height: 74 }}>
                {curve.map(([g, n]) => (
                  <Pressable key={g} disabled={!n || view !== "deck"} onPress={() => goTo(g)} accessibilityLabel={"Vai a " + g} style={{ flex: 1, height: "100%", alignItems: "center", justifyContent: "flex-end", gap: 3 }}>
                    <Text style={{ color: t.ink2, fontFamily: DISPLAY, fontWeight: "600", fontSize: 10.9 }}>{n}</Text>
                    <View style={{ width: "100%", height: Math.max(2, Math.round((n / cmax) * 40)), borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: /^Lv/.test(g) ? t.accent : t.cyan }} />
                    <Text style={{ color: t.ink2, fontFamily: DISPLAY, fontWeight: "600", fontSize: 10.9 }}>{g === "Tamer" ? "Tam." : g === "Option" ? "Opt." : g}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
          {!st.problems.length ? (
            <View style={{ width: "100%", borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: "rgba(74,222,128,.14)" }}>
              <Text style={{ color: t.ok, fontWeight: "600", fontSize: 13.6 }}>✓ Mazzo valido secondo le regole e la lista ban in vigore dal {banEffective()}.</Text>
            </View>
          ) : (
            <>
              {st.main < 50 ? (
                <View style={{ width: "100%", borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: t.accentSoft }}>
                  <Text style={{ color: t.accent, fontWeight: "600", fontSize: 13.6 }}>{"Bozza · " + (50 - st.main === 1 ? "manca 1 carta" : "mancano " + (50 - st.main) + " carte") + " al mazzo principale"}</Text>
                </View>
              ) : null}
              {others.length ? (
                <View style={{ width: "100%", borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10, gap: 3, backgroundColor: "rgba(239,91,85,.12)" }}>
                  {others.map((x) => (
                    <View key={x} style={{ flexDirection: "row", gap: 8, paddingLeft: 4 }}>
                      <Text style={{ color: t.ink, fontSize: 13.6 }}>•</Text>
                      <Text style={{ color: t.ink, fontSize: 13.6, flex: 1 }}>{x}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </>
          )}
        </View>

        {/* Mazzo / Statistiche (.mseg) */}
        <View style={{ flexDirection: "row", padding: 3, borderRadius: 12, backgroundColor: t.surface2, marginVertical: 12 }}>
          {(
            [
              ["deck", "Mazzo · " + tot],
              ["stats", "Statistiche"],
            ] as ["deck" | "stats", string][]
          ).map(([v, l]) => {
            const on = view === v;
            return (
              <Pressable
                key={v}
                onPress={() => {
                  setView(v);
                  setSel(null);
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                style={{ flex: 1, minHeight: 42, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: on ? t.surface : "transparent", boxShadow: on ? "0 1px 3px rgba(15,26,46,.15)" : undefined }}
              >
                <Text style={{ color: on ? t.ink : t.ink2, fontWeight: on ? "700" : "500", fontSize: 14.4, lineHeight: 20 }}>{l}</Text>
              </Pressable>
            );
          })}
        </View>

        {view === "deck" ? (
          <View style={{ gap: 18, marginTop: 2 }} onLayout={(e) => (pos.current.__base = e.nativeEvent.layout.y)}>
            {groups.map(([g, cards]) => {
              const n = cards.reduce((m, c) => m + d.cards[c.k], 0);
              const selC = cards.find((c) => c.k === sel);
              return (
                <View key={g} onLayout={(e) => (pos.current[g] = e.nativeEvent.layout.y)}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <Text style={{ color: t.ink, fontFamily: DISPLAY, fontWeight: "700", fontSize: 16.3 }}>{g}</Text>
                    <Text style={{ color: t.ink2, fontFamily: DISPLAY, fontWeight: "600", fontSize: 13.6 }}>{n + (n === 1 ? " carta" : " carte")}</Text>
                    <Pressable onPress={() => addTo(g)} accessibilityLabel={"Aggiungi carte a " + g} style={{ marginLeft: "auto", minHeight: 38, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: t.line, backgroundColor: t.surface, flexDirection: "row", alignItems: "center", gap: 5 }}>
                      <Text style={{ color: t.accent, fontSize: 17.6, lineHeight: 18 }}>+</Text>
                      <Text style={{ color: t.ink2, fontFamily: DISPLAY, fontWeight: "600", fontSize: 13.6 }}>Aggiungi</Text>
                    </Pressable>
                  </View>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 10, rowGap: 12 }}>
                    {cards.map((c) => (
                      <Pile key={c.k} c={c} q={d.cards[c.k]} on={sel === c.k} isNew={dkNew === c.k} onPress={() => (setSel(sel === c.k ? null : c.k), setDkNew(null))} />
                    ))}
                  </View>
                  {selC ? (
                    <View style={{ marginTop: 12, paddingVertical: 8, paddingLeft: 12, paddingRight: 6, borderRadius: 12, borderWidth: 1, borderColor: t.accent, backgroundColor: t.surface, flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <FitText text={selC.name} size={15} style={{ color: t.ink, fontWeight: "600" }} />
                        <Text style={{ color: t.ink2, fontSize: 12.8, lineHeight: 18 }} numberOfLines={1}>
                          {selC.code + (selC.suf ? " · " + (verLabel(selC.ver) || "Alternative Art") : "")}
                        </Text>
                      </View>
                      <View style={{ alignItems: "flex-end", gap: 4 }}>
                        <DeckQty d={d} c={selC} />
                        <BanBadge c={selC} d={d} />
                      </View>
                      <Pressable onPress={() => openCard(selC, cards, d.id)} accessibilityLabel={"Apri la scheda di " + selC.name} style={{ width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" }}>
                        <Svg width={22} height={22} viewBox="0 0 24 24">
                          <Circle cx={12} cy={12} r={9} stroke={t.accent} strokeWidth={2} fill="none" />
                          <Path d="M12 11v6M12 7.5v.5" stroke={t.accent} strokeWidth={2} strokeLinecap="round" />
                        </Svg>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              );
            })}
            {!groups.length ? (
              <View style={{ backgroundColor: t.surface, borderWidth: 1, borderColor: t.line, borderRadius: 14, paddingVertical: 34, paddingHorizontal: 18, alignItems: "center", gap: 16 }}>
                <Text style={{ color: t.ink2, textAlign: "center" }}>Il mazzo è vuoto: cerca le carte e aggiungile con +, oppure importa una lista dalla freccia in alto.</Text>
                <Btn label="Aggiungi carte" pri icon={ICO_PLUS} onPress={() => setAdd({ ...EMPTY })} />
              </View>
            ) : null}
          </View>
        ) : (
          <Stats d={d} />
        )}
      </ScrollView>

      {/* barra "Cerca e aggiungi carte…" con Filtra (.dkbar) */}
      {view === "deck" && !kbd && !add ? (
        <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingTop: 12, paddingHorizontal: 14, paddingBottom: 8, flexDirection: "row", gap: 8, alignItems: "center" }}>
          <Svg pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 10 100">
            <Defs>
              <LinearGradient id="dkbarfade" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={t.bg} stopOpacity={0} />
                <Stop offset="0.45" stopColor={t.bg} stopOpacity={1} />
                <Stop offset="1" stopColor={t.bg} stopOpacity={1} />
              </LinearGradient>
            </Defs>
            <Rect width="10" height="100" fill="url(#dkbarfade)" />
          </Svg>
          <Pressable onPress={() => setAdd({ ...EMPTY })} style={{ flex: 1, minWidth: 0, height: 48, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: t.line, backgroundColor: t.surface, boxShadow: "0 6px 18px rgba(0,0,0,.18)" }}>
            <SearchIcon color={t.accent} />
            <Text style={{ color: t.ink2, fontSize: 16 }} numberOfLines={1}>
              Cerca e aggiungi carte…
            </Text>
          </Pressable>
          <SquareBtn size={48} onPress={() => (setAddF(true), setAdd({ ...EMPTY }))} label="Filtra">
            <FilterIcon color={t.ink} />
          </SquareBtn>
        </View>
      ) : null}

      {add && <AddSheet d={d} f0={add} openF={addF} onOpen={() => setAway(true)} onClose={() => (setAdd(null), setAddF(false), setDkNew(null))} onAdded={(c) => {
        setDkNew(c.k);
        const g = dkGroups(d).find(([, cs]) => cs.some((x) => x.k === c.k));
        setTimeout(() => g && pos.current[g[0]] != null && scroll.current?.scrollTo({ y: yOf(g[0]), animated: true }), 120);
      }} />}
      <CoverPicker visible={cover} d={d} onClose={() => setCover(false)} />
      <ConfirmBox
        visible={cfm === "empty"}
        title={["Svuotare il mazzo ", d.name, "?"]}
        text="Tutte le carte inserite verranno rimosse dalla lista."
        ok="Svuota"
        onClose={() => setCfm("")}
        onOk={() => {
          d.cards = {};
          d.upd = Date.now();
          saveDecks();
        }}
      />
      <ConfirmBox
        visible={cfm === "del"}
        title={["Eliminare il mazzo ", d.name, "?"]}
        text="Il mazzo verrà cancellato definitivamente."
        ok="Elimina"
        onClose={() => setCfm("")}
        onOk={() => {
          deleteDeck(d.id);
          router.back();
        }}
      />
    </Screen>
  );
}

// pila di una carta (.dkpile): fino a 4 miniature affiancate e sovrapposte, il numero di copie in arancione
function Pile({ c, q, on, isNew, onPress }: { c: Card; q: number; on: boolean; isNew?: boolean; onPress: () => void }) {
  const t = useTheme();
  const n = Math.min(q, 4);
  return (
    <Pressable onPress={onPress} accessibilityLabel={c.name + " " + c.code + ", " + q + (q === 1 ? " copia" : " copie")} accessibilityState={{ selected: on }} style={{ flexDirection: "row", borderRadius: 7, outlineWidth: on || isNew ? 2 : 0, outlineColor: t.accent, outlineOffset: 3, outlineStyle: "solid" } as any}>
      {Array.from({ length: n }).map((_, i) => (
        <View key={i} style={{ width: 74, height: 103, marginLeft: i ? -58 : 0, borderRadius: 6, overflow: "hidden", borderWidth: 1, borderColor: t.line, backgroundColor: t.cards[c.colors[0]] || t.surface2, boxShadow: "-5px 0 10px rgba(0,0,0,.3)" }}>
          <Image source={thumbUrl(c)} style={{ width: "100%", height: "100%" }} contentFit="cover" cachePolicy="disk" />
        </View>
      ))}
      <View style={{ position: "absolute", right: 4, bottom: 4, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 5, backgroundColor: t.accent }}>
        <Text style={{ color: t.accentInk, fontFamily: DISPLAY, fontWeight: "700", fontSize: 11.8 }}>×{q}</Text>
      </View>
      {isNew ? (
        <View style={{ position: "absolute", left: 6, right: 6, top: "40%", paddingVertical: 2, borderRadius: 5, backgroundColor: t.accent, alignItems: "center" }}>
          <Text style={{ color: t.accentInk, fontFamily: DISPLAY, fontWeight: "700", fontSize: 11.2 }}>Nuova</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

// foglio di ricerca dal basso (.dksheet dell'app attuale): a metà schermo (la maniglia lo allarga o lo riduce), sopra resta
// visibile il mazzo; campo di ricerca, Filtri e "Fine", etichette dei filtri attivi, risultati con le copie nel mazzo
// (vista elenco/griglia separata, "dg-dkview"). La carta appena aggiunta si vede nella sua pila sopra il foglio.
let DKVIEW: "list" | "grid" = "list";
AsyncStorage.getItem("dg-dkview").then((v) => v === "grid" && (DKVIEW = "grid")).catch(() => {});
function AddSheet({ d, f0, openF, onOpen, onClose, onAdded }: { d: any; f0: Filters; openF?: boolean; hidden?: boolean; onOpen: () => void; onClose: () => void; onAdded: (c: Card) => void }) {
  const t = useTheme();
  useStore();
  const { width } = useWindowDimensions();
  const ins = useSafeAreaInsets();
  const [q, setQ] = useState("");
  const [f, setF] = useState<Filters>(f0);
  const [fOpen, setFOpen] = useState(!!openF);
  const [shown, setShown] = useState(40);
  const [full, setFull] = useState(false);
  const [vw, setVw] = useState(DKVIEW);
  useEffect(() => {
    setTabHidden(true);
    return () => setTabHidden(false);
  }, []);
  const nq = normQ(q);
  const filt = !!nq || anyFlt(f) || !!f.qm;
  const list = useMemo(() => {
    if (!filt) return [];
    const l = srcCards(f, CARDS).filter((c) => deckable(c) && cardMatches(c, nq, f));
    return nq && f.qm !== "text"
      ? l
          .map((c, j) => ({ c, j, r: relevance(c, nq) }))
          .sort((a, b) => a.r - b.r || a.j - b.j)
          .map((o) => o.c)
      : l;
  }, [q, f]);
  const nf = fltCount(f);
  const pickVw = (v: "list" | "grid") => {
    DKVIEW = v;
    setVw(v);
    AsyncStorage.setItem("dg-dkview", v).catch(() => {});
  };
  const tw = Math.floor((width - 28 - 6) / 2);
  const qty = (c: Card) => (
    <View style={{ alignItems: "flex-end", gap: 4 }}>
      <DeckQty d={d} c={c} fill={vw === "grid"} onChange={(a, b) => b > a && onAdded(c)} />
      <BanBadge c={c} d={d} />
    </View>
  );
  const rows: Card[][] = [];
  const sl = list.slice(0, shown);
  for (let i = 0; i < sl.length; i += vw === "grid" ? 2 : 1) rows.push(sl.slice(i, i + (vw === "grid" ? 2 : 1)));
  return (
    <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, top: full ? 0 : undefined, height: full ? undefined : "62%", backgroundColor: t.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, borderColor: t.line, boxShadow: "0 -14px 36px rgba(0,0,0,.35)", paddingHorizontal: 14 }}>
      <Pressable onPress={() => setFull(!full)} accessibilityLabel="Ingrandisci o riduci la ricerca" style={{ height: 26, alignItems: "center", justifyContent: "center" }}>
        <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: t.line }} />
      </Pressable>
      <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
        <View style={{ flex: 1, minWidth: 0, height: 46, borderRadius: 12, borderWidth: 1, borderColor: t.line, backgroundColor: t.surface, justifyContent: "center" }}>
          <View pointerEvents="none" style={{ position: "absolute", left: 13 }}>
            <SearchIcon color={t.accent} />
          </View>
          <TextInput value={q} onChangeText={setQ} autoFocus={!anyFlt(f0) && !openF} placeholder={qmHolder(f.qm)} placeholderTextColor={t.ink2} autoCorrect={false} returnKeyType="search" style={{ height: 44, paddingLeft: 42, paddingRight: 12, color: t.ink, fontSize: 16 }} />
        </View>
        <SquareBtn size={46} shadow={false} onPress={() => setFOpen(true)} on={!!nf} badge={nf} label={"Filtri" + (nf ? ": " + nf + (nf === 1 ? " attivo" : " attivi") : "")}>
          <FilterIcon color={t.ink} />
        </SquareBtn>
        <Pressable onPress={onClose} style={{ height: 46, justifyContent: "center", paddingRight: 4 }}>
          <Text style={{ color: t.cyan, fontFamily: DISPLAY, fontWeight: "700", fontSize: 16 }}>Fine</Text>
        </Pressable>
      </View>
      {nf ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center", marginTop: 8 }}>
          <ActiveChips f={f} setF={setF} />
        </View>
      ) : null}
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 24, paddingBottom: 16 + ins.bottom }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
          <Text style={{ color: t.ink2, fontFamily: DISPLAY, fontWeight: "600", fontSize: 11.2, letterSpacing: 1.35, textTransform: "uppercase" }}>{!filt ? "Cerca una carta" : list.length + (list.length === 1 ? " carta trovata" : " carte trovate")}</Text>
          {filt ? <ViewToggle value={vw} onChange={pickVw} /> : null}
        </View>
        {!filt ? (
          <>
            <Text style={{ color: t.ink2, fontSize: 12.8, marginTop: 18 }}>Scrivi un nome, un codice o una parola dell'effetto, oppure utilizza i filtri.</Text>
            <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 10 }}>
              <ViewToggle value={vw} onChange={pickVw} />
            </View>
          </>
        ) : !list.length ? (
          <Text style={{ color: t.ink2, textAlign: "center", paddingVertical: 48 }}>Nessuna carta corrisponde alla ricerca.</Text>
        ) : (
          rows.map((r) =>
            vw === "grid" ? (
              <View key={r[0].k} style={{ flexDirection: "row", gap: 6, marginBottom: 6 }}>
                {r.map((c) => (
                  <GridTile key={c.k} c={c} list={list} width={tw} deck={d.id} onOpen={onOpen} qty={qty(c)} />
                ))}
              </View>
            ) : (
              <View key={r[0].k} style={{ marginBottom: 6 }}>
                <ListRow c={r[0]} list={list} noPrice deck={d.id} onOpen={onOpen} right={qty(r[0])} />
              </View>
            )
          )
        )}
        {list.length > shown ? (
          <Pressable onPress={() => setShown(shown + 40)} style={{ paddingTop: 14, paddingBottom: 18, alignItems: "center" }}>
            <Text style={{ color: t.ink2, fontSize: 13.1 }}>Mostra altre ({list.length - shown})</Text>
          </Pressable>
        ) : null}
      </ScrollView>
      <FilterSheet visible={fOpen} f={f} setF={setF} onClose={() => setFOpen(false)} count={list.length} />
    </View>
  );
}

// Statistiche: composizione, colori e quante copie del mazzo hai già nella collezione
function Stats({ d }: { d: any }) {
  const t = useTheme();
  const s = common(t);
  const comp: Record<string, number> = { Digimon: 0, Tamer: 0, Option: 0, "Digi-Egg": 0 };
  let need = 0,
    have = 0;
  deckGroups(d).forEach(([, cs]) =>
    cs.forEach((c) => {
      const n = d.cards[c.k];
      if (isEgg(c)) comp["Digi-Egg"] += n;
      else if (/^Digimon/.test(c.ct)) comp.Digimon += n;
      else if (c.ct === "Tamer") comp.Tamer += n;
      else comp.Option += n;
      need += n;
      have += Math.min(n, owned(c));
    })
  );
  const cols = deckColors(d);
  const totc = cols.reduce((m, x) => m + x[1], 0) || 1;
  return (
    <View style={{ gap: 10 }}>
      <Panel title="Composizione">
        <View style={{ flexDirection: "row", gap: 6 }}>
          {Object.keys(comp).map((k) => (
            <View key={k} style={{ flex: 1, alignItems: "center" }}>
              <Text style={{ color: t.ink, fontFamily: DISPLAY, fontWeight: "700", fontSize: 21.6 }}>{comp[k]}</Text>
              <Text style={{ color: t.ink2, fontSize: 11.8 }}>{k}</Text>
            </View>
          ))}
        </View>
      </Panel>
      {cols.length > 0 && (
        <Panel title="Colori">
          <View style={{ flexDirection: "row", height: 10, borderRadius: 99, overflow: "hidden", gap: 2, marginBottom: 8 }}>
            {cols.map(([x, n]) => (
              <View key={x} style={{ flex: n / totc, minWidth: 3, backgroundColor: t.cards[x] }} />
            ))}
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 10, rowGap: 4 }}>
            {cols.map(([x, n]) => (
              <View key={x} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: t.cards[x] }} />
                <Text style={{ color: t.ink2, fontSize: 12.5 }}>{x + " " + n}</Text>
              </View>
            ))}
          </View>
        </Panel>
      )}
      {need > 0 && (
        <Panel title="Dalla tua collezione">
          <Text style={{ color: t.ink, fontFamily: DISPLAY, fontWeight: "700", fontSize: 21.6 }}>{have + " / " + need}</Text>
          <Text style={{ color: t.ink2, fontSize: 13.4, marginTop: 2, marginBottom: 8 }}>{have === need ? "Hai già tutte le copie del mazzo." : (need - have === 1 ? "Ti manca 1 copia" : "Ti mancano " + (need - have) + " copie") + " (contando la versione scelta nel mazzo)."}</Text>
          <Progress h={have} n={need} />
        </Panel>
      )}
      <BanNote top={8} />
    </View>
  );
}

// "Modifica copertina mazzo": una delle carte del mazzo, o la scelta automatica
function CoverPicker({ visible, d, onClose }: { visible: boolean; d: any; onClose: () => void }) {
  const t = useTheme();
  const auto = !(d.cover && d.cards[d.cover]);
  const ac = deckCover({ ...d, cover: undefined });
  const seen: Card[] = [];
  deckGroups(d).forEach(([, cs]) => cs.forEach((c) => seen.indexOf(c) < 0 && seen.push(c)));
  const pick = (k?: string) => {
    if (k) d.cover = k;
    else delete d.cover;
    d.upd = Date.now();
    saveDecks();
    toast(k ? "Copertina scelta." : "Copertina automatica.");
    onClose();
  };
  const Item = ({ c, label, on, onPress }: { c: Card | null; label: string; on: boolean; onPress: () => void }) => (
    <Pressable onPress={onPress} style={{ width: 76, alignItems: "center" }}>
      <View style={{ width: 70, height: 98, borderRadius: 6, borderWidth: on ? 3 : 0, borderColor: t.accent, overflow: "hidden", backgroundColor: t.surface2 }}>{c && <Image source={thumbUrl(c)} style={{ width: "100%", height: "100%" }} cachePolicy="disk" />}</View>
      <Text style={{ color: t.ink2, fontSize: 11, marginTop: 3 }} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,.55)" }} onPress={onClose} />
      <SafeAreaView edges={["bottom"]} style={{ backgroundColor: t.bg, borderTopLeftRadius: 18, borderTopRightRadius: 18, maxHeight: "80%" }}>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Text style={{ color: t.ink, fontSize: 20, fontWeight: "800" }}>Modifica copertina mazzo</Text>
          <Text style={{ color: t.ink2, marginTop: 4, marginBottom: 12 }}>{seen.length ? "Tocca la carta da usare come copertina del mazzo." : "Il mazzo è vuoto: aggiungi delle carte per sceglierne una come copertina."}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            <Item c={ac} label="Automatica" on={auto} onPress={() => pick()} />
            {seen.map((c) => (
              <Item key={c.k} c={c} label={c.code} on={!auto && d.cover === c.k} onPress={() => pick(c.k)} />
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
