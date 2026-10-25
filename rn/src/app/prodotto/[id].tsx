// Pagina di un prodotto (come renderCards con setId dell'app attuale sul telefono): "← Tutti i set", banner o logo,
// tipo · codice e nome, "La tua collezione" (solo arrivando dalla Collezione), dettagli del prodotto e rarità
// richiudibili (chiusi arrivando dalla Collezione), poi le carte per sezioni (Regular, Alternative Art, Ristampe…).
// Ricerca, fotocamera e Filtri nella barra in basso; mentre si cerca l'intestazione si nasconde.
// "up-CODICE" = prodotto in arrivo senza carte: solo la scheda.
import { ReactNode, useMemo, useState } from "react";
import { Linking, Pressable, SectionList, View, useWindowDimensions } from "react-native";
import { DISPLAY, Text } from "../../Text";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import Svg, { Path } from "react-native-svg";
import { BANNERS, Card, PRODUCTS, SETBY, TYPES, UPCOMING, cardsOfSet, itDate, monthLabel, normQ, packUrl, relevance, setGroups, soonSet, typeOf, upWhen } from "../../data";
import { ActiveChips, FilterSheet, fltCount } from "../../FilterSheet";
import { EMPTY, Filters, cardMatches, qmHolder } from "../../filters";
import { CountRow, GridTile, ListRow } from "../../items";
import { usePrices } from "../../prices";
import { S, setStats, useStore } from "../../store";
import { useTheme } from "../../theme";
import { Screen } from "../../chrome";
import { ProdVisual, Progress } from "../../visual";
import { BOTTOM_PAD, BottomBar } from "../../BottomBar";

const REGIONS: Record<string, string> = { Europe: "Europa", "North America": "Nord America", "Latin America": "America Latina", Oceania: "Oceania", "United States": "Stati Uniti", "Other regions": "Altre regioni" };
const UNITS: Record<string, string> = { pack: "a busta", deck: "a mazzo", box: "a box" };
const spoilerN = (id: string) => cardsOfSet(id).filter((c) => !c.suf).length;

function BackLink({ label }: { label: string }) {
  const t = useTheme();
  return (
    <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/prodotti"))} hitSlop={8} style={{ alignSelf: "flex-start", paddingTop: 10, paddingBottom: 4 }}>
      <Text style={{ color: t.blue, fontWeight: "600", fontSize: 14.4 }}>{label}</Text>
    </Pressable>
  );
}

