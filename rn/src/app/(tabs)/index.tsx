// Home: prossime uscite e prodotti usciti di recente.
import { Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { SETS, TYPES, UPCOMING, cdText, monthLabel, soonSet, typeOf } from "../../data";
import { openSet, openUpcoming } from "../../nav";
import { useTheme } from "../../theme";
import { Fit, Icon, Logo, PageTitle, SubHead, common } from "../../ui";


export default function Home() {
  const t = useTheme();
  const s = common(t);
  const upcoming = UPCOMING.slice().sort((a, b) => (a.from < b.from ? -1 : 1));
  const recent = SETS.filter((x) => !soonSet(x) && x.date && x.date.charAt(0) !== "0" && x.type !== "PB")
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 8);

  return (
    <SafeAreaView style={s.screen} edges={["top"]}>
      <ScrollView contentContainerStyle={s.pad}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <PageTitle>
            Digital Gate <Text style={{ color: t.accent }}>TCG</Text>
          </PageTitle>
          <Pressable onPress={() => router.push("/info")} hitSlop={10}>
            <Icon name="info" color={t.ink2} />
          </Pressable>
        </View>

        <SubHead>Prossime uscite</SubHead>
        {upcoming.map((u) => (
          <Pressable key={u.code} onPress={() => openUpcoming(u.code)} style={[s.panel, { flexDirection: "row", alignItems: "center", padding: 12, marginBottom: 8, gap: 12 }]}>
            <Logo code={u.code} />
            <View style={{ flex: 1 }}>
              <Fit style={{ color: t.ink, fontWeight: "700", fontSize: 15 }}>
                {u.code} · {u.name}
              </Fit>
              <Text style={{ color: t.accent, fontSize: 13, marginTop: 2 }}>{cdText(u)}</Text>
            </View>
          </Pressable>
        ))}

        <SubHead>Usciti di recente</SubHead>
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 }}>
          {recent.map((x) => (
            <View key={x.id} style={{ width: "50%", padding: 4 }}>
              <Pressable onPress={() => openSet(x.id)} style={[s.panel, { padding: 12, height: 120, justifyContent: "space-between" }]}>
                <Logo code={x.code} big />
                <View>
                  <Fit style={{ color: t.ink, fontWeight: "700" }}>{x.code}</Fit>
                  <Text style={{ color: t.ink2, fontSize: 12 }} numberOfLines={1}>
                    {TYPES[typeOf(x.code)]} · {monthLabel(x.date)}
                  </Text>
                </View>
              </Pressable>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

