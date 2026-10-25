// Scheda carta: intestazione con codice, set e rarità; immagine; tag; Costo/DP/Rarità; testi della carta con le icone; Alternative Art.
// Testi delle carte sempre in inglese come stampati, etichette in italiano.
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { BYCODE, BYKEY, RARITY, SETBY, fullUrl, markText, thumbUrl, verLabel } from "../../data";
import { Rich } from "../../rich";
import { useTheme } from "../../theme";
import { ColorBand, Fit, Tag, common } from "../../ui";

export default function Carta() {
  const { k } = useLocalSearchParams<{ k: string }>();
  const c = BYKEY[k];
  const t = useTheme();
  const s = common(t);
  const { width } = useWindowDimensions();
  if (!c) return null;
  const set = SETBY[c.from || c.set];
  const ver = verLabel(c.ver);
  const mark = markText(c);
  const rar = (c.rar || "").trim();
  const alts = (BYCODE[c.code] || []).filter((x) => x.k !== c.k);
  const maxW = Math.min(width, 560);

  const blocks: [string, string][] = [
    ["Effetto", c.eff],
    ["Ereditato", c.inh],
    ["Sicurezza", c.sec],
  ];
  const side = c.x && c.x.d;

  return (
    <SafeAreaView style={s.screen} edges={["top"]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderColor: t.line }}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/carte"))} hitSlop={12}>
          <Text style={{ color: t.accent, fontSize: 22, fontWeight: "600" }}>✕</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Fit style={{ color: t.ink, fontWeight: "800", fontSize: 15 }}>
            {c.code} <Text style={{ color: t.accent }}>{set ? set.code + " · " + set.name : ""}</Text>
          </Fit>
          <Text style={{ color: t.ink2, fontSize: 12 }} numberOfLines={1}>
            {[mark, rar ? RARITY[rar] || rar : "", ver].filter(Boolean).join(" · ")}
          </Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, alignSelf: "center", width: maxW }}>
        <Fit style={{ color: t.ink, fontSize: 22, fontWeight: "800", marginBottom: 12 }}>{c.name}</Fit>
        <Image source={fullUrl(c)} placeholder={thumbUrl(c)} placeholderContentFit="contain" style={{ width: "100%", aspectRatio: 0.716, borderRadius: 12 }} contentFit="contain" cachePolicy="disk" transition={150} />
        <View style={{ marginVertical: 10 }}>
          <ColorBand colors={c.colors} height={5} />
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          <Tag text={[c.ct, c.lv].filter(Boolean).join(" ")} />
          {c.colors.map((col) => (
            <Tag key={col} text={col} bg={t.cards[col]} ink={col === "White" || col === "Yellow" ? "#111" : "#fff"} />
          ))}
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {c.form ? <Tag text={c.form} /> : null}
          {c.attr ? <Tag text={c.attr} /> : null}
          {c.sp
            .split("/")
            .filter(Boolean)
            .map((x) => (
              <Tag key={x} text={x} bg="#ffffff" ink="#111" />
            ))}
        </View>
        <View style={{ flexDirection: "row", gap: 8, marginVertical: 8 }}>
          <Box label="Costo" value={c.play || "–"} />
          <Box label="DP" value={c.dp || "–"} />
          <Box label="Rarità" value={(mark ? mark + " " : "") + (rar || "–")} />
        </View>
        {!!c.evo && <Section title="Digievoluzione" text={c.evo.split("\n").filter(Boolean).join(" • ")} />}
        {blocks.filter(([, v]) => v).map(([title, v]) => (
          <Section key={title} title={title} text={v} />
        ))}
        {side && <Section title={"Effetto Option · Use " + side.c + (side.col ? " · " + side.col : "")} text={side.l.join("\n")} />}
        {!!c.extra && <Section title="Altre regole" text={c.extra} />}
        {alts.length > 0 && (
          <View style={{ marginTop: 18 }}>
            <Text style={{ color: t.ink, fontWeight: "800", fontSize: 16, marginBottom: 8 }}>Altre versioni ({alts.length})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {alts.map((a) => (
                <Pressable key={a.k} onPress={() => router.setParams({ k: a.k })} style={{ width: 96, marginRight: 8 }}>
                  <Image source={thumbUrl(a)} style={{ width: 96, aspectRatio: 0.716, borderRadius: 6, backgroundColor: t.surface2 }} cachePolicy="disk" />
                  <Text style={{ color: t.ink2, fontSize: 11, marginTop: 4 }} numberOfLines={1}>
                    {SETBY[a.from || a.set]?.code} {markText(a) || (a.suf ? "Alt" : "")}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Box({ label, value }: { label: string; value: string }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.surface, borderColor: t.line, borderWidth: 1, borderRadius: 10, padding: 10, alignItems: "center" }}>
      <Text style={{ color: t.ink2, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: t.ink, fontSize: 17, fontWeight: "700", marginTop: 2 }} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

function Section({ title, text }: { title: string; text: string }) {
  const t = useTheme();
  return (
    <View style={{ backgroundColor: t.surface, borderColor: t.line, borderWidth: 1, borderRadius: 10, padding: 12, marginTop: 10 }}>
      <Text style={{ color: t.accent, fontWeight: "700", marginBottom: 6 }}>{title}</Text>
      <Rich text={text} style={{ color: t.ink, fontSize: 14, lineHeight: 22 }} />
    </View>
  );
}