export default function Prodotto() {
  const { id, from, q: q0, qm } = useLocalSearchParams<{ id: string; from?: string; q?: string; qm?: string }>();
  const t = useTheme();
  const { width } = useWindowDimensions();
  useStore();
  usePrices();
  const grid = S.view === "grid";
  const cols = grid ? 2 : 1;
  const tw = Math.floor((width - 28 - 6) / 2);
  const up = id.startsWith("up-") ? UPCOMING.find((u) => u.code === id.slice(3)) : undefined;
  const set = SETBY[id];
  const code = set ? set.code : up ? up.code : "";
  const type = set ? set.type : typeOf(code);
  const fromColl = from === "coll";

  const [q, setQ] = useState(q0 || "");
  const [f, setF] = useState<Filters>({ ...EMPTY, qm: qm || "" });
  const [fOpen, setFOpen] = useState(false);
  const all = set ? cardsOfSet(set.id) : [];
  const nf = fltCount(f, true);

  // con una ricerca le carte vanno per rilevanza; senza, divise nelle sezioni del prodotto
  const { sections, flat, n } = useMemo(() => {
    if (!set) return { sections: [], flat: [] as Card[], n: 0 };
    const nq = normQ(q);
    const l = all.filter((c) => cardMatches(c, nq, f));
    const groups: [string, Card[]][] = nq
      ? [["", l.map((c, j) => ({ c, j, r: f.qm === "text" ? 0 : relevance(c, nq) })).sort((a, b) => a.r - b.r || a.j - b.j).map((o) => o.c)]]
      : setGroups(set.id, l);
    const flat: Card[] = [];
    const sections = groups
      .filter(([, g]) => g.length)
      .map(([title, g]) => {
        flat.push(...g);
        const rows: Card[][] = [];
        for (let i = 0; i < g.length; i += cols) rows.push(g.slice(i, i + cols));
        return { title: title ? title + " (" + g.length + ")" : "", data: rows };
      });
    return { sections, flat, n: l.length };
  }, [set, cols, q, f]);

  if (!set && !up)
    return (
      <Screen>
        <View style={{ paddingHorizontal: 14 }}>
          <BackLink label="← Indietro" />
          <Text style={{ color: t.ink2, textAlign: "center", paddingVertical: 48 }}>Prodotto non trovato.</Text>
        </View>
      </Screen>
    );

  // ---- prodotto in arrivo senza carte: solo la scheda
  if (up && !set)
    return (
      <Screen>
        <SectionList
          sections={[]}
          renderItem={() => null}
          contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 28 }}
          ListHeaderComponent={
            <View>
              <BackLink label={from === "home" ? "← Home" : "← Indietro"} />
              <View style={{ marginTop: 4, marginBottom: 6 }}>
                <Text style={{ color: t.ink, fontFamily: DISPLAY, fontWeight: "700", fontSize: 18.4 }} numberOfLines={1} adjustsFontSizeToFit>
                  {up.code} · {up.name}
                </Text>
                <Text style={{ color: t.ink2, fontSize: 13.6 }}>In arrivo · {upWhen(up)}</Text>
              </View>
              <ProdBox code={up.code} type={type} kind={up.kind || ""} fallback={null} />
              {up.note ? <Text style={{ color: t.ink2, fontSize: 12.8, marginTop: 12 }}>{up.note}</Text> : null}
              <Text style={{ color: t.ink2, textAlign: "center", paddingVertical: 48 }}>Le carte saranno aggiunte al catalogo dopo l'uscita.</Text>
            </View>
          }
        />
      </Screen>
    );

  const s = set!;
  const hasDate = !!s.date && s.date.charAt(0) !== "0";
  const p = PRODUCTS[s.code];
  const stt = setStats()[s.id];
  const head = q ? null : (
    <View>
      <BackLink label={from === "home" ? "← Home" : fromColl ? "← La mia collezione" : "← Tutti i set"} />
      {BANNERS[s.code] || (p && (p.lg || p.pk)) ? (
        <View style={{ borderRadius: 14, overflow: "hidden", marginTop: 6 }}>
          <ProdVisual code={s.code} />
        </View>
      ) : null}
      <View style={{ marginTop: 4, marginBottom: 10, gap: 10 }}>
        <View>
          <Text style={{ color: t.cyan, fontFamily: DISPLAY, fontWeight: "600", fontSize: 11.2, letterSpacing: 2, textTransform: "uppercase" }}>{(s.type === "AL" ? "" : TYPES[s.type] + " · ") + s.code}</Text>
          <Text style={{ color: t.ink, fontFamily: DISPLAY, fontWeight: "700", fontSize: 24, lineHeight: 28, marginTop: 2 }}>{s.name}</Text>
          {hasDate && !p ? <Text style={{ color: t.ink2, fontSize: 13.6 }}>Uscita: {monthLabel(s.date)}</Text> : null}
        </View>
        {fromColl && stt && stt.n ? (
          <View style={{ backgroundColor: t.surface, borderWidth: 1, borderColor: t.line, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 }}>
            <Text style={{ color: t.cyan, fontFamily: DISPLAY, fontWeight: "600", fontSize: 11.2, letterSpacing: 2, textTransform: "uppercase" }}>La tua collezione</Text>
            <Text style={{ color: t.ink, fontFamily: DISPLAY, fontWeight: "700", fontSize: 25.6, fontVariant: ["tabular-nums"] }}>
              {stt.h} <Text style={{ color: t.ink2, fontFamily: DISPLAY, fontWeight: "600", fontSize: 14.4 }}>/ {stt.n}</Text>
            </Text>
            <Progress h={stt.h} n={stt.n} height={6} style={{ marginTop: 6, marginBottom: 4 }} />
            <Text style={{ color: t.ink2, fontSize: 12.5 }}>Carte e illustrazioni possedute in questo prodotto</Text>
          </View>
        ) : null}
      </View>
      {soonSet(s) ? (
        <View style={{ gap: 4, marginTop: 4, marginBottom: 12, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: t.dark ? "#6b3a2c" : "#efb79d", backgroundColor: t.dark ? "#1f1d27" : "#fdf1ec" }}>
          <Text style={{ color: t.accent, fontWeight: "700", fontSize: 14.4 }}>In arrivo · {(() => {
            const su = UPCOMING.find((x) => x.code === s.code);
            return su ? upWhen(su) : monthLabel(s.date);
          })()}</Text>
          <Text style={{ color: t.ink2, fontSize: 13.6, lineHeight: 20 }}>
            {(() => {
              const nS = spoilerN(s.id),
                nAlt = cardsOfSet(s.id).length - nS;
              return "Spoiler: " + nS + " carte" + (nAlt ? " e " + nAlt + " alternative art" : "") + " svelate finora, con le immagini di anteprima ufficiali (con la scritta SAMPLE). Le altre arriveranno man mano che vengono annunciate.";
            })()}
          </Text>
        </View>
      ) : null}
      {p ? (
        <Details title="Dettagli del prodotto e rarità" open={!fromColl}>
          <ProdBox code={s.code} type={s.type} kind={s.type === "AL" ? "" : TYPES[s.type]} fallback={hasDate ? s.date.slice(0, 7) : null} inDetails />
        </Details>
      ) : null}
    </View>
  );

  return (
    <Screen>
      <SectionList
        sections={sections}
        keyExtractor={(row) => row[0].k}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={
          <View>
            {head}
            {!all.length ? (
              <Text style={{ color: t.ink2, textAlign: "center", paddingVertical: 48 }}>Questo prodotto non contiene carte: solo accessori (playmat, bustine, box).</Text>
            ) : !n ? (
              <Text style={{ color: t.ink2, textAlign: "center", paddingVertical: 48 }}>Nessuna carta corrisponde ai filtri.</Text>
            ) : (
              <CountRow n={n} />
            )}
          </View>
        }
        contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 4, paddingBottom: BOTTOM_PAD + (nf ? 42 : 0) }}
        initialNumToRender={6}
        renderSectionHeader={({ section }) =>
          section.title ? <Text style={{ color: t.accent, fontFamily: DISPLAY, fontWeight: "500", fontSize: 11.8, letterSpacing: 1.2, textTransform: "uppercase", marginTop: 18, marginBottom: 8 }}>{section.title}</Text> : null
        }
        renderItem={({ item }) =>
          grid ? (
            <View style={{ flexDirection: "row", gap: 6, marginBottom: 6 }}>
              {item.map((c) => (
                <GridTile key={c.k} c={c} list={flat} width={tw} />
              ))}
            </View>
          ) : (
            <View style={{ marginBottom: 6 }}>
              <ListRow c={item[0]} list={flat} />
            </View>
          )
        }
      />
      {all.length ? <BottomBar q={q} setQ={setQ} placeholder={f.qm ? qmHolder(f.qm) : "Cerca in " + s.code + ", es. Agumon"} cam filter={{ n: nf, onPress: () => setFOpen(true) }} chips={nf ? <ActiveChips f={f} setF={setF} lockExp /> : undefined} /> : null}
      <FilterSheet visible={fOpen} f={f} setF={setF} onClose={() => setFOpen(false)} count={n} lockExp />
    </Screen>
  );
}

