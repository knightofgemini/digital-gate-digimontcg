// Regole: domande e risposte ufficiali di Bandai sulle regole (27 novembre 2026, ramo `faq-carte`, richiesta
// dell'utente), divise per argomento come sul sito (world.digimoncard.com/rule/, "Rule Q&A") e con una ricerca.
// Dati in src/qa.json (`r`), aggiornati ogni notte da qa.yml; testi in inglese come sul sito, mai tradotti.
import { useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { DISPLAY, Text, TextInput } from "../Text";
import { useTheme } from "../theme";
import { PageTitle, common } from "../ui";
import { Screen, useBarState } from "../chrome";
import { QAItem, RuleQA, byRecent, qaDate, rulesQA, tags, useQA } from "../qa";
import { Rich } from "../rich";

// nomi delle sezioni del sito in italiano (solo le etichette dell'app; le domande restano in inglese)
const CATS: [string, string][] = [
  ["Basic Rules", "Regole base"],
  ["Keyword Effects", "Parole chiave"],
  ["Effect Timings", "Momenti degli effetti"],
  ["Timings", "Tempistiche"],
  ["Card Types", "Tipi di carta"],
  ["Effect Icons", "Icone degli effetti"],
  ["Glossary", "Glossario"],
];
const MESI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
// nome della voce con la stessa capsula del testo delle carte: le parole chiave come ＜Blocker＞, i momenti e le zone
// sono già tra [ ] nel sito (27 novembre 2026, segnalato dall'utente: le voci erano testo semplice)
const KWG = new Set(["Alliance"]); // parole chiave che il sito mette nel Glossario
const voce = (cat: string, title: string) => (cat === "Keyword Effects" || KWG.has(title) ? "＜" + title + "＞" : tags(title).replace(/\]\?$/, "]"));
type Row = { k: string; kind: "grp"; cat: string; title: string; list: RuleQA[] } | { k: string; kind: "qa"; it: RuleQA; where: string };

export default function Regole() {
  const t = useTheme();
  const bar = useBarState();
  const s = common(t);
  useQA();
  const [cat, setCat] = useState("Basic Rules");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const all = rulesQA();
  const label = (c: string) => (CATS.find((x) => x[0] === c) || [c, c])[1];
  const rows: Row[] = useMemo(() => {
    const w = q.trim().toLowerCase();
    if (w.length >= 2) {
      // ricerca in tutte le sezioni: domande, risposte e nomi delle voci
      return byRecent(all, (r) => r[5], (r) => r[2])
        .filter((r) => (r[1] + "\n" + r[3] + "\n" + r[4]).toLowerCase().includes(w))
        .slice(0, 120)
        .map((r) => ({ k: "q" + r[2], kind: "qa" as const, it: r, where: label(r[0]) + " · " + r[1] }));
    }
    const groups = new Map<string, RuleQA[]>();
    for (const r of all) if (r[0] === cat) (groups.get(r[1]) || groups.set(r[1], []).get(r[1])!).push(r);
    return [...groups].map(([title, list]) => ({ k: cat + "|" + title, kind: "grp" as const, cat, title, list: byRecent(list, (r) => r[5], (r) => r[2]) }));
  }, [q, cat, all]);
  const now = Date.now();
  const d = qaDate();
  const head = (
    <View>
      <PageTitle>Regole</PageTitle>
      <Text style={{ color: t.ink2, fontSize: 13.5, lineHeight: 19, marginTop: -4, marginBottom: 10 }}>
        Domande e risposte ufficiali di Bandai sulle regole del gioco{d ? ", aggiornate al " + +d.slice(8) + " " + MESI[+d.slice(5, 7) - 1] + " " + d.slice(0, 4) : ""}. Le risposte sono in inglese, come sul sito ufficiale.
      </Text>
      <TextInput value={q} onChangeText={setQ} placeholder="Cerca (es. Blocker, security check)" placeholderTextColor={t.ink2} style={[s.search, { marginBottom: 10 }]} autoCorrect={false} returnKeyType="search" />
      {q.trim().length < 2 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -14, marginBottom: 8 }} contentContainerStyle={{ paddingHorizontal: 14, gap: 6 }}>
          {CATS.map(([c, l]) => {
            const n = all.filter((r) => r[0] === c).length;
            const on = c === cat;
            return (
              <Pressable key={c} onPress={() => setCat(c)} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, height: 36, borderRadius: 18, backgroundColor: on ? t.accent : t.surface, borderWidth: 1, borderColor: on ? t.accent : t.line }}>
                <Text style={{ color: on ? t.accentInk : t.ink, fontWeight: "600", fontSize: 13.5 }}>{l}</Text>
                <Text style={{ color: on ? t.accentInk : t.ink2, fontFamily: DISPLAY, fontWeight: "700", fontSize: 11.5, opacity: 0.85 }}>{n}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : (
        <Text style={{ color: t.ink2, fontSize: 12.5, marginBottom: 8 }}>{rows.length ? rows.length + (rows.length === 120 ? "+" : "") + " risultati" : "Nessun risultato"}</Text>
      )}
    </View>
  );
  return (
    <Screen bs={bar}>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.k}
        onScroll={bar.onScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={head}
        contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 4 + bar.pad, paddingBottom: 40 }}
        renderItem={({ item: r }) =>
          r.kind === "qa" ? (
            <View style={{ marginBottom: 8 }}>
              <Text style={{ color: t.ink2, fontSize: 11.5, marginBottom: 3 }} numberOfLines={1}>
                {r.where}
              </Text>
              <QAItem n={r.it[2]} q={r.it[3]} a={r.it[4]} d={r.it[5]} now={now} />
            </View>
          ) : (
            <View style={{ marginBottom: 8, borderWidth: 1, borderColor: t.line, borderRadius: 12, backgroundColor: t.surface }}>
              <Pressable onPress={() => setOpen({ ...open, [r.k]: !open[r.k] })} style={{ minHeight: 50, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Rich text={voce(r.cat, r.title)} style={{ color: t.ink, fontWeight: "600", fontSize: 15, lineHeight: 22 }} />
                </View>
                <Text style={{ color: t.ink2, fontFamily: DISPLAY, fontWeight: "700", fontSize: 12 }}>{r.list.length}</Text>
                <Svg width={18} height={18} viewBox="0 0 24 24" style={{ transform: [{ rotate: open[r.k] ? "180deg" : "0deg" }] }}>
                  <Path d="M5 9l7 7 7-7" stroke={t.ink} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </Svg>
              </Pressable>
              {open[r.k] ? (
                <View style={{ gap: 8, paddingHorizontal: 8, paddingBottom: 8 }}>
                  {r.list.map((x) => (
                    <QAItem key={x[2]} n={x[2]} q={x[3]} a={x[4]} d={x[5]} now={now} />
                  ))}
                </View>
              ) : null}
            </View>
          )
        }
      />
    </Screen>
  );
}
