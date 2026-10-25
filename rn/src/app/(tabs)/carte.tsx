// Ricerca carte: ricerca (Tutto / Nome / Testo), foglio dei filtri, filtri attivi come etichette, griglia di miniature.
import { useMemo, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CARDS, SETS, normQ, relevance } from "../../data";
import { ActiveChips, FilterSheet } from "../../FilterSheet";
import { EMPTY, Filters, anyFlt, cardMatches, fl, srcCards } from "../../filters";
import { openCard } from "../../nav";
import { useTheme } from "../../theme";
import { CardCell, PageTitle, common } from "../../ui";

// dal prodotto più recente al più vecchio, dentro lo stesso prodotto in ordine di numero
const ORDER: Record<string, number> = {};
SETS.forEach((s, i) => (ORDER[s.id] = i));
const ALL = CARDS.slice().sort((a, b) => (ORDER[a.set] ?? 999) - (ORDER[b.set] ?? 999) || a.code.localeCompare(b.code, "en", { numeric: true }));

export default function Carte() {
  const t = useTheme();
  const s = common(t);
  const [q, setQ] = useState("");
  const [f, setF] = useState<Filters>(EMPTY);
  const [open, setOpen] = useState(false);
  const { width } = useWindowDimensions();
  const cols = Math.max(3, Math.floor(width / 130));

  const list = useMemo(() => {
    const nq = normQ(q);
    const l = srcCards(f, ALL).filter((c) => cardMatches(c, nq, f));
    if (!nq || f.qm === "text") return l;
    return l
      .map((c, j) => ({ c, j, r: relevance(c, nq) }))
      .sort((a, b) => a.r - b.r || a.j - b.j)
      .map((o) => o.c);
  }, [q, f]);

  const nf = (Object.keys(f) as (keyof Filters)[]).reduce((n, k) => n + (k === "qm" || !f[k] ? 0 : fl(f, k).length), 0);

  return (
    <SafeAreaView style={s.screen} edges={["top"]}>
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
        <PageTitle>Ricerca carte</PageTitle>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder={f.qm === "text" ? "Cerca nel testo (es. Blocker)" : "Nome o codice (es. Agumon, BT27-001)"}
            placeholderTextColor={t.ink2}
            style={[s.search, { flex: 1 }]}
            autoCorrect={false}
            returnKeyType="search"
          />
          <Pressable onPress={() => setOpen(true)} style={{ paddingHorizontal: 14, justifyContent: "center", borderRadius: 10, borderWidth: 1, borderColor: nf ? t.accent : t.line, backgroundColor: nf ? t.accent : t.surface }}>
            <Text style={{ color: nf ? t.accentInk : t.ink, fontWeight: "700" }}>Filtri{nf ? " · " + nf : ""}</Text>
          </Pressable>
        </View>
        <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
          {[
            ["", "Tutto"],
            ["name", "Nome"],
            ["text", "Testo"],
          ].map(([v, label]) => (
            <Pressable key={v} onPress={() => setF({ ...f, qm: v })} style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14, backgroundColor: f.qm === v ? t.ink : t.surface2 }}>
              <Text style={{ color: f.qm === v ? t.bg : t.ink, fontWeight: "600", fontSize: 13 }}>{label}</Text>
            </Pressable>
          ))}
          <Text style={[s.muted, { fontSize: 13, marginLeft: "auto", alignSelf: "center" }]}>{list.length + (list.length === 1 ? " carta" : " carte")}</Text>
        </View>
        <ActiveChips f={f} setF={setF} />
      </View>
      <FlatList
        key={cols}
        data={list}
        numColumns={cols}
        keyExtractor={(c) => c.k}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingHorizontal: 6, paddingBottom: 20 }}
        initialNumToRender={24}
        windowSize={7}
        renderItem={({ item }) => <CardCell c={item} width={(width - 12) / cols} onPress={() => openCard(item, list)} />}
        ListEmptyComponent={<Text style={[s.muted, { padding: 16 }]}>{q || anyFlt(f) ? "Nessuna carta corrisponde ai filtri." : ""}</Text>}
      />
      <FilterSheet visible={open} f={f} setF={setF} onClose={() => setOpen(false)} count={list.length} />
    </SafeAreaView>
  );
}
