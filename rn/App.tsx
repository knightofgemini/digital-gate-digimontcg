// Primo assaggio in React Native + Expo: ricerca carte (griglia di miniature) e scheda carta.
import { useEffect, useMemo, useState } from "react";
import { BackHandler, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { CARDS, Card, RARITY, fold, fullUrl, setOf, thumbUrl } from "./src/data";
import { Theme, useTheme } from "./src/theme";

export default function App() {
  const [open, setOpen] = useState<Card | null>(null);
  const t = useTheme();

  // Tasto/gesto indietro di Android: dalla scheda carta torna all'elenco.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (open) {
        setOpen(null);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [open]);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
        <StatusBar style="auto" />
        <CardList onOpen={setOpen} hidden={!!open} />
        {open && <CardSheet card={open} onClose={() => setOpen(null)} />}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function CardList({ onOpen, hidden }: { onOpen: (c: Card) => void; hidden: boolean }) {
  const t = useTheme();
  const s = styles(t);
  const [q, setQ] = useState("");
  const { width } = useWindowDimensions();
  const cols = Math.max(3, Math.floor(width / 130));
  const list = useMemo(() => {
    const f = fold(q.trim());
    return f ? CARDS.filter((c) => c.search.includes(f)) : CARDS;
  }, [q]);

  return (
    <View style={[{ flex: 1 }, hidden && { display: "none" }]}>
      <View style={s.bar}>
        <Text style={s.title}>
          Digital Gate <Text style={{ color: t.accent }}>· Ricerca carte</Text>
        </Text>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Nome o codice (es. Agumon, BT27-001)"
          placeholderTextColor={t.ink2}
          style={s.search}
          autoCorrect={false}
        />
        <Text style={s.count}>{list.length} carte</Text>
      </View>
      <FlatList
        key={cols}
        data={list}
        numColumns={cols}
        keyExtractor={(c) => String(c.idx)}
        contentContainerStyle={{ padding: 6 }}
        initialNumToRender={24}
        windowSize={7}
        renderItem={({ item }) => (
          <Pressable style={[s.cell, { width: (width - 12) / cols }]} onPress={() => onOpen(item)}>
            <Image source={thumbUrl(item)} style={s.thumb} contentFit="cover" cachePolicy="disk" transition={120} />
            <Text style={s.code} numberOfLines={1}>
              {item.code}
            </Text>
            <Text style={s.name} numberOfLines={1}>
              {item.name}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

function CardSheet({ card: c, onClose }: { card: Card; onClose: () => void }) {
  const t = useTheme();
  const s = styles(t);
  const set = setOf(c);
  // Testi delle carte sempre in inglese come stampati; etichette in italiano.
  const blocks: [string, string][] = [
    ["Digievoluzione", c.evo.split("\n").filter(Boolean).join(" • ")],
    ["Effetto", c.eff],
    ["Ereditato", c.inh],
    ["Sicurezza", c.sec],
    ["Altre regole", c.extra],
  ];
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: t.bg }]}>
      <View style={s.sheetHead}>
        <Pressable onPress={onClose} hitSlop={12}>
          <Text style={s.back}>‹ Indietro</Text>
        </Pressable>
        <Text style={s.headCode}>
          {c.code} <Text style={{ color: t.accent }}>{set ? set.code + " " + set.name : ""}</Text>
        </Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={s.cardName} numberOfLines={1} adjustsFontSizeToFit>
          {c.name}
        </Text>
        <Image source={fullUrl(c)} placeholder={thumbUrl(c)} style={s.big} contentFit="contain" cachePolicy="disk" transition={150} />
        <View style={s.tags}>
          <Tag t={t} text={[c.type, c.lv].filter(Boolean).join(" ")} />
          {c.colors.map((col) => (
            <Tag key={col} t={t} text={col} bg={t.cards[col]} ink={col === "White" || col === "Yellow" ? "#111" : "#fff"} />
          ))}
        </View>
        <View style={s.tags}>
          {[c.form, c.attr].filter(Boolean).map((x) => (
            <Tag key={x} t={t} text={x} />
          ))}
          {c.trait
            .split("/")
            .filter(Boolean)
            .map((x) => (
              <Tag key={x} t={t} text={x} bg="#ffffff" ink="#111" />
            ))}
        </View>
        <View style={s.boxes}>
          <Box t={t} label="Costo" value={c.play || "–"} />
          <Box t={t} label="DP" value={c.dp || "–"} />
          <Box t={t} label="Rarità" value={RARITY[c.rar] || c.rar || "–"} />
        </View>
        {blocks
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <View key={k} style={s.block}>
              <Text style={s.blockTitle}>{k}</Text>
              <Text style={s.blockText}>{v}</Text>
            </View>
          ))}
      </ScrollView>
    </View>
  );
}

function Tag({ t, text, bg, ink }: { t: Theme; text: string; bg?: string; ink?: string }) {
  if (!text) return null;
  return (
    <View style={{ backgroundColor: bg || t.surface2, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginRight: 6, marginBottom: 6 }}>
      <Text style={{ color: ink || t.ink, fontSize: 13, fontWeight: "600" }}>{text}</Text>
    </View>
  );
}

function Box({ t, label, value }: { t: Theme; label: string; value: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: t.surface, borderColor: t.line, borderWidth: 1, borderRadius: 10, padding: 10, marginHorizontal: 4, alignItems: "center" }}>
      <Text style={{ color: t.ink2, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: t.ink, fontSize: 17, fontWeight: "700", marginTop: 2 }} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    bar: { padding: 16, paddingBottom: 10, borderBottomWidth: 1, borderColor: t.line, backgroundColor: t.bg },
    title: { color: t.ink, fontSize: 20, fontWeight: "700", marginBottom: 10 },
    search: { backgroundColor: t.surface, borderColor: t.line, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: t.ink, fontSize: 16 },
    count: { color: t.ink2, fontSize: 13, marginTop: 8 },
    cell: { padding: 4 },
    thumb: { width: "100%", aspectRatio: 0.716, borderRadius: 6, backgroundColor: t.surface2 },
    code: { color: t.ink2, fontSize: 11, marginTop: 4 },
    name: { color: t.ink, fontSize: 12, fontWeight: "600" },
    sheetHead: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderBottomWidth: 1, borderColor: t.line },
    back: { color: t.accent, fontSize: 16, fontWeight: "600" },
    headCode: { color: t.ink, fontSize: 15, fontWeight: "700", flexShrink: 1 },
    cardName: { color: t.ink, fontSize: 22, fontWeight: "700", marginBottom: 12 },
    big: { width: "100%", aspectRatio: 0.716, borderRadius: 12, marginBottom: 14 },
    tags: { flexDirection: "row", flexWrap: "wrap" },
    boxes: { flexDirection: "row", marginHorizontal: -4, marginVertical: 10 },
    block: { backgroundColor: t.surface, borderColor: t.line, borderWidth: 1, borderRadius: 10, padding: 12, marginTop: 10 },
    blockTitle: { color: t.accent, fontWeight: "700", marginBottom: 6 },
    blockText: { color: t.ink, fontSize: 14, lineHeight: 20 },
  });