// riquadro richiudibile (.pdet)
function Details({ title, open: o0, children }: { title: string; open: boolean; children: ReactNode }) {
  const t = useTheme();
  const [open, setOpen] = useState(o0);
  return (
    <View style={{ marginBottom: 6, borderWidth: 1, borderColor: t.line, borderRadius: 12, backgroundColor: t.surface }}>
      <Pressable onPress={() => setOpen(!open)} accessibilityState={{ expanded: open }} style={{ minHeight: 46, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ color: t.ink, fontWeight: "600" }}>{title}</Text>
        <Svg width={18} height={18} viewBox="0 0 24 24" style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}>
          <Path d="M5 9l7 7 7-7" stroke={t.ink} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </Svg>
      </Pressable>
      {open ? children : null}
    </View>
  );
}

// scheda del prodotto (.prod): confezione a sinistra, dati ufficiali a destra, contenuto e rarità sotto
function ProdBox({ code, type, kind, fallback, inDetails }: { code: string; type: string; kind: string; fallback: string | null; inDetails?: boolean }) {
  const t = useTheme();
  const p = PRODUCTS[code];
  if (!p) return null;
  const rows: [string, ReactNode][] = [],
    wide: [string, ReactNode][] = [];
  if (kind) rows.push(["Tipo", kind]);
  const rel = p.rel && p.rel.length ? p.rel : fallback ? [["", fallback] as [string, string]] : [];
  if (rel.length === 1 && !rel[0][0]) rows.push(["Uscita", itDate(rel[0][1])]);
  else if (rel.length)
    rows.push([
      "Uscita",
      rel.map((x, i) => (
        <View key={i} style={{ marginTop: i ? 3 : 0 }}>
          <Text style={{ color: t.ink, fontSize: 13.8 }}>{itDate(x[1])}</Text>
          {x[0] ? <Text style={{ color: t.ink2, fontSize: 12.5 }}>{x[0].split("/").map((r) => REGIONS[r] || r).join(", ")}</Text> : null}
        </View>
      )),
    ]);
  if (p.pre) rows.push(["Pre-release", itDate(p.pre)]);
  if (p.price) {
    const booster = (p.cont || []).some((x) => /^1 Booster Pack contains/i.test(x));
    const pr = p.price;
    const u = pr[2] ? UNITS[pr[2]] : type === "ST" ? UNITS.deck : booster ? UNITS.pack : "";
    rows.push(["Prezzo", pr[1].replace(".", ",") + (pr[0] === "USD" ? " $" : " ¥") + (u ? " " + u : "")]);
  }
  if (p.types) {
    const tm = p.types.match(/^([\d+]+) types?(?: in total)? ?(\+ ?\d+)?(?: types?)?$/);
    rows.push(["Carte", tm ? tm[1] + (tm[2] ? " " + tm[2].replace(" ", "") : "") + " diverse" : p.types]);
  }
  if (p.cont)
    wide.push([
      "Contenuto",
      p.cont.map((x, i) => {
        let m = x.match(/^1 Booster Pack contains (\d+) cards/i),
          s = x;
        if (m) s = m[1] + " carte per busta";
        else if ((m = x.match(/^1 Box contains (\d+) Booster Packs/i))) s = m[1] + " buste per box";
        return (
          <Text key={i} style={{ color: t.ink, fontSize: 13.8, marginTop: i ? 3 : 0 }}>
            {s}
          </Text>
        );
      }),
    ]);
  if (p.rar)
    wide.push([
      "Rarità",
      <View key="r" style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {p.rar.map((x, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "baseline", gap: 6, paddingVertical: 3, paddingHorizontal: 10, borderRadius: 999, backgroundColor: t.surface2 }}>
            <Text style={{ color: t.ink, fontSize: 12.5, lineHeight: 17 }}>{x[0]}</Text>
            <Text style={{ color: t.ink, fontFamily: DISPLAY, fontWeight: "700", fontSize: 12.5 }}>{String(x[1])}</Text>
          </View>
        ))}
      </View>,
    ]);
  const pk = packUrl(code);
  const Row = ({ k, v, last, top }: { k: string; v: ReactNode; last?: boolean; top?: boolean }) => (
    <View style={{ flexDirection: "row", gap: 6, paddingVertical: 6, borderBottomWidth: last ? 0 : 1, borderTopWidth: top ? 1 : 0, borderColor: t.line, alignItems: "baseline" }}>
      <Text style={{ width: 74, color: t.ink2, fontFamily: DISPLAY, fontWeight: "500", fontSize: 10.2, letterSpacing: 0.4, textTransform: "uppercase" }}>{k}</Text>
      <View style={{ flex: 1, minWidth: 0 }}>{typeof v === "string" ? <Text style={{ color: t.ink, fontSize: 13.8 }}>{v}</Text> : v}</View>
    </View>
  );
  return (
    <View style={[{ backgroundColor: t.surface, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 }, inDetails ? { paddingTop: 0 } : { borderWidth: 1, borderColor: t.line, marginTop: 8, marginBottom: 4 }]}>
      <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
        {pk ? <Image source={pk} style={{ width: 80, height: 150, maxHeight: 170 }} contentFit="contain" cachePolicy="disk" accessibilityLabel={"Confezione di " + code} /> : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          {rows.map(([k, v], i) => (
            <Row key={k} k={k} v={v} last={i === rows.length - 1} />
          ))}
        </View>
      </View>
      {wide.length ? (
        <View style={{ marginTop: 4 }}>
          {wide.map(([k, v], i) => (
            <Row key={k} k={k} v={v} top={i === 0} />
          ))}
        </View>
      ) : null}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, paddingTop: 8 }}>
        <Text style={{ color: t.ink2, fontSize: 11.8, flexShrink: 1 }}>{p.price && p.price[0] === "USD" ? "Dati ufficiali Bandai · prezzo consigliato USA" : "Dati ufficiali Bandai"}</Text>
        <Pressable onPress={() => Linking.openURL(p.url)} hitSlop={6}>
          <Text style={{ color: t.blue, fontWeight: "600", fontSize: 13.1 }}>Pagina ufficiale ↗</Text>
        </Pressable>
      </View>
    </View>
  );
}
