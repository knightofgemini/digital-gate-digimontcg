// Domande e risposte ufficiali di Bandai per ogni carta (27 novembre 2026, ramo `faq-carte`, richiesta dell'utente).
// Dati in `data/qa.json` (copiato da `src/qa.json` con scripts/sync-data.js; lo preparano tools/fetch_qa.py e
// tools/parse_qa.py dalla pagina delle regole di world.digimoncard.com). Testi in inglese come sul sito, mai tradotti.
// Il file si legge solo la prima volta che serve (require dentro la funzione), non all'avvio dell'app.
import { useState } from "react";
import { Pressable, View } from "react-native";
import { DISPLAY, Text } from "./Text";
import { Rich } from "./rich";
import { useTheme } from "./theme";

type QA = [number, string, string, string];
let DB: { t: string; c: Record<string, QA[]> } | null = null;
export function qaFor(code: string): QA[] {
  if (!DB) {
    try {
      DB = require("../data/qa.json");
    } catch {
      DB = { t: "", c: {} };
    }
  }
  return DB!.c[code] || [];
}
const MESI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
const dataIt = (d: string) => (d ? +d.slice(8) + " " + MESI[+d.slice(5, 7) - 1] + " " + d.slice(0, 4) : "");
// "<Security A.>" del sito → "＜Security A.＞" come nel testo delle carte, così diventa la stessa icona
const tags = (s: string) => s.replace(/<([A-Z][^<>\n]{0,40})>/g, "＜$1＞");
const SHOW = 3;

export function QASection({ code, H3 }: { code: string; H3: any }) {
  const t = useTheme();
  const list = qaFor(code);
  const [all, setAll] = useState(false);
  if (!list.length) return null;
  const now = Date.now();
  const shown = all ? list : list.slice(0, SHOW);
  return (
    <View style={{ marginTop: 4, marginBottom: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Text style={[H3, { marginBottom: 0 }]}>Domande e risposte</Text>
        <View style={{ backgroundColor: t.surface2, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 1 }}>
          <Text style={{ color: t.ink2, fontFamily: DISPLAY, fontWeight: "700", fontSize: 11.5 }}>{list.length}</Text>
        </View>
      </View>
      <Text style={{ color: t.ink2, fontSize: 12.5, marginBottom: 8 }}>Risposte ufficiali di Bandai ai dubbi su questa carta</Text>
      <View style={{ gap: 8 }}>
        {shown.map(([n, q, a, d]) => {
          const nuova = d && now - Date.parse(d) < 30 * 86400000;
          return (
            <View key={n} style={{ backgroundColor: t.surface, borderColor: t.line, borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 }}>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Badge l="Q" bg={t.accent} ink={t.accentInk} />
                <View style={{ flex: 1 }}>
                  <Rich text={tags(q)} style={{ color: t.ink, fontSize: 14.5, lineHeight: 21, fontWeight: "600" }} />
                </View>
              </View>
              <View style={{ height: 1, backgroundColor: t.line, marginVertical: 8, marginLeft: 34 }} />
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Badge l="A" bg={t.ok} ink="#fff" />
                <View style={{ flex: 1 }}>
                  <Rich text={tags(a)} style={{ color: t.ink, fontSize: 14.5, lineHeight: 21 }} />
                </View>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, marginLeft: 34 }}>
                {nuova ? (
                  <View style={{ backgroundColor: t.accentSoft, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1 }}>
                    <Text style={{ color: t.accent, fontFamily: DISPLAY, fontWeight: "700", fontSize: 10.5, letterSpacing: 0.5 }}>NUOVA</Text>
                  </View>
                ) : null}
                <Text style={{ color: t.ink2, fontSize: 11.5 }}>
                  Q{n}
                  {d ? " · aggiornata il " + dataIt(d) : ""}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
      {list.length > SHOW ? (
        <Pressable onPress={() => setAll(!all)} style={({ pressed }) => ({ marginTop: 8, alignSelf: "flex-start", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: t.surface2, opacity: pressed ? 0.7 : 1 })}>
          <Text style={{ color: t.ink, fontWeight: "600", fontSize: 13.5 }}>{all ? "Mostra meno" : "Mostra tutte (" + list.length + ")"}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
function Badge({ l, bg, ink }: { l: string; bg: string; ink: string }) {
  return (
    <View style={{ width: 24, height: 24, borderRadius: 7, backgroundColor: bg, alignItems: "center", justifyContent: "center", marginTop: -1 }}>
      <Text style={{ color: ink, fontFamily: DISPLAY, fontWeight: "700", fontSize: 13.5 }}>{l}</Text>
    </View>
  );
}
