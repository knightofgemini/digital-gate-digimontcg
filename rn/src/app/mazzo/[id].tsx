// Editor del mazzo (come sul telefono nell'app attuale): nome, azioni (esporta, importa, svuota, copertina, elimina), conteggi,
// curva che porta al livello, stato (valido / bozza / problemi), il mazzo in pile per livello con "+ Aggiungi",
// barra "Cerca e aggiungi carte…" che apre il foglio di ricerca, e la vista Statistiche.
import { useCallback, useMemo, useRef, useState } from "react";
import { Linking, Modal, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { CARDS, Card, SETS, deckable, normQ, relevance, thumbUrl, verLabel } from "../../data";
import { BanBadge, DeckQty } from "../../DeckQty";
import { banEffective, banNote, banSource, deckColors, deckCover, deckCurve, deckGroups, deckById, deckStats, deckText, deleteDeck, dkGroups, isEgg } from "../../decks";
import { ActiveChips, FilterSheet } from "../../FilterSheet";
import { EMPTY, Filters, anyFlt, cardMatches, fl, srcCards } from "../../filters";
import { ImportDeck } from "../../ImportDeck";
import { openCard } from "../../nav";
import { owned, saveDecks, useStore } from "../../store";
import { useTheme } from "../../theme";
import { toast } from "../../toast";
import { ColorBand, common } from "../../ui";
import { rarLine } from "../../items";

const ORDER: Record<string, number> = {};
SETS.forEach((s, i) => (ORDER[s.id] = i));
const ALL = CARDS.slice().sort((a, b) => (ORDER[a.set] ?? 999) - (ORDER[b.set] ?? 999) || a.code.localeCompare(b.code, "en", { numeric: true }));

export default function Mazzo() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const s = common(t);
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
  const goTo = (g: string) => pos.current[g] != null && scroll.current?.scrollTo({ y: pos.current[g] - 10, animated: true });

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
    <SafeAreaView style={s.screen} edges={["top"]}>
      {/* intestazione: indietro, nome del mazzo, azioni */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 8 }}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/mazzi"))} hitSlop={10}>
          <Text style={{ color: t.accent, fontSize: 26, fontWeight: "600", marginTop: -4 }}>‹</Text>
        </Pressable>
        <TextInput
          value={name}
          onChangeText={setName}
          maxLength={60}
          onEndEditing={() => {
            d.name = name.trim() || d.name;
            setName(d.name);
            d.upd = Date.now();
            saveDecks();
          }}
          style={{ flex: 1, color: t.ink, fontSize: 20, fontWeight: "800", paddingVertical: 4 }}
        />
        <Pressable onPress={() => setActs(!acts)} hitSlop={10} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: t.surface2, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: t.ink, fontWeight: "900" }}>{acts ? "▴" : "⋯"}</Text>
        </Pressable>
      </View>
      {acts && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: 12, paddingBottom: 8 }}>
          <Act
            label="Esporta"
            onPress={async () => {
              await Clipboard.setStringAsync(deckText(d));
              toast("Lista copiata negli appunti.");
            }}
          />
          <Act label="Importa" onPress={() => setImp(true)} />
          <Act
            label={cfm === "empty" ? "Sicuro? Svuota" : "Svuota"}
            warn={cfm === "empty"}
            onPress={() => {
              if (cfm !== "empty") return setCfm("empty");
              d.cards = {};
              d.upd = Date.now();
              saveDecks();
              setCfm("");
              toast("Mazzo svuotato.");
            }}
          />
          <Act label="Copertina" onPress={() => setCover(true)} />
          <Act
            label={cfm === "del" ? "Sicuro? Elimina" : "Elimina"}
            warn
            onPress={() => {
              if (cfm !== "del") return setCfm("del");
              deleteDeck(d.id);
              router.back();
            }}
          />
        </View>
      )}

      <ScrollView ref={scroll} contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 100 }}>
        {/* conteggi + curva + stato */}
        <View style={[s.panel, { padding: 12 }]}>
          <View style={{ flexDirection: "row", gap: 12 }}>
            {(
              [
                ["Principale", st.main, 50, st.main === 50],
                ["Digi-Egg", st.egg, 5, st.egg <= 5],
              ] as [string, number, number, boolean][]
            ).map(([l, v, mx, ok]) => (
              <View key={l} style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: t.ink2, fontSize: 12 }}>{l}</Text>
                  <Text style={{ color: ok ? "#46bd73" : t.ink, fontWeight: "800" }}>{v + " / " + mx}</Text>
                </View>
                <View style={{ height: 5, borderRadius: 3, backgroundColor: t.surface2, marginTop: 4, overflow: "hidden" }}>
                  <View style={{ width: Math.min(100, (v / mx) * 100) + "%", height: 5, backgroundColor: v > mx ? "#e5484d" : ok ? "#46bd73" : t.accent }} />
                </View>
              </View>
            ))}
          </View>
          {st.main > 0 && (
            <View style={{ marginTop: 12 }}>
              <Text style={{ color: t.ink2, fontSize: 12 }}>{view === "deck" ? "Curva · tocca un livello per andarci" : "Curva dei livelli"}</Text>
              <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6, marginTop: 6 }}>
                {curve.map(([g, n]) => (
                  <Pressable key={g} disabled={!n || view !== "deck"} onPress={() => goTo(g)} style={{ flex: 1, alignItems: "center" }}>
                    <Text style={{ color: t.ink, fontSize: 11, fontWeight: "700" }}>{n}</Text>
                    <View style={{ width: "70%", height: Math.round((n / cmax) * 40) + 2, borderRadius: 3, backgroundColor: /^Lv/.test(g) ? t.accent : t.ink2 }} />
                    <Text style={{ color: t.ink2, fontSize: 10, marginTop: 2 }}>{g === "Tamer" ? "Tam." : g === "Option" ? "Opt." : g}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
          {!st.problems.length ? (
            <Text style={{ color: "#46bd73", fontWeight: "700", marginTop: 10 }}>✓ Mazzo valido secondo le regole e la lista ban in vigore dal {banEffective()}.</Text>
          ) : (
            <View style={{ marginTop: 10, gap: 4 }}>
              {st.main < 50 && <Text style={{ color: "#c77a0a", fontWeight: "700" }}>{"Bozza · " + (50 - st.main === 1 ? "manca 1 carta" : "mancano " + (50 - st.main) + " carte") + " al mazzo principale"}</Text>}
              {others.map((x) => (
                <Text key={x} style={{ color: "#e5484d" }}>
                  {"• " + x}
                </Text>
              ))}
            </View>
          )}
        </View>

        {/* Mazzo / Statistiche */}
        <View style={{ flexDirection: "row", backgroundColor: t.surface2, borderRadius: 10, padding: 3, marginTop: 12 }}>
          {(
            [
              ["deck", "Mazzo · " + tot],
              ["stats", "Statistiche"],
            ] as ["deck" | "stats", string][]
          ).map(([v, l]) => (
            <Pressable
              key={v}
              onPress={() => {
                setView(v);
                setSel(null);
              }}
              style={{ flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center", backgroundColor: view === v ? t.surface : "transparent" }}
            >
              <Text style={{ color: view === v ? t.ink : t.ink2, fontWeight: "700" }}>{l}</Text>
            </Pressable>
          ))}
        </View>

        {view === "deck" ? (
          <>
            {groups.map(([g, cards]) => {
              const n = cards.reduce((m, c) => m + d.cards[c.k], 0);
              const selC = cards.find((c) => c.k === sel);
              return (
                <View key={g} onLayout={(e) => (pos.current[g] = e.nativeEvent.layout.y)} style={{ marginTop: 16 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <Text style={{ color: t.ink, fontSize: 16, fontWeight: "800" }}>{g}</Text>
                    <Text style={{ color: t.ink2, fontSize: 13 }}>{n + (n === 1 ? " carta" : " carte")}</Text>
                    <Pressable onPress={() => addTo(g)} style={{ marginLeft: "auto", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14, backgroundColor: t.surface2 }}>
                      <Text style={{ color: t.accent, fontWeight: "800", fontSize: 13 }}>+ Aggiungi</Text>
                    </Pressable>
                  </View>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                    {cards.map((c) => (
                      <Pile key={c.k} c={c} q={d.cards[c.k]} on={sel === c.k} onPress={() => setSel(sel === c.k ? null : c.k)} />
                    ))}
                  </View>
                  {selC && (
                    <View style={[s.panel, { marginTop: 10, padding: 10, flexDirection: "row", alignItems: "center", gap: 10 }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: t.ink, fontWeight: "800" }} numberOfLines={1}>
                          {selC.name}
                        </Text>
                        <Text style={{ color: t.ink2, fontSize: 12 }}>{selC.code + (selC.suf ? " · " + (verLabel(selC.ver) || "Alternative Art") : "")}</Text>
                        <BanBadge c={selC} d={d} />
                      </View>
                      <DeckQty d={d} c={selC} />
                      <Pressable onPress={() => openCard(selC, cards, d.id)} hitSlop={8} style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: t.ink2, alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ color: t.ink2, fontWeight: "900" }}>i</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            })}
            {!groups.length && (
              <View style={[s.panel, { padding: 16, marginTop: 16, alignItems: "center" }]}>
                <Text style={{ color: t.ink2, textAlign: "center" }}>Il mazzo è vuoto: cerca le carte e aggiungile con +, oppure importa una lista dal ⋯ in alto.</Text>
              </View>
            )}
          </>
        ) : (
          <Stats d={d} />
        )}
      </ScrollView>

      {/* barra "Cerca e aggiungi carte…" */}
      {view === "deck" && (
        <View style={{ position: "absolute", left: 12, right: 12, bottom: 16 }}>
          <Pressable onPress={() => setAdd({ ...EMPTY })} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 14, backgroundColor: t.accent }}>
            <Text style={{ color: t.accentInk, fontSize: 16, fontWeight: "800" }}>⌕  Cerca e aggiungi carte…</Text>
          </Pressable>
        </View>
      )}

      {add && <AddSheet d={d} f0={add} hidden={away} onOpen={() => setAway(true)} onClose={() => setAdd(null)} />}
      <ImportDeck
        visible={imp}
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
      <CoverPicker visible={cover} d={d} onClose={() => setCover(false)} />
    </SafeAreaView>
  );
}

function Act({ label, onPress, warn }: { label: string; onPress: () => void; warn?: boolean }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: t.surface2 }}>
      <Text style={{ color: warn ? "#e5484d" : t.ink, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

// pila di una carta: fino a 4 miniature sovrapposte e il numero di copie
function Pile({ c, q, on, onPress }: { c: Card; q: number; on: boolean; onPress: () => void }) {
  const t = useTheme();
  const w = 62,
    h = 87,
    off = 7;
  const n = Math.min(q, 4);
  return (
    <Pressable onPress={onPress} style={{ width: w + off * (n - 1), height: h + off * (n - 1) + 4, opacity: 1 }}>
      {Array.from({ length: n }).map((_, i) => (
        <Image key={i} source={thumbUrl(c)} style={{ position: "absolute", left: i * off, top: i * off, width: w, height: h, borderRadius: 5, borderWidth: on ? 2 : 0, borderColor: t.accent, backgroundColor: t.surface2 }} cachePolicy="disk" />
      ))}
      <View style={{ position: "absolute", right: -4, bottom: 0, backgroundColor: on ? t.accent : t.ink, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 }}>
        <Text style={{ color: on ? t.accentInk : t.bg, fontWeight: "900", fontSize: 12 }}>×{q}</Text>
      </View>
    </Pressable>
  );
}

// foglio di ricerca dal basso: ricerca, filtri e risultati con le copie nel mazzo
function AddSheet({ d, f0, hidden, onOpen, onClose }: { d: any; f0: Filters; hidden: boolean; onOpen: () => void; onClose: () => void }) {
  const t = useTheme();
  const s = common(t);
  useStore();
  const { height } = useWindowDimensions();
  const [q, setQ] = useState("");
  const [f, setF] = useState<Filters>(f0);
  const [fOpen, setFOpen] = useState(false);
  const [shown, setShown] = useState(40);
  const nq = normQ(q);
  const filt = !!nq || anyFlt(f);
  const list = useMemo(() => {
    if (!filt) return [];
    const l = srcCards(f, ALL).filter((c) => deckable(c) && cardMatches(c, nq, f));
    return nq && f.qm !== "text"
      ? l
          .map((c, j) => ({ c, j, r: relevance(c, nq) }))
          .sort((a, b) => a.r - b.r || a.j - b.j)
          .map((o) => o.c)
      : l;
  }, [q, f]);
  const nf = (Object.keys(f) as (keyof Filters)[]).reduce((m, k) => m + (k === "qm" || !f[k] ? 0 : fl(f, k).length), 0);
  return (
    <Modal visible={!hidden} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={{ height: height * 0.18, backgroundColor: "rgba(0,0,0,.4)" }} onPress={onClose} />
      <SafeAreaView edges={["bottom"]} style={{ flex: 1, backgroundColor: t.bg, borderTopLeftRadius: 18, borderTopRightRadius: 18 }}>
        <View style={{ flexDirection: "row", gap: 8, padding: 12, paddingBottom: 6 }}>
          <TextInput value={q} onChangeText={setQ} autoFocus={!anyFlt(f0)} placeholder="Nome, codice o parola dell'effetto" placeholderTextColor={t.ink2} style={[s.search, { flex: 1 }]} autoCorrect={false} returnKeyType="search" />
          <Pressable onPress={() => setFOpen(true)} style={{ paddingHorizontal: 12, justifyContent: "center", borderRadius: 10, borderWidth: 1, borderColor: nf ? t.accent : t.line, backgroundColor: nf ? t.accent : t.surface }}>
            <Text style={{ color: nf ? t.accentInk : t.ink, fontWeight: "700" }}>Filtri{nf ? " · " + nf : ""}</Text>
          </Pressable>
          <Pressable onPress={onClose} style={{ paddingHorizontal: 12, justifyContent: "center" }}>
            <Text style={{ color: t.accent, fontWeight: "800" }}>Fine</Text>
          </Pressable>
        </View>
        <View style={{ paddingHorizontal: 12 }}>
          <ActiveChips f={f} setF={setF} />
          <Text style={{ color: t.ink2, fontSize: 13, marginTop: 6 }}>{filt ? list.length + (list.length === 1 ? " carta trovata" : " carte trovate") : "Cerca una carta"}</Text>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ paddingBottom: 30 }}>
          {!filt && <Text style={{ color: t.ink2, padding: 12 }}>Scrivi un nome, un codice o una parola dell'effetto, oppure utilizza i filtri.</Text>}
          {filt && !list.length && <Text style={{ color: t.ink2, padding: 12 }}>Nessuna carta corrisponde alla ricerca.</Text>}
          {list.slice(0, shown).map((c) => (
            <Pressable
              key={c.k}
              onPress={() => {
                onOpen();
                openCard(c, list, d.id);
              }} style={{ flexDirection: "row", gap: 10, paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 1, borderColor: t.line, alignItems: "center" }}>
              <View style={{ width: 46 }}>
                <Image source={thumbUrl(c)} style={{ width: 46, height: 64, borderRadius: 4, backgroundColor: t.surface2 }} cachePolicy="disk" />
                <View style={{ marginTop: 3 }}>
                  <ColorBand colors={c.colors} height={3} />
                </View>
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text style={{ color: t.ink, fontWeight: "700" }} numberOfLines={1}>
                  {c.name}
                </Text>
                <Text style={{ color: t.ink2, fontSize: 12 }}>{[c.ct, c.lv].filter(Boolean).join(" · ")}</Text>
                <Text style={{ color: t.ink2, fontSize: 12 }}>{rarLine(c)}</Text>
                <BanBadge c={c} d={d} />
              </View>
              <DeckQty d={d} c={c} />
            </Pressable>
          ))}
          {list.length > shown && (
            <Pressable onPress={() => setShown(shown + 40)} style={{ padding: 14, alignItems: "center" }}>
              <Text style={{ color: t.accent, fontWeight: "800" }}>Mostra altre ({list.length - shown})</Text>
            </Pressable>
          )}
        </ScrollView>
        <FilterSheet visible={fOpen} f={f} setF={setF} onClose={() => setFOpen(false)} count={list.length} />
      </SafeAreaView>
    </Modal>
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
    <View style={{ gap: 10, marginTop: 12 }}>
      <View style={[s.panel, { padding: 12 }]}>
        <Text style={{ color: t.ink, fontWeight: "800", marginBottom: 8 }}>Composizione</Text>
        <View style={{ flexDirection: "row" }}>
          {Object.keys(comp).map((k) => (
            <View key={k} style={{ flex: 1, alignItems: "center" }}>
              <Text style={{ color: t.ink, fontSize: 20, fontWeight: "800" }}>{comp[k]}</Text>
              <Text style={{ color: t.ink2, fontSize: 12 }}>{k}</Text>
            </View>
          ))}
        </View>
      </View>
      {cols.length > 0 && (
        <View style={[s.panel, { padding: 12 }]}>
          <Text style={{ color: t.ink, fontWeight: "800", marginBottom: 8 }}>Colori</Text>
          <View style={{ flexDirection: "row", height: 10, borderRadius: 5, overflow: "hidden" }}>
            {cols.map(([x, n]) => (
              <View key={x} style={{ flex: n / totc, backgroundColor: t.cards[x] }} />
            ))}
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
            {cols.map(([x, n]) => (
              <View key={x} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.cards[x] }} />
                <Text style={{ color: t.ink }}>{x + " " + n}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
      {need > 0 && (
        <View style={[s.panel, { padding: 12 }]}>
          <Text style={{ color: t.ink, fontWeight: "800" }}>Dalla tua collezione</Text>
          <Text style={{ color: t.ink, fontSize: 20, fontWeight: "800", marginTop: 4 }}>{have + " / " + need}</Text>
          <Text style={{ color: t.ink2, fontSize: 13 }}>{have === need ? "Hai già tutte le copie del mazzo." : (need - have === 1 ? "Ti manca 1 copia" : "Ti mancano " + (need - have) + " copie") + " (contando la versione scelta nel mazzo)."}</Text>
          <View style={{ height: 5, borderRadius: 3, backgroundColor: t.surface2, marginTop: 6, overflow: "hidden" }}>
            <View style={{ width: (have / need) * 100 + "%", height: 5, backgroundColor: have === need ? "#46bd73" : t.accent }} />
          </View>
        </View>
      )}
      <Text style={{ color: t.ink2, fontSize: 12, lineHeight: 18 }}>
        {banNote() + " "}
        <Text style={{ color: t.accent }} onPress={() => Linking.openURL(banSource())}>
          Fonte ufficiale
        </Text>
      </Text>
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
