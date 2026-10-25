// Ricerca carte: griglia di miniature, ricerca per nome o codice ordinata per rilevanza.
import { useMemo, useState } from "react";
import { FlatList, Text, TextInput, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CARDS, SETS, normQ, searchCards } from "../../data";
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
  const { width } = useWindowDimensions();
  const cols = Math.max(3, Math.floor(width / 130));
  const list = useMemo(() => {
    const nq = normQ(q);
    return nq ? searchCards(ALL, nq) : ALL;
  }, [q]);

  return (
    <SafeAreaView style={s.screen} edges={["top"]}>
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
        <PageTitle>Ricerca carte</PageTitle>
        <TextInput value={q} onChangeText={setQ} placeholder="Nome o codice (es. Agumon, BT27-001)" placeholderTextColor={t.ink2} style={s.search} autoCorrect={false} returnKeyType="search" />
        <Text style={[s.muted, { fontSize: 13, marginTop: 8 }]}>{list.length + (list.length === 1 ? " carta" : " carte")}</Text>
      </View>
      <FlatList
        key={cols}
        data={list}
        numColumns={cols}
        keyExtractor={(c) => c.k}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 6, paddingBottom: 20 }}
        initialNumToRender={24}
        windowSize={7}
        renderItem={({ item }) => <CardCell c={item} width={(width - 12) / cols} onPress={() => openCard(item)} />}
        ListEmptyComponent={<Text style={[s.muted, { padding: 16 }]}>Nessuna carta corrisponde alla ricerca.</Text>}
      />
    </SafeAreaView>
  );
}
