// Deckbuilding (come renderDeckListDesk dell'app attuale, usato anche sul telefono): "Nuovo mazzo" e "Importa" (riquadro con
// la lista da incollare sotto i pulsanti), copertine dei mazzi a tutta larghezza con nome, colori, stato e avanzamento,
// riquadro tratteggiato "Nuovo mazzo", nota sulle regole e la lista ban.
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { DISPLAY, Text } from "../../Text";
import { Image } from "expo-image";
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { fullUrl } from "../../data";
import { deckColors, deckCover, deckState, deckStats, newDeck } from "../../decks";
import { openDeck } from "../../nav";
import { S, useStore } from "../../store";
import { useTheme } from "../../theme";
import { PageTitle } from "../../ui";
import { Screen, useBarState } from "../../chrome";
import { Btn, ICO_PLUS, Progress } from "../../visual";
import { BanNote, DBadge, ImportPanel } from "../../deckui";

export default function Mazzi() {
  const t = useTheme();
  const bar = useBarState();
  useStore();
  const [imp, setImp] = useState(false);
  const decks = S.decks.slice().sort((a, b) => (b.upd || 0) - (a.upd || 0));
  const create = () => openDeck(newDeck("Nuovo mazzo " + (S.decks.length + 1)).id);
  return (
    <Screen bs={bar}>
      <ScrollView onScroll={bar.onScroll} scrollEventThrottle={16} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 4 + bar.pad, paddingBottom: 28 }}>
        <PageTitle>Deckbuilding</PageTitle>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
          <Btn label="Nuovo mazzo" pri icon={ICO_PLUS} onPress={create} />
          <Btn label="Importa" onPress={() => setImp(true)} />
        </View>
        {imp ? (
          <ImportPanel
            label="Crea mazzo"
            onClose={() => setImp(false)}
            onDone={(cards) => {
              setImp(false);
              openDeck(newDeck("Mazzo importato", cards).id);
            }}
          />
        ) : null}
        <View style={{ gap: 14 }}>
          {decks.map((d) => {
            const st = deckStats(d);
            const [k, label] = deckState(st);
            const cv = deckCover(d);
            return (
              <Pressable key={d.id} onPress={() => openDeck(d.id)} style={{ borderWidth: 1, borderColor: t.line, backgroundColor: t.surface, borderRadius: 12, overflow: "hidden" }}>
                <View style={{ height: 130, overflow: "hidden" }}>
                  <Svg style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100">
                    <Defs>
                      <RadialGradient id={"dk" + d.id} cx="30" cy="15" rx="77" ry="63" gradientUnits="userSpaceOnUse">
                        <Stop offset="0" stopColor="#26365a" />
                        <Stop offset="1" stopColor="#0e1628" />
                      </RadialGradient>
                    </Defs>
                    <Rect width="100" height="100" fill={`url(#dk${d.id})`} />
                  </Svg>
                  {cv ? <Image source={fullUrl(cv)} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" contentPosition={{ left: "50%", top: "22%" }} cachePolicy="disk" /> : null}
                </View>
                <View style={{ paddingTop: 12, paddingHorizontal: 14, paddingBottom: 14, gap: 6 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Text style={{ flex: 1, color: t.ink, fontFamily: DISPLAY, fontWeight: "700", fontSize: 16.3 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                      {d.name}
                    </Text>
                    <View style={{ flexDirection: "row", gap: 4 }}>
                      {deckColors(d)
                        .slice(0, 4)
                        .map(([x]) => (
                          <View key={x} style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: t.cards[x] }} />
                        ))}
                    </View>
                  </View>
                  <DBadge k={k} label={label} />
                  <Text style={{ color: t.ink2, fontSize: 12.8 }}>{"Principale " + st.main + "/50 · Digi-Egg " + st.egg + "/5"}</Text>
                  <Progress h={Math.min(st.main, 50)} n={50} style={{ marginTop: 2 }} />
                </View>
              </Pressable>
            );
          })}
          <Pressable onPress={create} style={{ minHeight: 110, alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderStyle: "dashed", borderColor: t.line, backgroundColor: t.surface, borderRadius: 12 }}>
            <Svg width={30} height={30} viewBox="0 0 24 24">
              <Path d={ICO_PLUS} stroke={t.accent} strokeWidth={2.2} strokeLinecap="round" fill="none" />
            </Svg>
            <Text style={{ color: t.ink2, fontFamily: DISPLAY, fontWeight: "700", fontSize: 16.3 }}>{decks.length ? "Nuovo mazzo" : "Il tuo primo mazzo"}</Text>
            <Text style={{ color: t.ink2, fontSize: 12.8 }}>Parti da una carta o da un'idea</Text>
          </Pressable>
        </View>
        <BanNote />
      </ScrollView>
    </Screen>
  );
}
