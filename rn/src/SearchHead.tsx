// Intestazione delle pagine di ricerca (Carte e Collezione).
import { Pressable, View } from "react-native";
import { Text, TextInput } from "./Text";
import { router } from "expo-router";
import Svg, { Circle, Path } from "react-native-svg";
import { ActiveChips } from "./FilterSheet";
import { Filters, fl } from "./filters";
import { ViewToggle } from "./items";
import { useTheme } from "./theme";
import { PageTitle, common } from "./ui";

// intestazione con ricerca, Filtri, Cerca in, numero di carte e vista (usata anche dalla collezione)
export function SearchHead({ title, q, setQ, f, setF, openF, n, children }: { title: string; q: string; setQ: (s: string) => void; f: Filters; setF: (f: Filters) => void; openF: () => void; n: number; children?: React.ReactNode }) {
  const t = useTheme();
  const s = common(t);
  const nf = (Object.keys(f) as (keyof Filters)[]).reduce((m, k) => m + (k === "qm" || !f[k] ? 0 : fl(f, k).length), 0);
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, borderBottomWidth: 1, borderColor: t.line }}>
      <PageTitle>{title}</PageTitle>
      {children}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <TextInput value={q} onChangeText={setQ} placeholder={f.qm === "text" ? "Cerca nel testo (es. Blocker)" : "Nome o codice (es. Agumon, BT27-001)"} placeholderTextColor={t.ink2} style={[s.search, { flex: 1 }]} autoCorrect={false} returnKeyType="search" />
        <Pressable onPress={openF} style={{ paddingHorizontal: 14, justifyContent: "center", borderRadius: 10, borderWidth: 1, borderColor: nf ? t.accent : t.line, backgroundColor: nf ? t.accent : t.surface }}>
          <Text style={{ color: nf ? t.accentInk : t.ink, fontWeight: "700" }}>Filtri{nf ? " · " + nf : ""}</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/scansiona")} accessibilityLabel="Scansiona una carta con la fotocamera" style={{ width: 46, alignItems: "center", justifyContent: "center", borderRadius: 10, borderWidth: 1, borderColor: t.line, backgroundColor: t.surface }}>
          <Svg width={22} height={22} viewBox="0 0 24 24">
            <Path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" stroke={t.ink} strokeWidth={2} fill="none" strokeLinejoin="round" />
            <Circle cx={12} cy={13.5} r={3.6} stroke={t.ink} strokeWidth={2} fill="none" />
          </Svg>
        </Pressable>
      </View>
      <View style={{ flexDirection: "row", gap: 6, marginTop: 8, alignItems: "center" }}>
        {[
          ["", "Tutto"],
          ["name", "Nome"],
          ["text", "Testo"],
        ].map(([v, label]) => (
          <Pressable key={v} onPress={() => setF({ ...f, qm: v })} style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14, backgroundColor: f.qm === v ? t.ink : t.surface2 }}>
            <Text style={{ color: f.qm === v ? t.bg : t.ink, fontWeight: "600", fontSize: 13 }}>{label}</Text>
          </Pressable>
        ))}
        <Text style={[s.muted, { fontSize: 13, marginLeft: "auto" }]}>{n + (n === 1 ? " carta" : " carte")}</Text>
        <ViewToggle />
      </View>
      <ActiveChips f={f} setF={setF} />
    </View>
  );
}
