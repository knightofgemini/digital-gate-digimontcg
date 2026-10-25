// La mia collezione (come nell'app attuale): Tutte (riepilogo, avanzamento per prodotto, le tue carte), Preferite (con le liste
// personali) e Wishlist (preferite che mancano, con quanto costa completarle). In fondo: backup per passare i dati tra app e telefoni.
import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Share, View } from "react-native";
import { Text, TextInput } from "../../Text";
import { router } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { SafeAreaView } from "react-native-safe-area-context";
import { CARDS, Card, SETS, monthLabel, normQ, relevance } from "../../data";
import { FilterSheet } from "../../FilterSheet";
import { EMPTY, Filters, allVers, cardMatches } from "../../filters";
import { CardList, Heart } from "../../items";
import { openSet } from "../../nav";
import { bestVal, cmVal, ctVal, eurT, usePrices } from "../../prices";
import { S, exportText, favCards, favCount, importText, listById, listDelete, listNew, owned, setStats, useStore } from "../../store";
import { SearchHead } from "../../SearchHead";
import { useTheme } from "../../theme";
import { Logo, common } from "../../ui";
import { Screen } from "../../chrome";

const FSORTS: [string, string][] = [
  ["recent", "Aggiunte di recente"],
  ["price", "Prezzo più alto"],
  ["cheap", "Prezzo più basso"],
  ["name", "Nome"],
  ["num", "Numero"],
];

