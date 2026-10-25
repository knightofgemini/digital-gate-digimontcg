// Deckbuilding: i miei mazzi (copertina, colori, stato, avanzamento), nuovo mazzo e importazione da lista.
import { useState } from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { fullUrl } from "../../data";
import { banNote, banSource, deckColors, deckCover, deckState, deckStats, newDeck } from "../../decks";
import { ImportDeck } from "../../ImportDeck";
import { openDeck } from "../../nav";
import { S, useStore } from "../../store";
import { useTheme } from "../../theme";
import { PageTitle, common } from "../../ui";

export default function Mazzi() {
  const t = useTheme();
  const s = common(t);
  useStore();
  const [imp, setImp] = useState(false);
  const decks = S.decks.slice().sort((a, b) => (b.upd || 0) - (a.upd || 0));
  return (
    <SafeAreaView style={s.screen} edges={["top"]}>
      <ScrollView contentContainerStyle={s.pad}>
        <PageTitle>Deckbuilding</PageTitle>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable onPress={() => openDeck(newDeck("Nuovo mazzo " + (S.decks.length + 1)).id)} style={{ flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 10, backgroundColor: t.accent }}>
            <Text style={{ color: t.accentInk, fontWeight: "800" }}>+ Nuovo mazzo</Text>
          </Pressable>
          <Pressable onPress={() => setImp(true)} style={{ flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 10, backgroundColor: t.surface2 }}>
            <Text style={{ color: t.ink, fontWeight: "800" }}>Importa</Text>
          </Pressable>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -5, marginTop: 12 }}>
          {decks.map((d) => {
            const st = deckStats(d);
            const [k, label] = deckState(st);
            const cv = deckCover(d);
            return (
              <View key={d.id} style={{ width: "50%", padding: 5 }}>
                <Pressable onPress={() => openDeck(d.id)} style={[s.panel, { overflow: "hidden" }]}>
                  <View style={{ height: 110, backgroundColor: t.surface2 }}>{cv && <Image source={fullUrl(cv)} style={{ width: "100%", height: "100%" }} contentFit="cover" contentPosition="top" cachePolicy="disk" />}</View>
                  <View style={{ padding: 10, gap: 5 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={{ flex: 1, color: t.ink, fontWeight: "800" }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                        {d.name}
                      </Text>
                      {deckColors(d)
                        .slice(0, 4)
                        .map(([x]) => (
                          <View key={x} style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.cards[x] }} />
                        ))}
                    </View>
                    <View style={{ alignSelf: "flex-start", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, backgroundColor: k === "ok" ? "#2e9e57" : k === "inc" ? "#c77a0a" : "#c0261e" }}>
                      <Text style={{ color: "#fff", fontWeight: "800", fontSize: 11 }}>{label}</Text>
                    </View>
                    <Text style={{ color: t.ink2, fontSize: 12 }}>{"Principale " + st.main + "/50 · Digi-Egg " + st.egg + "/5"}</Text>
                    <View style={{ height: 4, borderRadius: 2, backgroundColor: t.surface2, overflow: "hidden" }}>
                      <View style={{ width: Math.min(100, (st.main / 50) * 100) + "%", height: 4, backgroundColor: st.main === 50 ? "#46bd73" : t.accent }} />
                    </View>
                  </View>
                </Pressable>
              </View>
            );
          })}
        </View>
        {!decks.length && <Text style={{ color: t.ink2, marginTop: 12 }}>Non hai ancora mazzi: creane uno nuovo o importalo da una lista.</Text>}
        <Text style={{ color: t.ink2, fontSize: 12, lineHeight: 18, marginTop: 16 }}>
          {banNote() + " "}
          <Text style={{ color: t.accent }} onPress={() => Linking.openURL(banSource())}>
            Fonte ufficiale
          </Text>
        </Text>
      </ScrollView>
      <ImportDeck
        visible={imp}
        label="Crea mazzo"
        onClose={() => setImp(false)}
        onDone={(cards) => {
          setImp(false);
          openDeck(newDeck("Mazzo importato", cards).id);
        }}
      />
    </SafeAreaView>
  );
}
