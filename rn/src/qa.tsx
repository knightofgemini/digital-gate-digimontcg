// Domande e risposte ufficiali di Bandai per ogni carta (27 novembre 2026, ramo `faq-carte`, richiesta dell'utente).
// Dati in `data/qa.json` (copiato da `src/qa.json` con scripts/sync-data.js; lo preparano tools/fetch_qa.py e
// tools/parse_qa.py dalla pagina delle regole di world.digimoncard.com). Testi in inglese come sul sito, mai tradotti.
// Il file si legge solo la prima volta che serve (require dentro la funzione), non all'avvio dell'app.
import { useEffect, useState } from "react";
import { AppState, Platform, Pressable, View } from "react-native";
import { File, Paths } from "expo-file-system";
import { documentDirectory, writeAsStringAsync } from "expo-file-system/legacy";
import { DISPLAY, Text } from "./Text";
import { Rich } from "./rich";
import { FS, R, useTheme } from "./theme";
import Svg, { Path } from "react-native-svg";

// [numero, domanda, risposta, data] e, per le regole, [categoria, voce, numero, domanda, risposta, data]
export type QA = [number, string, string, string];
export type RuleQA = [string, string, number, string, string, string];
type DBT = { t: string; c: Record<string, QA[]>; r: RuleQA[] };
let DB: DBT | null = null;
const NATIVE = Platform.OS !== "web" && !!documentDirectory;
const FILE = "dg-qa.json";
const SITE = "https://knightofgemini.github.io/digital-gate-digimontcg/dati/";
// aggiornate ogni notte da qa.yml sul sito: quelle scaricate valgono se più recenti di quelle dentro l'APK
function db(): DBT {
  if (DB) return DB;
  let d: DBT = { t: "", c: {}, r: [] };
  try {
    d = require("../data/qa.json");
  } catch {}
  if (NATIVE)
    try {
      const f = new File(Paths.document, FILE);
      if (f.exists) {
        const x = JSON.parse(f.textSync());
        if (x && x.c && x.t >= d.t) d = x;
      }
    } catch {}
  return (DB = d);
}
// dalla più recente alla più vecchia (a parità di data, numero più alto prima), anche per le regole
export const byRecent = <T,>(l: T[], d: (x: T) => string, n: (x: T) => number) => l.slice().sort((x, y) => (d(y) || "").localeCompare(d(x) || "") || n(y) - n(x));
const SORTED = new Map<string, QA[]>();
export function qaFor(code: string): QA[] {
  const l = db().c[code];
  if (!l) return [];
  let o = SORTED.get(code);
  if (!o) SORTED.set(code, (o = byRecent(l, (x) => x[3], (x) => x[0])));
  return o;
}
export const rulesQA = (): RuleQA[] => db().r || [];
export const qaDate = () => db().t;
// chi mostra le domande si ridisegna quando arrivano quelle nuove
const SUBS = new Set<() => void>();
export function useQA() {
  const [, set] = useState(0);
  useEffect(() => {
    const f = () => set((n) => n + 1);
    SUBS.add(f);
    return () => void SUBS.delete(f);
  }, []);
}
let started = false;
async function checkQA() {
  try {
    const v = await fetch(SITE + "qa-ver.json", { cache: "no-store" } as any).then((r) => (r.ok ? r.json() : null));
    if (!v || !v.t) return;
    // confronto senza leggere tutto il file: data dell'ultima domanda e impronta salvata
    const hf = new File(Paths.document, "dg-qa-ver.json");
    const have = hf.exists ? JSON.parse(hf.textSync()) : null;
    if (have && have.h === v.h) return;
    if (!have && v.t <= db().t) return;
    const txt = await fetch(SITE + "qa.json", { cache: "no-store" } as any).then((r) => (r.ok ? r.text() : ""));
    const x = txt ? JSON.parse(txt) : null;
    if (!x || !x.c || !Object.keys(x.c).length) return;
    // prima le domande, l'impronta per ultima: se lo scaricamento si interrompe si riprova la volta dopo
    await writeAsStringAsync(documentDirectory + FILE, txt);
    await writeAsStringAsync(documentDirectory + "dg-qa-ver.json", JSON.stringify(v));
    DB = x;
    SORTED.clear();
    SUBS.forEach((g) => g());
  } catch {}
}
// all'apertura (dopo le carte, che hanno la precedenza) e tornando nell'app dopo almeno 3 ore
export function startQA() {
  if (!NATIVE || started) return;
  started = true;
  setTimeout(checkQA, 8000);
  let away = 0;
  AppState.addEventListener("change", (st) => {
    if (st !== "active") return void (away = away || Date.now());
    if (away && Date.now() - away > 3 * 3600e3) checkQA();
    away = 0;
  });
}
const MESI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
const dataIt = (d: string) => (d ? +d.slice(8) + " " + MESI[+d.slice(5, 7) - 1] + " " + d.slice(0, 4) : "");
// "<Security A.>" del sito → "＜Security A.＞" come nel testo delle carte, così diventa la stessa icona
// "[...]" nel sito è una parte di testo omessa, non un nome: resta testo semplice
// "{Breeding}", "{Hand}" del sito → "[Breeding]" come le zone nel testo delle carte
export const tags = (s: string) =>
  s
    .replace(/<([A-Z][^<>\n]{0,40})>/g, "＜$1＞")
    .replace(/\[(\.\.\.|…)\]/g, "(…)")
    .replace(/\{([A-Z][A-Za-z ]{1,20})\}/g, "[$1]");