export default function Collezione() {
  const t = useTheme();
  const s = common(t);
  const sv = useStore();
  usePrices();
  const [view, setViewC] = useState<"all" | "fav" | "wish">("all");
  const [q, setQ] = useState("");
  const [f, setF] = useState<Filters>(EMPTY);
  const [fOpen, setFOpen] = useState(false);
  const [flist, setFlist] = useState("");
  const [fsort, setFsort] = useState("");
  const [allSets, setAllSets] = useState(false);
  const [backup, setBackup] = useState(false);

  const fav = view !== "all";
  const wish = view === "wish";
  const L0 = flist ? listById(flist) : null;
  const sort = fsort || (wish ? "price" : "recent");

  const list = useMemo(() => {
    const nq = normQ(q);
    let src: Card[];
    if (fav) {
      src = favCards().filter((c) => (L0 ? !!L0.k[c.k] : true));
      if (wish) src = src.filter((c) => !owned(c));
    } else src = allVers().filter((c) => owned(c) > 0);
    let l = src.filter((c) => cardMatches(c, nq, f));
    if (nq && f.qm !== "text")
      return l
        .map((c, j) => ({ c, j, r: relevance(c, nq) }))
        .sort((a, b) => a.r - b.r || a.j - b.j)
        .map((o) => o.c);
    if (fav) {
      const by: Record<string, (a: Card, b: Card) => number> = {
        recent: (a, b) => (S.fav.f[b.k] || 0) - (S.fav.f[a.k] || 0),
        price: (a, b) => (bestVal(b) || -1) - (bestVal(a) || -1),
        cheap: (a, b) => (bestVal(a) == null ? 1e9 : bestVal(a)!) - (bestVal(b) == null ? 1e9 : bestVal(b)!),
        name: (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
        num: (a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0),
      };
      l = l.slice().sort((a, b) => by[sort](a, b) || (a.k < b.k ? -1 : 1));
    }
    return l;
  }, [q, f, view, flist, sort, sv]);

  const miss = favCards().filter((c) => !owned(c)).length;
  const header = (
    <View>
      <SearchHead title="La mia collezione" q={q} setQ={setQ} f={f} setF={setF} openF={() => setFOpen(true)} n={list.length}>
        {/* Tutte / Preferite / Wishlist */}
        <View style={{ flexDirection: "row", backgroundColor: t.surface2, borderRadius: 10, padding: 3, marginBottom: 10 }}>
          {(
            [
              ["all", "Tutte"],
              ["fav", "Preferite"],
              ["wish", "Wishlist" + (miss ? " · " + miss : "")],
            ] as ["all" | "fav" | "wish", string][]
          ).map(([v, label]) => (
            <Pressable
              key={v}
              onPress={() => {
                setViewC(v);
                if (v !== "fav") setFlist("");
              }}
              style={{ flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center", backgroundColor: view === v ? t.surface : "transparent" }}
            >
              <Text style={{ color: view === v ? t.ink : t.ink2, fontWeight: "700" }}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </SearchHead>
      <View style={{ paddingHorizontal: 16 }}>
        {view === "all" && <AllHead allSets={allSets} setAllSets={setAllSets} openBackup={() => setBackup(true)} />}
        {view === "fav" && <ListsHead flist={flist} setFlist={setFlist} />}
        {wish && <WishHead list={favCards().filter((c) => !owned(c) && (L0 ? !!L0.k[c.k] : true))} />}
        {fav && favCount() > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 10 }}>
            {FSORTS.map(([k, label]) => (
              <Pressable key={k} onPress={() => setFsort(k)} style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, backgroundColor: sort === k ? t.ink : t.surface2 }}>
                <Text style={{ color: sort === k ? t.bg : t.ink, fontSize: 12, fontWeight: "600" }}>{label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );

  let empty = "";
  if (view === "all") empty = Object.keys(S.qty).length ? "Nessuna delle tue carte corrisponde ai filtri." : "";
  else if (!favCount()) empty = "";
  else if (wish) empty = "Hai già tutte le tue preferite. Complimenti!";
  else empty = L0 ? "Questa lista è vuota: apri una carta, tocca le liste in alto e scegli dove salvarla." : "Nessuna preferita corrisponde ai filtri.";

  return (
    <Screen>
      <CardList list={list} header={header} empty={empty} />
      <FilterSheet visible={fOpen} f={f} setF={setF} onClose={() => setFOpen(false)} count={list.length} />
      <Backup visible={backup} onClose={() => setBackup(false)} />
    </Screen>
  );
}

// ---- Tutte: collezione vuota, oppure riepilogo, avanzamento per prodotto e backup
function AllHead({ allSets, setAllSets, openBackup }: { allSets: boolean; setAllSets: (v: boolean) => void; openBackup: () => void }) {
  const t = useTheme();
  const s = common(t);
  const any = Object.keys(S.qty).length > 0;
  if (!any)
    return (
      <View style={[s.panel, { padding: 18, marginTop: 12, alignItems: "center" }]}>
        <Text style={{ color: t.accent, fontWeight: "700", fontSize: 12 }}>LA TUA COLLEZIONE</Text>
        <Text style={{ color: t.ink, fontSize: 20, fontWeight: "800", marginTop: 4 }}>La prima carta inizia da qui</Text>
        <Text style={{ color: t.ink2, textAlign: "center", marginTop: 6, lineHeight: 20 }}>Cerca una carta o apri un prodotto e tocca + per segnare le copie che hai. Restano salvate su questo dispositivo.</Text>
        <Btn label="Cerca carte" pri onPress={() => router.navigate("/carte")} />
        <Btn label="Esplora i prodotti" onPress={() => router.navigate("/prodotti")} />
        <Btn label="Importa un backup" onPress={openBackup} />
      </View>
    );
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
  return (
    <View style={{ marginTop: 12 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 }}>
        {tiles.map(([l, v, sub, note]) => (
          <View key={l} style={{ width: "50%", padding: 4 }}>
            <View style={[s.panel, { padding: 12 }]}>
              <Text style={{ color: t.ink2, fontSize: 12 }}>{l}</Text>
              <Text style={{ color: t.ink, fontSize: 22, fontWeight: "800" }}>
                {v} <Text style={{ color: t.ink2, fontSize: 13 }}>{sub}</Text>
              </Text>
              <Text style={{ color: t.ink2, fontSize: 11 }}>{note}</Text>
            </View>
          </View>
        ))}
      </View>
      {started.length > 0 && (
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 16, marginBottom: 8 }}>
          <Text style={{ color: t.ink, fontSize: 16, fontWeight: "800" }}>Per prodotto</Text>
          {started.length > 4 && (
            <Pressable onPress={() => setAllSets(!allSets)}>
              <Text style={{ color: t.accent, fontWeight: "700" }}>{allSets ? "Mostra meno" : "Mostra tutti (" + started.length + ")"}</Text>
            </Pressable>
          )}
        </View>
      )}
      {(allSets ? started : started.slice(0, 4)).map((x) => {
        const st = stats[x.id];
        const pc = Math.floor((st.h / st.n) * 100);
        return (
          <Pressable key={x.id} onPress={() => openSet(x.id)} style={[s.panel, { padding: 10, marginBottom: 6 }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Logo code={x.code} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.ink, fontWeight: "700" }} numberOfLines={1}>
                  {x.name}
                </Text>
                <Text style={{ color: t.ink2, fontSize: 12 }}>{x.code + (x.date && x.date.charAt(0) !== "0" ? " · " + monthLabel(x.date) : "")}</Text>
              </View>
              <Text style={{ color: st.h === st.n ? "#46bd73" : t.ink, fontWeight: "800" }}>{pc}%</Text>
            </View>
            <View style={{ height: 4, borderRadius: 2, backgroundColor: t.surface2, marginTop: 8, overflow: "hidden" }}>
              <View style={{ width: pc + "%", height: 4, backgroundColor: st.h === st.n ? "#46bd73" : t.accent }} />
            </View>
          </Pressable>
        );
      })}
      <Pressable onPress={openBackup} style={{ marginTop: 10, alignSelf: "flex-start" }}>
        <Text style={{ color: t.accent, fontWeight: "700" }}>Backup: esporta o importa collezione, preferite e mazzi</Text>
      </Pressable>
      <Text style={{ color: t.ink, fontSize: 16, fontWeight: "800", marginTop: 16 }}>Le tue carte</Text>
    </View>
  );
}

// ---- Preferite: liste personali
function ListsHead({ flist, setFlist }: { flist: string; setFlist: (s: string) => void }) {
  const t = useTheme();
  const s = common(t);
  const [nw, setNw] = useState<string | null>(null);
  const [del, setDel] = useState(false);
  if (!favCount())
    return (
      <View style={[s.panel, { padding: 18, marginTop: 12, alignItems: "center" }]}>
        <Heart on={false} size={30} color={t.ink2} />
        <Text style={{ color: t.ink, fontSize: 18, fontWeight: "800", marginTop: 6 }}>Ancora nessuna preferita</Text>
        <Text style={{ color: t.ink2, textAlign: "center", marginTop: 6, lineHeight: 20 }}>Tocca il cuore su una carta (nella ricerca, in un prodotto o nella sua scheda) per ritrovarla qui. Quelle che non hai ancora finiscono nella Wishlist, con quanto costa completarle.</Text>
        <Btn label="Cerca carte" pri onPress={() => router.navigate("/carte")} />
      </View>
    );
  const L0 = flist ? listById(flist) : null;
  const chip = (id: string, label: string) => (
    <Pressable
      key={id || "all"}
      onPress={() => {
        setFlist(id);
        setDel(false);
      }}
      style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: flist === id ? t.accent : t.line, backgroundColor: flist === id ? t.accent : t.surface }}
    >
      <Text style={{ color: flist === id ? t.accentInk : t.ink, fontWeight: "600", fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={{ marginTop: 12 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
        {chip("", "Tutte · " + favCount())}
        {S.fav.l.map((L) => chip(L.id, L.n + " · " + Object.keys(L.k).filter((k) => S.fav.f[k]).length))}
        {nw != null ? (
          <TextInput
            autoFocus
            value={nw}
            onChangeText={setNw}
            placeholder="Nome della lista"
            placeholderTextColor={t.ink2}
            maxLength={40}
            onSubmitEditing={() => {
              if (nw.trim()) setFlist(listNew(nw.trim()).id);
              setNw(null);
            }}
            onBlur={() => setNw(null)}
            style={{ minWidth: 150, backgroundColor: t.surface, borderColor: t.accent, borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 5, color: t.ink }}
          />
        ) : (
          <Pressable onPress={() => setNw("")} style={{ paddingHorizontal: 12, paddingVertical: 6 }}>
            <Text style={{ color: t.accent, fontWeight: "700", fontSize: 13 }}>+ Nuova lista</Text>
          </Pressable>
        )}
      </View>
      {L0 && (
        <View style={{ flexDirection: "row", gap: 10, alignItems: "center", marginTop: 8 }}>
          <Pressable
            onPress={() => {
              if (!del) {
                setDel(true);
                return;
              }
              listDelete(L0.id);
              setFlist("");
              setDel(false);
            }}
          >
            <Text style={{ color: del ? t.accent : t.ink2, fontWeight: del ? "700" : "500", textDecorationLine: "underline" }}>{del ? "Tocca ancora per eliminare “" + L0.n + "”" : "Elimina la lista “" + L0.n + "”"}</Text>
          </Pressable>
          <Text style={{ color: t.ink2, fontSize: 12 }}>Le carte restano nelle preferite</Text>
        </View>
      )}
    </View>
  );
}

// ---- Wishlist: quanto costa completare le preferite che mancano
function WishHead({ list }: { list: Card[] }) {
  const t = useTheme();
  const s = common(t);
  if (!favCount()) return <ListsHead flist="" setFlist={() => {}} />;
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
    <View style={[s.panel, { padding: 12, marginTop: 12 }]}>
      <Text style={{ color: t.ink, fontWeight: "800" }}>Per completare le preferite{list.length ? " (" + list.length + (list.length === 1 ? " carta)" : " carte)") : ""}</Text>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
        {(
          [
            ["Cardmarket", tc, ncm],
            ["CardTrader", tt, nct],
          ] as [string, number, number][]
        ).map(([n, v, no]) => (
          <View key={n} style={{ flex: 1, backgroundColor: t.surface2, borderRadius: 10, padding: 10 }}>
            <Text style={{ color: t.ink2, fontSize: 12 }}>{n}</Text>
            <Text style={{ color: t.ink, fontSize: 18, fontWeight: "800" }}>{eurT(v)}</Text>
            {!!no && <Text style={{ color: t.ink2, fontSize: 11 }}>{nN(no)}</Text>}
          </View>
        ))}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 10 }}>
        <Text style={{ color: t.ink2 }}>Al prezzo più basso tra i due</Text>
        <Text style={{ color: t.ink, fontWeight: "800" }}>{eurT(tb)}</Text>
      </View>
      {!!nop && <Text style={{ color: t.ink2, fontSize: 12, marginTop: 4 }}>{nN(nop)} in entrambi i negozi, non conteggiate</Text>}
    </View>
  );
}

function Btn({ label, pri, onPress }: { label: string; pri?: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={{ marginTop: 10, alignSelf: "stretch", alignItems: "center", paddingVertical: 12, borderRadius: 10, backgroundColor: pri ? t.accent : t.surface2 }}>
      <Text style={{ color: pri ? t.accentInk : t.ink, fontWeight: "800" }}>{label}</Text>
    </Pressable>
  );
}

// ---- Backup: esporta (copia o condividi il testo) e importa (incolla il testo, unendo o sostituendo)
function Backup({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const [txt, setTxt] = useState("");
  const [msg, setMsg] = useState("");
  const [confirm, setConfirm] = useState(false);
  function done(r: { ok: boolean; msg: string }) {
    setMsg(r.msg);
    if (r.ok) setTxt("");
    setConfirm(false);
  }
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,.55)" }} onPress={onClose} />
      <SafeAreaView edges={["bottom"]} style={{ backgroundColor: t.bg, borderTopLeftRadius: 18, borderTopRightRadius: 18, maxHeight: "90%" }}>
        <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          <Text style={{ color: t.ink, fontSize: 20, fontWeight: "800" }}>Backup</Text>
          <Text style={{ color: t.ink2, marginTop: 4, lineHeight: 20 }}>Collezione, preferite, liste e mazzi in un testo da conservare o da incollare su un altro telefono (anche dall'app attuale di Digital Gate).</Text>

          <Text style={{ color: t.accent, fontWeight: "800", marginTop: 16 }}>Esporta</Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            <Pressable
              onPress={async () => {
                await Clipboard.setStringAsync(exportText());
                setMsg("Backup copiato: incollalo dove vuoi conservarlo.");
              }}
              style={{ flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 10, backgroundColor: t.accent }}
            >
              <Text style={{ color: t.accentInk, fontWeight: "800" }}>Copia</Text>
            </Pressable>
            <Pressable onPress={() => Share.share({ message: exportText(), title: "Backup Digital Gate" }).catch(() => {})} style={{ flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 10, backgroundColor: t.surface2 }}>
              <Text style={{ color: t.ink, fontWeight: "800" }}>Condividi</Text>
            </Pressable>
          </View>

          <Text style={{ color: t.accent, fontWeight: "800", marginTop: 20 }}>Importa</Text>
          <TextInput
            value={txt}
            onChangeText={(v) => {
              setTxt(v);
              setMsg("");
              setConfirm(false);
            }}
            placeholder="Incolla qui il testo del backup"
            placeholderTextColor={t.ink2}
            multiline
            style={{ marginTop: 8, minHeight: 90, maxHeight: 160, backgroundColor: t.surface, borderColor: t.line, borderWidth: 1, borderRadius: 10, padding: 10, color: t.ink, textAlignVertical: "top" }}
          />
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            <Pressable
              onPress={async () => {
                const v = await Clipboard.getStringAsync();
                if (v) setTxt(v);
              }}
              style={{ alignItems: "center", paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, backgroundColor: t.surface2 }}
            >
              <Text style={{ color: t.ink, fontWeight: "700" }}>Incolla</Text>
            </Pressable>
            <Pressable disabled={!txt.trim()} onPress={() => done(importText(txt, false))} style={{ flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 10, backgroundColor: t.accent, opacity: txt.trim() ? 1 : 0.4 }}>
              <Text style={{ color: t.accentInk, fontWeight: "800" }}>Unisci</Text>
            </Pressable>
            <Pressable
              disabled={!txt.trim()}
              onPress={() => (confirm ? done(importText(txt, true)) : setConfirm(true))}
              style={{ flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 10, backgroundColor: confirm ? "#c0261e" : t.surface2, opacity: txt.trim() ? 1 : 0.4 }}
            >
              <Text style={{ color: confirm ? "#fff" : t.ink, fontWeight: "800" }}>{confirm ? "Sicuro?" : "Sostituisci"}</Text>
            </Pressable>
          </View>
          <Text style={{ color: t.ink2, fontSize: 12, marginTop: 6, lineHeight: 17 }}>Unisci aggiunge i dati a quelli che hai (per ogni carta tiene il numero di copie più alto). Sostituisci cancella i dati di questo telefono e mette quelli del backup.</Text>
          {!!msg && <Text style={{ color: t.ink, fontWeight: "700", marginTop: 10 }}>{msg}</Text>}
        </ScrollView>
        <Pressable onPress={onClose} style={{ margin: 16, marginTop: 4, backgroundColor: t.surface2, borderRadius: 12, paddingVertical: 14, alignItems: "center" }}>
          <Text style={{ color: t.ink, fontWeight: "800", fontSize: 16 }}>Chiudi</Text>
        </Pressable>
      </SafeAreaView>
    </Modal>
  );
}
