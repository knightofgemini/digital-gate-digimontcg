// La mia collezione (come l'app attuale sul telefono): Tutte (riepilogo a quattro riquadri, avanzamento per prodotto,
// le tue carte), Preferite (con le liste personali) e Wishlist (preferite che mancano, con quanto costa completarle).
// Ricerca, fotocamera e Filtri nella barra in basso. Il backup sta in Informazioni, come nell'app attuale.
import { ReactNode, useCallback, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { DISPLAY, Text, TextInput } from "../../Text";
import { router, useFocusEffect } from "expo-router";
import { CARDS, Card, SETBY, SETS, cardsOfSet, hostSet, monthLabel, normQ, relevance } from "../../data";
import { ActiveChips, FilterSheet, fltCount } from "../../FilterSheet";
import { EMPTY, Filters, allVers, cardMatches } from "../../filters";
import { CardList, CountRow, Heart, ViewToggle } from "../../items";
import { bestVal, cmVal, ctVal, eurN, eurT, usePrices } from "../../prices";
import { S, favCards, favCount, listById, listDelete, listNew, owned, setStats, useStore } from "../../store";
import { useTheme } from "../../theme";
import { Logo, PageTitle } from "../../ui";
import { Screen, TABNAV, goTab } from "../../chrome";
import { Btn, ProgLine, SecHead } from "../../visual";
import { BOTTOM_PAD, BottomBar } from "../../BottomBar";
import { CmMark, CtMark } from "../../shops";

const FSORTS: [string, string][] = [
  ["recent", "Aggiunte di recente"],
  ["price", "Prezzo più alto"],
  ["cheap", "Prezzo più basso"],
  ["name", "Nome"],
  ["num", "Numero"],
];

// segmento Tutte / Preferite / Wishlist (.mseg.three)
function Seg({ view, setView, miss }: { view: string; setView: (v: "all" | "fav" | "wish") => void; miss: number }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", padding: 3, borderRadius: 12, backgroundColor: t.surface2, marginTop: 2, marginBottom: 12 }}>
      {(
        [
          ["all", "Tutte"],
          ["fav", "Preferite"],
          ["wish", "Wishlist" + (miss ? " · " + miss : "")],
        ] as ["all" | "fav" | "wish", string][]
      ).map(([v, label]) => {
        const on = view === v;
        return (
          <Pressable key={v} onPress={() => setView(v)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={{ flex: 1, minHeight: 42, borderRadius: 9, alignItems: "center", justifyContent: "center", paddingHorizontal: 4, backgroundColor: on ? t.surface : "transparent", boxShadow: on ? "0 1px 3px rgba(15,26,46,.15)" : undefined }}>
            <Text style={{ color: on ? t.ink : t.ink2, fontWeight: on ? "700" : "500", fontSize: 14.4, lineHeight: 20 }}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// riquadro "vuoto" (.panel.cempty)
function Empty({ eyebrow, title, text, heart, children }: { eyebrow: string; title: string; text: string; heart?: boolean; children: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ backgroundColor: t.surface, borderWidth: 1, borderColor: t.line, borderRadius: 14, paddingVertical: 34, paddingHorizontal: 18, alignItems: "center" }}>
      <Text style={{ color: t.cyan, fontFamily: DISPLAY, fontWeight: "600", fontSize: 11.2, letterSpacing: 2, textTransform: "uppercase" }}>{eyebrow}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8, marginBottom: 6 }}>
        {heart ? <Heart on size={20} color={t.accent} /> : null}
        <Text style={{ color: t.ink, fontFamily: DISPLAY, fontWeight: "700", fontSize: 20.8 }}>{title}</Text>
      </View>
      <Text style={{ color: t.ink2, textAlign: "center", marginBottom: 16 }}>{text}</Text>
      <View style={{ alignSelf: "stretch", gap: 8 }}>{children}</View>
    </View>
  );
}

export default function Collezione() {
  const t = useTheme();
  const sv = useStore();
  const pv = usePrices();
  const [view, setView0] = useState<"all" | "fav" | "wish">("all");
  const [q, setQ] = useState("");
  const [f, setF] = useState<Filters>(EMPTY);
  const [fOpen, setFOpen] = useState(false);
  const [flist, setFlist] = useState("");
  const [fsort, setFsort] = useState("");
  const [allSets, setAllSets] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  // arrivando da Prodotti testo e filtri si azzerano (come nell'app attuale)
  useFocusEffect(
    useCallback(() => {
      if (/^\/prodott/.test(TABNAV.from)) {
        setQ("");
        setF(EMPTY);
      }
      TABNAV.from = "";
    }, [])
  );
  const nf = fltCount(f);
  const setView = (v: "all" | "fav" | "wish") => {
    setView0(v);
    if (v !== "fav") setFlist("");
  };

  const fav = view !== "all";
  const wish = view === "wish";
  const L0 = flist ? listById(flist) : null;
  const sort = fsort || (wish ? "price" : "recent");

  const { list, scope } = useMemo(() => {
    const nq = normQ(q);
    let src: Card[];
    // filtro Espansione (come nell'app attuale: per le preferite il prodotto della versione o della carta)
    if (fav) {
      src = favCards().filter((c) => (L0 ? !!L0.k[c.k] : true) && (!f.exp || hostSet(c) === f.exp || c.set === f.exp));
      if (wish) src = src.filter((c) => !owned(c));
    } else src = (f.exp && SETBY[f.exp] ? cardsOfSet(f.exp) : allVers()).filter((c) => owned(c) > 0);
    let l = src.filter((c) => cardMatches(c, nq, f));
    if (nq && f.qm !== "text")
      l = l
        .map((c, j) => ({ c, j, r: relevance(c, nq) }))
        .sort((a, b) => a.r - b.r || a.j - b.j)
        .map((o) => o.c);
    else if (fav) {
      const by: Record<string, (a: Card, b: Card) => number> = {
        recent: (a, b) => (S.fav.f[b.k] || 0) - (S.fav.f[a.k] || 0),
        price: (a, b) => (bestVal(b) || -1) - (bestVal(a) || -1),
        cheap: (a, b) => (bestVal(a) == null ? 1e9 : bestVal(a)!) - (bestVal(b) == null ? 1e9 : bestVal(b)!),
        name: (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
        num: (a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0),
      };
      l = l.slice().sort((a, b) => by[sort](a, b) || (a.k < b.k ? -1 : 1));
    }
    return { list: l, scope: src };
  }, [q, f, view, flist, sort, sv, pv]);
  const favExtra = useCallback((c: Card) => <AlertBadge c={c} />, []);

  const miss = favCards().filter((c) => !owned(c)).length;
  const anyQty = Object.keys(S.qty).length > 0;
  const search = !!normQ(q) || nf > 0;
  let body: ReactNode = null,
    count: ReactNode = null,
    empty = "";
  if (view === "all") {
    if (!anyQty)
      body = (
        <Empty eyebrow="La tua collezione" title="La prima carta inizia da qui" text="Cerca una carta o apri un prodotto e tocca + per segnare le copie che hai. Restano salvate su questo dispositivo.">
          <Btn label="Cerca carte" pri height={48} onPress={() => goTab("cards")} />
          <Btn label="Esplora i prodotti" height={48} onPress={() => goTab("sets")} />
        </Empty>
      );
    else {
      if (!search)
        body = (
          <>
            <Summary allSets={allSets} setAllSets={setAllSets} />
            <SecHead title="Le tue carte" />
          </>
        );
      count = list.length ? <CountRow n={list.length} top={search ? 4 : 0} /> : null;
      empty = "Nessuna carta corrisponde ai filtri.";
    }
  } else if (!favCount())
    body = (
      <Empty eyebrow="Preferite" heart title="Ancora nessuna preferita" text="Tocca il cuore su una carta (nella ricerca, in un prodotto o nella sua scheda) per ritrovarla qui. Quelle che non hai ancora finiscono nella Wishlist, con quanto costa completarle.">
        <Btn label="Cerca carte" pri height={48} onPress={() => goTab("cards")} />
        <Btn label="Esplora i prodotti" height={48} onPress={() => goTab("sets")} />
      </Empty>
    );
  else {
    body = (
      <>
        {!wish ? <Lists flist={flist} setFlist={setFlist} /> : null}
        {wish ? <WishStats list={scope} /> : null}
        {L0 ? <ListDel L0={L0} onDone={() => setFlist("")} /> : null}
      </>
    );
    count = (
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 4, marginBottom: 8 }}>
        <Pressable onPress={() => setSortOpen(true)} accessibilityLabel="Ordina" style={{ flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1 }}>
          <Text style={{ color: t.ink2, fontFamily: DISPLAY, fontWeight: "500", fontSize: 12.5, letterSpacing: 1.5, textTransform: "uppercase" }}>{list.length + (list.length === 1 ? " carta" : " carte") + " · "}</Text>
          <Text style={{ color: t.ink, fontWeight: "600", fontSize: 13.6 }} numberOfLines={1}>
            {FSORTS.find((x) => x[0] === sort)![1]} ▾
          </Text>
        </Pressable>
        <ViewToggle />
      </View>
    );
    empty = wish ? (scope.length ? "Nessuna carta della wishlist corrisponde ai filtri." : "Hai già tutte le tue preferite. Complimenti!") : L0 && !scope.length ? "Questa lista è vuota: apri una carta, tocca il cuore e scegli “Liste e avviso”." : "Nessuna preferita corrisponde ai filtri.";
  }
  const noList = (view === "all" && !anyQty) || (fav && !favCount());

  return (
    <Screen>
      <CardList
        list={noList ? [] : list}
        padBottom={BOTTOM_PAD + (nf ? 42 : 0)}
        extra={fav ? favExtra : undefined}
        header={
          <View style={{ paddingTop: 4 }}>
            <PageTitle>La mia collezione</PageTitle>
            <Seg view={view} setView={setView} miss={miss} />
            {body}
            {count}
          </View>
        }
        empty={noList ? "" : empty}
      />
      <BottomBar q={q} setQ={setQ} placeholder={view === "fav" ? "Cerca nelle preferite…" : wish ? "Cerca nella wishlist…" : "Cerca nella collezione…"} cam filter={{ n: nf, onPress: () => setFOpen(true) }} chips={nf ? <ActiveChips f={f} setF={setF} /> : undefined} />
      <FilterSheet visible={fOpen} f={f} setF={setF} onClose={() => setFOpen(false)} count={list.length} />
      <Modal visible={sortOpen} transparent animationType="fade" onRequestClose={() => setSortOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: t.scrim, justifyContent: "center", padding: 24 }} onPress={() => setSortOpen(false)}>
          <View style={{ backgroundColor: t.surface, borderRadius: 14, borderWidth: 1, borderColor: t.line, padding: 6 }}>
            {FSORTS.map(([k, label]) => (
              <Pressable
                key={k}
                onPress={() => {
                  setFsort(k);
                  setSortOpen(false);
                }}
                style={{ minHeight: 44, paddingHorizontal: 12, borderRadius: 10, flexDirection: "row", alignItems: "center", backgroundColor: sort === k ? t.cyanSoft : "transparent" }}
              >
                <Text style={{ color: sort === k ? t.cyan : t.ink, fontWeight: sort === k ? "700" : "500", fontSize: 15.2 }}>{label}</Text>
                {sort === k ? <Text style={{ marginLeft: "auto", color: t.cyan, fontWeight: "700" }}>✓</Text> : null}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </Screen>
  );
}

// ---- Tutte: riepilogo (.cstats) e avanzamento per prodotto (.csets)
function Summary({ allSets, setAllSets }: { allSets: boolean; setAllSets: (v: boolean) => void }) {
  const t = useTheme();
  let uniq = 0,
    tot = 0,
    dup = 0;
  CARDS.forEach((c) => owned(c) && uniq++);
  Object.keys(S.qty).forEach((k) => {
    tot += S.qty[k];
    if (S.qty[k] > 1) dup++;
  });
  const stats = setStats();
  const started = SETS.filter((x) => stats[x.id] && stats[x.id].n && stats[x.id].h).sort((a, b) => {
    const A = stats[a.id],
      B = stats[b.id];
    return B.h / B.n - A.h / A.n || (a.date < b.date ? 1 : -1);
  });
  const done = started.filter((x) => stats[x.id].h === stats[x.id].n).length;
  const tiles: [string, number, string, string][] = [
    ["Carte diverse", uniq, "/ " + CARDS.length, "Una voce per ogni carta"],
    ["Copie totali", tot, "", "Tutte le quantità, illustrazioni comprese"],
    ["Con doppioni", dup, "", "Carte o illustrazioni con più di una copia"],
    ["Prodotti completi", done, "/ " + started.length, "Sui prodotti che hai iniziato"],
  ];
  const lim = 4;
  return (
    <View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
        {tiles.map(([l, v, sub, note]) => (
          <View key={l} style={{ width: "48.6%", flexGrow: 1, backgroundColor: t.surface, borderWidth: 1, borderColor: t.line, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16 }}>
            <Text style={{ color: t.ink2, fontFamily: DISPLAY, fontWeight: "600", fontSize: 10.9, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>{l}</Text>
            <Text style={{ color: t.ink, fontFamily: DISPLAY, fontWeight: "700", fontSize: 23.2, lineHeight: 26, fontVariant: ["tabular-nums"] }}>
              {v}
              {sub ? <Text style={{ color: t.ink2, fontFamily: DISPLAY, fontWeight: "700", fontSize: 15.2 }}>{" " + sub}</Text> : null}
            </Text>
            <Text style={{ color: t.ink2, fontSize: 12.8, marginTop: 4, lineHeight: 18 }}>{note}</Text>
          </View>
        ))}
      </View>
      {started.length ? (
        <>
          <SecHead top={22} title="Per prodotto" link={started.length > lim ? (allSets ? "Mostra meno" : "Mostra tutti (" + started.length + ")") : undefined} onLink={() => setAllSets(!allSets)} />
          <View style={{ gap: 8 }}>
            {(allSets ? started : started.slice(0, lim)).map((x) => {
              const st = stats[x.id];
              const pc = Math.floor((st.h / st.n) * 100);
              const full = st.h === st.n;
              return (
                <Pressable key={x.id} onPress={() => router.push({ pathname: "/prodotto/[id]", params: { id: x.id, from: "coll" } })} style={{ paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: t.line, borderRadius: 12, backgroundColor: t.surface }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                    <View style={{ width: 84, height: 32, justifyContent: "center" }}>
                      <Logo code={x.code} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ color: t.ink, fontWeight: "600" }} numberOfLines={1}>
                        {x.name}
                      </Text>
                      <Text style={{ color: t.ink2, fontSize: 12.8, lineHeight: 18 }}>{x.code + (x.date && x.date.charAt(0) !== "0" ? " · " + monthLabel(x.date) : "")}</Text>
                    </View>
                    <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: full ? "rgba(74,222,128,.14)" : t.cyanSoft }}>
                      <Text style={{ color: full ? t.ok : t.cyan, fontFamily: DISPLAY, fontWeight: "700", fontSize: 13.1 }}>{pc}%</Text>
                    </View>
                  </View>
                  <ProgLine h={st.h} n={st.n} style={{ marginTop: 8 }} />
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}
    </View>
  );
}

// ---- Preferite: liste personali (.flchips)
function Lists({ flist, setFlist }: { flist: string; setFlist: (s: string) => void }) {
  const t = useTheme();
  const [nw, setNw] = useState<string | null>(null);
  const chip = (id: string, label: string) => {
    const on = flist === id;
    return (
      <Pressable key={id || "all"} onPress={() => setFlist(id)} style={{ minHeight: 36, paddingHorizontal: 14, justifyContent: "center", borderRadius: 999, borderWidth: 1, borderColor: on ? t.accent : t.line, backgroundColor: on ? t.accentSoft : t.surface }}>
        <Text style={{ color: on ? t.accent : t.ink, fontWeight: on ? "600" : "500", fontSize: 13.6, lineHeight: 18 }}>{label}</Text>
      </Pressable>
    );
  };
  const create = () => {
    const n = (nw || "").trim();
    if (n) setFlist(listNew(n).id);
    setNw(null);
  };
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ marginHorizontal: -14, marginBottom: 12 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 14, paddingVertical: 2 }}>
      {chip("", "Tutte · " + favCount())}
      {S.fav.l.map((L) => chip(L.id, L.n + " · " + Object.keys(L.k).filter((k) => S.fav.f[k]).length))}
      {nw != null ? (
        <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
          <TextInput autoFocus value={nw} onChangeText={setNw} placeholder="Nome della lista" placeholderTextColor={t.ink2} maxLength={40} onSubmitEditing={create} style={{ width: 160, minHeight: 36, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: t.accent, backgroundColor: t.surface, color: t.ink, fontWeight: "500", fontSize: 14.4 }} />
          <Pressable onPress={create} style={{ minHeight: 36, paddingHorizontal: 14, justifyContent: "center", borderRadius: 999, backgroundColor: t.accent }}>
            <Text style={{ color: t.accentInk, fontWeight: "600", fontSize: 13.6 }}>Crea</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={() => setNw("")} style={{ minHeight: 36, paddingHorizontal: 14, justifyContent: "center", borderRadius: 999, borderWidth: 1, borderStyle: "dashed", borderColor: t.line }}>
          <Text style={{ color: t.ink2, fontWeight: "500", fontSize: 13.6, lineHeight: 18 }}>+ Nuova lista</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

// "Elimina la lista" con doppio tocco (.flact)
function ListDel({ L0, onDone }: { L0: { id: string; n: string }; onDone: () => void }) {
  const t = useTheme();
  const [del, setDel] = useState(false);
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10, marginTop: -4, marginBottom: 8 }}>
      <Pressable
        onPress={() => {
          if (!del) return setDel(true);
          listDelete(L0.id);
          onDone();
        }}
        style={{ paddingVertical: 6 }}
      >
        <Text style={{ color: del ? t.accent : t.ink2, fontWeight: del ? "600" : "500", fontSize: 12.8, textDecorationLine: "underline" }}>{del ? "Tocca ancora per eliminare “" + L0.n + "”" : "Elimina la lista “" + L0.n + "”"}</Text>
      </Pressable>
      <Text style={{ color: t.ink2, fontSize: 12.5 }}>Le carte restano nelle preferite</Text>
    </View>
  );
}

// ---- Wishlist: quanto costa completare le preferite che mancano (.fstats.wish)
function WishStats({ list }: { list: Card[] }) {
  const t = useTheme();
  let tc = 0,
    tt = 0,
    tb = 0,
    nop = 0,
    ncm = 0,
    nct = 0;
  list.forEach((c) => {
    const a = cmVal(c),
      b = ctVal(c),
      m = bestVal(c);
    if (a != null) tc += a;
    else ncm++;
    if (b != null) tt += b;
    else nct++;
    if (m != null) tb += m;
    else nop++;
  });
  const nN = (n: number) => (n ? (n === 1 ? "1 carta senza prezzo" : n + " carte senza prezzo") : "");
  return (
    <View style={{ gap: 10, padding: 14, marginBottom: 12, backgroundColor: t.surface, borderWidth: 1, borderColor: t.line, borderRadius: 14 }}>
      <Text style={{ color: t.ink2, fontSize: 13.6 }}>Per completare le preferite{list.length ? " (" + list.length + (list.length === 1 ? " carta)" : " carte)") : ""}</Text>
      <View style={{ flexDirection: "row", gap: 10 }}>
        {(
          [
            ["cm", "Cardmarket", tc, ncm],
            ["ct", "CardTrader", tt, nct],
          ] as [string, string, number, number][]
        ).map(([k, n, v, no]) => (
          <View key={n} style={{ flex: 1, gap: 2, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: t.line, backgroundColor: t.bg }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              {k === "cm" ? <CmMark size={14} /> : <CtMark size={14} />}
              <Text style={{ color: t.ink, fontSize: 12.8 }}>{n}</Text>
            </View>
            <Text style={{ color: t.ink, fontFamily: DISPLAY, fontWeight: "700", fontSize: 20, fontVariant: ["tabular-nums"] }}>{eurT(v)}</Text>
            {no ? <Text style={{ color: t.ink2, fontSize: 11.5 }}>{nN(no)}</Text> : null}
          </View>
        ))}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
        <Text style={{ color: t.ink2, fontSize: 13.6 }}>Al prezzo più basso tra i due</Text>
        <Text style={{ color: t.accent, fontFamily: DISPLAY, fontWeight: "700", fontSize: 16.8 }}>{eurT(tb)}</Text>
      </View>
      {nop ? <Text style={{ color: t.ink2, fontSize: 12 }}>{nN(nop)} in entrambi i negozi, non conteggiate</Text> : null}
    </View>
  );
}

// avviso di prezzo sotto le carte nelle Preferite/Wishlist (.falert): impostato o raggiunto ("Sotto X €")
function AlertBadge({ c }: { c: Card }) {
  const t = useTheme();
  const a = S.fav.a[c.k];
  if (a == null) return null;
  const v = bestVal(c);
  const hit = v != null && v <= a;
  return (
    <View style={{ flexDirection: "row", marginTop: 4 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: hit ? t.cyanSoft : t.surface2 }}>
        <Text style={{ color: hit ? t.cyan : t.ink2, fontWeight: "600", fontSize: 11.5 }}>{(hit ? "↓ Sotto " : "🔔 Avviso ") + eurN(a) + " €"}</Text>
      </View>
    </View>
  );
}
