// Prodotti: tutti i set usciti, raggruppati per tipo, dal più recente; ricerca per codice, nome o carta contenuta.
import { useMemo, useState } from "react";
import { Pressable, SectionList, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CardSet, SETS, TYPES, cardsOfSet, fold, normQ, soonSet } from "../../data";
import { setStats, useStore } from "../../store";
import { openSet } from "../../nav";
import { useTheme } from "../../theme";
import { Fit, Logo, PageTitle, common } from "../../ui";

const CHIPS: [string, string][] = [["ALL", "Tutti"], ["BT", "Booster"], ["EX", "Extra"], ["ST", "Starter"], ["LM", "Limited"], ["PB", "Premium"], ["AL", "Altri"]];

export default function Prodotti() {
  const t = useTheme();
  const s = common(t);
  const [q, setQ] = useState("");
  const [type, setType] = useState("ALL");

  const { sections, hits } = useMemo(() => {
    const nq = normQ(q);
    const hits: Record<string, number> = {};
    const list = SETS.filter((x) => {
      if (soonSet(x)) return false;
      if (type !== "ALL" && x.type !== type) return false;
      if (!nq || normQ(x.code + " " + x.name).indexOf(nq) >= 0) return true;
      const parts = nq.split(" ");
      const n = cardsOfSet(x.id).filter((c) => parts.every((p) => fold(c.name).indexOf(p) >= 0)).length;
      if (n) hits[x.id] = n;
      return n > 0;
    });
    const sections = Object.keys(TYPES)
      .map((k) => ({ title: TYPES[k], type: k, data: list.filter((x) => x.type === k) }))
      .filter((x) => x.data.length);
    return { sections, hits };
  }, [q, type]);

  return (
    <SafeAreaView style={s.screen} edges={["top"]}>
      <SectionList
        sections={sections}
        keyExtractor={(x) => x.id}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        ListHeaderComponent={
          <View style={{ paddingTop: 16 }}>
            <PageTitle>Prodotti</PageTitle>
            <TextInput value={q} onChangeText={setQ} placeholder="Cerca un prodotto o una carta" placeholderTextColor={t.ink2} style={s.search} autoCorrect={false} />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              {CHIPS.map(([k, label]) => (
                <Pressable key={k} onPress={() => setType(k)} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: type === k ? t.accent : t.line, backgroundColor: type === k ? t.accent : t.surface }}>
                  <Text style={{ color: type === k ? t.accentInk : t.ink, fontWeight: "600", fontSize: 13 }}>{label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
        ListEmptyComponent={<Text style={[s.muted, { marginTop: 20 }]}>Nessun set corrisponde ai filtri.</Text>}
        renderSectionHeader={({ section }) => (
          <Text style={{ color: t.ink2, fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6, marginTop: 20, marginBottom: 8 }}>
            {section.title} · {section.data.length}
          </Text>
        )}
        renderItem={({ item, section }) => <SetRow x={item} hit={hits[item.id]} withLogo={section.type !== "PB"} />}
      />
    </SafeAreaView>
  );
}

function SetRow({ x, hit, withLogo }: { x: CardSet; hit?: number; withLogo: boolean }) {
  const t = useTheme();
  const s = common(t);
  useStore();
  const st = setStats()[x.id] || { n: 0, h: 0 };
  return (
    <Pressable onPress={() => openSet(x.id)} style={[s.panel, { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, marginBottom: 6, gap: 10 }]}>
      {withLogo && <Logo code={x.code} />}
      <Text style={{ color: t.accent, fontWeight: "800", width: 58 }} numberOfLines={1} adjustsFontSizeToFit>
        {x.code}
      </Text>
      <View style={{ flex: 1 }}>
        <Fit style={{ color: t.ink, fontWeight: "600" }}>{x.name}</Fit>
        {!!hit && <Text style={{ color: t.ink2, fontSize: 12 }}>{hit + (hit === 1 ? " carta trovata" : " carte trovate")}</Text>}
      </View>
      <Text style={{ color: st.n && st.h === st.n ? "#46bd73" : t.ink2, fontSize: 13, fontWeight: st.h ? "700" : "400" }}>{st.n ? st.h + "/" + st.n : "—"}</Text>
    </Pressable>
  );
}
