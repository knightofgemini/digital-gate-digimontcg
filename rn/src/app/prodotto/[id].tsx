// Pagina di un prodotto: scheda con i dati ufficiali e carte raggruppate (Regular, Alternative Art, Ristampe...).
// "up-CODICE" = prodotto in arrivo senza carte: solo la scheda.
import { ReactNode, useMemo, useState } from "react";
import { Linking, Pressable, SectionList, View, useWindowDimensions } from "react-native";
import { Text, TextInput } from "../../Text";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { Card, PRODUCTS, SETBY, TYPES, UPCOMING, cardsOfSet, cdText, itDate, monthLabel, normQ, packUrl, relevance, setGroups, soonSet, typeOf } from "../../data";
import { ActiveChips, FilterSheet } from "../../FilterSheet";
import { EMPTY, Filters, cardMatches, fl } from "../../filters";
import { GridTile, ListRow, ViewToggle } from "../../items";
import { usePrices } from "../../prices";
import { S, setStats, useStore } from "../../store";
import { useTheme } from "../../theme";
import { Fit, Logo, common } from "../../ui";
import { Screen } from "../../chrome";

const REGIONS: Record<string, string> = { Europe: "Europa", "North America": "Nord America", "Latin America": "America Latina", Oceania: "Oceania", "United States": "Stati Uniti", "Other regions": "Altre regioni" };
const UNITS: Record<string, string> = { pack: "a busta", deck: "a mazzo", box: "a box" };

export default function Prodotto() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const s = common(t);
  const { width } = useWindowDimensions();
  useStore();
  usePrices();
  const grid = S.view === "grid";
  const cols = grid ? Math.max(2, Math.floor(width / 150)) : 1;
  const up = id.startsWith("up-") ? UPCOMING.find((u) => u.code === id.slice(3)) : undefined;
  const set = SETBY[id];
  const code = set ? set.code : up ? up.code : "";
  const name = set ? set.name : up ? up.name : "Prodotto non trovato";
  const type = typeOf(code);

  const [q, setQ] = useState("");
  const [f, setF] = useState<Filters>(EMPTY);
  const [fOpen, setFOpen] = useState(false);
  const all = set ? cardsOfSet(set.id) : [];
  const nf = (Object.keys(f) as (keyof Filters)[]).reduce((n, k) => n + (k === "qm" || !f[k] ? 0 : fl(f, k).length), 0);

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
        return { title: title ? title + " (" + g.length + ")" : g.length + (g.length === 1 ? " carta" : " carte"), data: rows };
      });
    return { sections, flat, n: l.length };
  }, [set, cols, q, f]);
  const stt = set ? setStats()[set.id] : null;

  const header = (
    <View style={{ paddingTop: 8 }}>
      <View style={{ alignItems: "center", marginVertical: 8 }}>
        <Logo code={code} big />
      </View>
      <Text style={{ color: t.accent, fontWeight: "700", fontSize: 13 }}>
        {(type === "AL" ? "" : TYPES[type] + " · ") + code}
      </Text>
      <Text style={{ color: t.ink, fontSize: 24, fontWeight: "800", marginBottom: 6 }}>{name}</Text>
      {up && <Text style={{ color: t.ink2, marginBottom: 6 }}>In arrivo · {cdText(up)}</Text>}
      {set && soonSet(set) && (
        <View style={[s.panel, { padding: 12, marginVertical: 8, borderColor: t.accent }]}>
          <Text style={{ color: t.accent, fontWeight: "700" }}>In arrivo · {monthLabel(set.date)}</Text>
          <Text style={{ color: t.ink, marginTop: 4, lineHeight: 20 }}>Spoiler: le carte svelate finora, con le immagini di anteprima ufficiali. Le altre arriveranno man mano che vengono annunciate.</Text>
        </View>
      )}
      {stt && stt.n > 0 && stt.h > 0 && (
        <View style={[s.panel, { padding: 12, marginTop: 6 }]}>
          <Text style={{ color: t.ink2, fontSize: 12, fontWeight: "700" }}>LA TUA COLLEZIONE</Text>
          <Text style={{ color: t.ink, fontSize: 22, fontWeight: "800", marginTop: 2 }}>
            {stt.h} <Text style={{ color: t.ink2, fontSize: 15 }}>/ {stt.n}</Text>
          </Text>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: t.surface2, marginTop: 6, overflow: "hidden" }}>
            <View style={{ width: Math.min(100, (stt.h / stt.n) * 100) + "%", height: 6, backgroundColor: stt.h === stt.n ? "#46bd73" : t.accent }} />
          </View>
          <Text style={{ color: t.ink2, fontSize: 12, marginTop: 4 }}>Carte e illustrazioni possedute in questo prodotto</Text>
        </View>
      )}
      <ProductFacts code={code} kind={up ? up.kind : type === "AL" ? "" : TYPES[type]} fallback={set && set.date.charAt(0) !== "0" ? set.date.slice(0, 7) : null} />
      {up && up.note ? <Text style={{ color: t.ink2, marginTop: 10 }}>{up.note}</Text> : null}
      {up && <Text style={{ color: t.ink2, marginTop: 16 }}>Le carte saranno aggiunte al catalogo dopo l'uscita.</Text>}
      {set && !all.length && <Text style={{ color: t.ink2, marginTop: 16 }}>Questo prodotto non contiene carte: solo accessori (playmat, bustine, box).</Text>}
      {all.length > 0 && (
        <View style={{ marginTop: 16 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput value={q} onChangeText={setQ} placeholder={"Cerca in " + code} placeholderTextColor={t.ink2} style={[s.search, { flex: 1 }]} autoCorrect={false} returnKeyType="search" />
            <Pressable onPress={() => setFOpen(true)} style={{ paddingHorizontal: 14, justifyContent: "center", borderRadius: 10, borderWidth: 1, borderColor: nf ? t.accent : t.line, backgroundColor: nf ? t.accent : t.surface }}>
              <Text style={{ color: nf ? t.accentInk : t.ink, fontWeight: "700" }}>Filtri{nf ? " · " + nf : ""}</Text>
            </Pressable>
          </View>
          <ActiveChips f={f} setF={setF} lockExp />
          <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 6 }}>
            <ViewToggle />
          </View>
          {!sections.length && <Text style={{ color: t.ink2, marginTop: 16 }}>Nessuna carta corrisponde ai filtri.</Text>}
        </View>
      )}
    </View>
  );

  return (
    <Screen>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderColor: t.line }}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/prodotti"))} hitSlop={12}>
          <Text style={{ color: t.accent, fontSize: 16, fontWeight: "600" }}>‹ Indietro</Text>
        </Pressable>
      </View>
      <SectionList
        sections={sections}
        keyExtractor={(row) => row[0].k}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={<View style={{ paddingHorizontal: 16 }}>{header}</View>}
        contentContainerStyle={{ paddingBottom: 30 }}
        initialNumToRender={8}
        renderSectionHeader={({ section }) => <Text style={{ color: t.ink, fontSize: 16, fontWeight: "800", marginTop: 20, marginBottom: 6, paddingHorizontal: 16 }}>{section.title}</Text>}
        renderItem={({ item }) =>
          grid ? (
            <View style={{ flexDirection: "row", paddingHorizontal: 6 }}>
              {item.map((c) => (
                <GridTile key={c.k} c={c} list={flat} width={(width - 12) / cols} />
              ))}
            </View>
          ) : (
            <ListRow c={item[0]} list={flat} />
          )
        }
      />
      <FilterSheet visible={fOpen} f={f} setF={setF} onClose={() => setFOpen(false)} count={n} lockExp />
    </Screen>
  );
}

