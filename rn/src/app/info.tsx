// Informazioni: cos'è l'app, da dove arrivano i dati, dove resta la collezione.
import { Linking, Pressable, ScrollView, View } from "react-native";
import { Text } from "../Text";
import { router } from "expo-router";
import { useTheme } from "../theme";
import { PageTitle, common } from "../ui";
import { Screen } from "../chrome";

export default function Info() {
  const t = useTheme();
  const s = common(t);
  const P = ({ children }: { children: string }) => <Text style={{ color: t.ink, fontSize: 15, lineHeight: 22, marginBottom: 10 }}>{children}</Text>;
  return (
    <Screen>
      <ScrollView contentContainerStyle={s.pad}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} hitSlop={12} style={{ marginBottom: 12 }}>
          <Text style={{ color: t.accent, fontSize: 16, fontWeight: "600" }}>‹ Indietro</Text>
        </Pressable>
        <PageTitle>Informazioni</PageTitle>
        <View style={[s.panel, { padding: 16 }]}>
          <P>Digital Gate è un catalogo non ufficiale del Digimon Card Game (carte in inglese): prodotti, prossime uscite, ricerca carte, collezione e deckbuilding.</P>
          <P>I testi delle carte restano in inglese esattamente come stampati. Dati delle carte dalla raccolta TakaOtaku, controllati e corretti sulle immagini ufficiali; caratteristiche dei prodotti dal sito ufficiale Bandai.</P>
          <P>La collezione e i mazzi restano salvati su questo dispositivo.</P>
          <Text style={{ color: t.ink2, fontSize: 13, lineHeight: 19 }}>Immagini e marchi © Bandai, Akiyoshi Hongo, Toei Animation.</Text>
          <Pressable onPress={() => Linking.openURL("https://knightofgemini.github.io/digital-gate-digimontcg/")} style={{ marginTop: 12 }}>
            <Text style={{ color: t.accent, fontWeight: "700" }}>Apri il sito ↗</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}