// sezione della scheda carta: un riquadro chiuso con il titolo e il numero di domande, come le voci della pagina
// Regole; toccandolo si aprono tutte, dalla più recente (27 novembre 2026, richiesta dell'utente)
export function QASection({ code, H3 }: { code: string; H3: any }) {
  const t = useTheme();
  useQA();
  const list = qaFor(code);
  const [open, setOpen] = useState(false);
  if (!list.length) return null;
  const now = Date.now();
  const nuove = list.filter((x) => x[3] && now - Date.parse(x[3]) < 30 * 86400000).length;
  return (
    <View style={{ marginTop: 4, marginBottom: 14 }}>
      <Text style={H3}>Domande e risposte</Text>
      <View style={{ borderTopWidth: 1, borderBottomWidth: 1, borderColor: t.line }}>
        <Pressable onPress={() => setOpen(!open)} accessibilityState={{ expanded: open }} style={{ minHeight: 56, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.ink, fontWeight: "600", fontSize: 15 }}>Risposte ufficiali di Bandai</Text>
            <Text style={{ color: t.ink2, fontSize: 12.5, marginTop: 1 }}>{list.length === 1 ? "1 domanda" : list.length + " domande"} su questa carta</Text>
          </View>
          {nuove ? (
            <View style={{ backgroundColor: t.accentSoft, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1 }}>
              <Text style={{ color: t.accent, fontFamily: DISPLAY, fontWeight: "700", fontSize: 10.5, letterSpacing: 0.5 }}>{nuove > 1 ? nuove + " NUOVE" : "NUOVA"}</Text>
            </View>
          ) : null}
          <Text style={{ color: t.ink2, fontFamily: DISPLAY, fontWeight: "700", fontSize: 12 }}>{list.length}</Text>
          <Svg width={18} height={18} viewBox="0 0 24 24" style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}>
            <Path d="M5 9l7 7 7-7" stroke={t.ink} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </Svg>
        </Pressable>
        {open ? (
          <View style={{ gap: 8, paddingBottom: 12 }}>
            {list.map(([n, q, a, d]) => (
              <QAItem key={n} n={n} q={q} a={a} d={d} now={now} />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}
// una domanda con la sua risposta (scheda carta e pagina delle regole), sempre aperta
export function QAItem({ n, q, a, d, now }: { n: number; q: string; a: string; d: string; now: number }) {
  const t = useTheme();
  const nuova = d && now - Date.parse(d) < 30 * 86400000;
  return (
    <View style={{ backgroundColor: t.surface, borderRadius: R.btn, paddingVertical: 12, paddingHorizontal: 12 }}>
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
}
function Badge({ l, bg, ink }: { l: string; bg: string; ink: string }) {
  return (
    <View style={{ width: 24, height: 24, borderRadius: 7, backgroundColor: bg, alignItems: "center", justifyContent: "center", marginTop: -1 }}>
      <Text style={{ color: ink, fontFamily: DISPLAY, fontWeight: "700", fontSize: 13.5 }}>{l}</Text>
    </View>
  );
}