// Scheda prodotto: caratteristiche dal sito ufficiale Bandai (src/products.json), etichette in italiano, contenuto e rarità in inglese
function ProductFacts({ code, kind, fallback }: { code: string; kind?: string; fallback: string | null }) {
  const t = useTheme();
  const s = common(t);
  const [open, setOpen] = useState(true);
  const p = PRODUCTS[code];
  if (!p) return null;
  const rows: [string, ReactNode][] = [];
  if (kind) rows.push(["Tipo", kind]);
  const rel = p.rel && p.rel.length ? p.rel : fallback ? [["", fallback] as [string, string]] : [];
  if (rel.length === 1 && !rel[0][0]) rows.push(["Uscita", itDate(rel[0][1])]);
  else if (rel.length) rows.push(["Uscita", rel.map((x) => itDate(x[1]) + (x[0] ? " (" + x[0].split("/").map((r) => REGIONS[r] || r).join(", ") + ")" : "")).join("\n")]);
  if (p.pre) rows.push(["Pre-release", itDate(p.pre)]);
  if (p.price) {
    const booster = (p.cont || []).some((x) => /^1 Booster Pack contains/i.test(x));
    const pr = p.price;
    const u = pr[2] ? UNITS[pr[2]] : typeOf(code) === "ST" ? UNITS.deck : booster ? UNITS.pack : "";
    rows.push(["Prezzo", pr[1].replace(".", ",") + (pr[0] === "USD" ? " $" : " ¥") + (u ? " " + u : "")]);
  }
  if (p.types) {
    const tm = p.types.match(/^([\d+]+) types?(?: in total)? ?(\+ ?\d+)?(?: types?)?$/);
    rows.push(["Carte", tm ? tm[1] + (tm[2] ? " " + tm[2].replace(" ", "") : "") + " diverse" : p.types]);
  }
  if (p.cont)
    rows.push([
      "Contenuto",
      p.cont
        .map((x) => {
          let m = x.match(/^1 Booster Pack contains (\d+) cards/i);
          if (m) return m[1] + " carte per busta";
          m = x.match(/^1 Box contains (\d+) Booster Packs/i);
          if (m) return m[1] + " buste per box";
          return x;
        })
        .join("\n"),
    ]);
  if (p.rar) rows.push(["Rarità", p.rar.map((x) => x[0] + " " + x[1]).join(" · ")]);
  const pk = packUrl(code);
  return (
    <View style={[s.panel, { marginTop: 10, overflow: "hidden" }]}>
      <Pressable onPress={() => setOpen(!open)} style={{ padding: 12, flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: t.ink, fontWeight: "700" }}>Dettagli del prodotto e rarità</Text>
        <Text style={{ color: t.ink2 }}>{open ? "▲" : "▼"}</Text>
      </Pressable>
      {open && (
        <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
          {pk && <Image source={pk} style={{ width: "100%", height: 160, marginBottom: 10 }} contentFit="contain" cachePolicy="disk" />}
          {rows.map(([k, v]) => (
            <View key={k} style={{ flexDirection: "row", paddingVertical: 6, borderTopWidth: 1, borderColor: t.line }}>
              <Text style={{ color: t.ink2, width: 96 }}>{k}</Text>
              <Text style={{ color: t.ink, flex: 1, lineHeight: 20 }}>{v}</Text>
            </View>
          ))}
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
            <Fit style={{ color: t.ink2, fontSize: 12, flex: 1 }}>{p.price && p.price[0] === "USD" ? "Dati ufficiali Bandai · prezzo consigliato USA" : "Dati ufficiali Bandai"}</Fit>
            <Pressable onPress={() => Linking.openURL(p.url)}>
              <Text style={{ color: t.accent, fontWeight: "700", fontSize: 13 }}>Pagina ufficiale ↗</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}
