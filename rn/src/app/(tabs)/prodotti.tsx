// Prodotti (come renderSets/segProd/renderSoonDesk dell'app attuale sul telefono): schede "Rilasciati" / "In arrivo";
// i rilasciati in griglia con l'illustrazione, per tipo o in ordine cronologico per anno (pulsanti accanto alle schede,
// scelta salvata in "dg-pord"); gli "In arrivo" come cronologia per mese dalla più vicina. Ricerca in basso con i tipi.
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Svg, { Path, Rect } from "react-native-svg";
import { DISPLAY, Text } from "../../Text";
import { CardSet, PRODUCTS, SETBY, SETS, TYPES, UPCOMING, Upcoming, cardsOfSet, cdParts, daysTo, fold, monthLabel, normQ, numOf, soonSet, spoilerSet, upSorted, upWhen } from "../../data";
import { setStats, useStore } from "../../store";
import { openUpcoming } from "../../nav";
import { useTheme } from "../../theme";
import { PageTitle } from "../../ui";
import { Screen, useBarState } from "../../chrome";
import { Badge, Grid2, ProdVisual, ProgLine } from "../../visual";
import { BOTTOM_PAD, BottomBar, Chip } from "../../BottomBar";

const CHIPS: [string, string][] = [["ALL", "Tutti"], ["BT", "Booster"], ["EX", "Extra"], ["ST", "Starter"], ["LM", "Limited"], ["PB", "Premium"], ["AL", "Altri"]];
const spoilerN = (s: CardSet) => cardsOfSet(s.id).filter((c) => !c.suf).length;
let PORD: "type" | "date" = "type";
AsyncStorage.getItem("dg-pord").then((v) => v === "date" && (PORD = "date")).catch(() => {});

function Seg({ active, onPick }: { active: string; onPick: (v: string) => void }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, flexDirection: "row", padding: 3, borderRadius: 12, backgroundColor: t.surface2 }}>
      {[
        ["sets", "Rilasciati"],
        ["soon", "In arrivo · " + UPCOMING.length],
      ].map(([k, label]) => {
        const on = active === k;
        return (
          <Pressable key={k} onPress={() => onPick(k)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={{ flex: 1, minHeight: 42, borderRadius: 9, alignItems: "center", justifyContent: "center", paddingHorizontal: 4, backgroundColor: on ? t.surface : "transparent", boxShadow: on ? "0 1px 3px rgba(15,26,46,.15)" : undefined }}>
            <Text style={{ color: on ? t.ink : t.ink2, fontWeight: on ? "700" : "500", fontSize: 14.4, lineHeight: 20 }}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function OrdBtn({ on, kind, onPress }: { on: boolean; kind: "date" | "type"; onPress: () => void }) {
  const t = useTheme();
  const c = on ? t.bg : t.ink2;
  const p = { stroke: c, strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  return (
    <Pressable onPress={onPress} accessibilityLabel={kind === "date" ? "Ordine cronologico di uscita (senza Starter Deck e Premium Bandai)" : "Ordine per tipo di prodotto"} accessibilityState={{ selected: on }} style={{ width: 42, height: 42, borderRadius: 10, borderWidth: 1, borderColor: on ? t.ink : t.line, backgroundColor: on ? t.ink : t.surface, alignItems: "center", justifyContent: "center" }}>
      <Svg width={20} height={20} viewBox="0 0 24 24">
        {kind === "date" ? (
          <>
            <Rect {...p} x={3.5} y={5} width={17} height={15} rx={2} />
            <Path {...p} d="M3.5 10h17M8 3v4M16 3v4" />
            <Path {...p} d="M8 14h3" />
          </>
        ) : (
          <>
            <Rect {...p} x={3.5} y={4} width={7} height={7} rx={1.5} />
            <Rect {...p} x={13.5} y={4} width={7} height={7} rx={1.5} />
            <Path {...p} d="M4 15.5h16M4 19.5h16" />
          </>
        )}
      </Svg>
    </Pressable>
  );
}

function GroupTitle({ children, top = 18 }: { children: string; top?: number }) {
  const t = useTheme();
  return <Text style={{ color: t.ink2, fontFamily: DISPLAY, fontWeight: "500", fontSize: 12.5, letterSpacing: 1.5, textTransform: "uppercase", marginTop: top, marginBottom: 8 }}>{children}</Text>;
}

// riquadro di un prodotto (.ptile)
function ProdTile({ s, hit, q, w }: { s: CardSet; hit?: number; q: string; w: number }) {
  const t = useTheme();
  const st = setStats()[s.id] || { n: 0, h: 0 };
  const isNew = !!s.date && daysTo(s.date) >= -60 && daysTo(s.date) <= 0;
  return (
    <Pressable onPress={() => router.push({ pathname: "/prodotto/[id]", params: hit ? { id: s.id, q, qm: "name" } : { id: s.id } })} style={{ width: w, borderWidth: 1, borderColor: t.line, backgroundColor: t.surface, borderRadius: 12, overflow: "hidden" }}>
      <ProdVisual code={s.code}>{isNew ? <Badge icon="spark" text="Nuovo" isNew /> : null}</ProdVisual>
      <View style={{ paddingTop: 9, paddingHorizontal: 10, paddingBottom: 11, gap: 2 }}>
        <Text style={{ color: t.cyan, fontFamily: DISPLAY, fontWeight: "600", fontSize: 11.2, letterSpacing: 0.9, textTransform: "uppercase" }}>{s.code}</Text>
        <Text style={{ color: t.ink, fontWeight: "600", fontSize: 14.7, lineHeight: 18 }}>{s.name}</Text>
        {s.date && s.date.charAt(0) !== "0" ? <Text style={{ color: t.ink2, fontSize: 12.5 }}>{monthLabel(s.date)}</Text> : null}
        {hit ? <Text style={{ color: t.accent, fontSize: 12.5, fontWeight: "600" }}>{hit + (hit === 1 ? " carta trovata" : " carte trovate")}</Text> : null}
        <ProgLine h={st.h} n={st.n} />
      </View>
    </Pressable>
  );
}

// voce della cronologia delle uscite (.titem)
function SoonItem({ u }: { u: Upcoming }) {
  const t = useTheme();
  const sps = spoilerSet(u.code);
  const can = !!(PRODUCTS[u.code] || sps);
  let chip = "",
    m = true;
  if (u.prec === "day") {
    const dd = daysTo(u.from);
    chip = dd <= 0 ? "Oggi" : dd + (dd === 1 ? " giorno" : " giorni");
    m = false;
  } else if (u.prec === "none") chip = "Annunciato";
  else {
    const cd = cdParts(u);
    chip = cd.big ? "Tra " + cd.big + " " + cd.unit : cd.unit;
  }
  return (
    <Pressable disabled={!can} onPress={() => openUpcoming(u.code)} style={{ flexDirection: "row", gap: 12, padding: 8, marginBottom: 10, borderWidth: 1, borderColor: t.line, borderRadius: 12, backgroundColor: t.surface }}>
      <View style={{ width: 84, borderRadius: 8, overflow: "hidden", alignSelf: "center" }}>
        <ProdVisual code={u.code} codeSize={16} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ alignSelf: "flex-start", backgroundColor: t.surface2, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
          <Text style={{ color: t.ink2, fontFamily: DISPLAY, fontWeight: "600", fontSize: 11.2, letterSpacing: 0.45 }}>
            {u.code} · {u.kind}
          </Text>
        </View>
        <Text style={{ color: t.ink, fontFamily: DISPLAY, fontWeight: "600", fontSize: 15.2, marginTop: 4, marginBottom: 2 }}>{u.name}</Text>
        {sps ? <Text style={{ color: t.accent, fontSize: 12.5, fontWeight: "600", marginTop: 4 }}>Spoiler · {spoilerN(sps)} carte svelate: tocca per vederle</Text> : null}
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 4 }}>
          <Text style={{ color: t.ink, fontFamily: DISPLAY, fontWeight: "700", fontSize: 12.8 }}>{u.prec === "none" ? "Da definire" : upWhen(u)}</Text>
          <View style={{ paddingHorizontal: 9, paddingVertical: 3, borderRadius: 7, backgroundColor: m ? t.cyanSoft : t.accentSoft }}>
            <Text style={{ color: m ? t.cyan : t.accent, fontWeight: "600", fontSize: 11.8 }}>{chip}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function SoonList() {
  const t = useTheme();
  const groups: { k: string; label: string; items: Upcoming[] }[] = [];
  const byKey: Record<string, (typeof groups)[0]> = {};
  upSorted().forEach((u) => {
    const k = u.prec === "none" ? "tbd" : u.from.slice(0, 7);
    if (!byKey[k]) groups.push((byKey[k] = { k, label: k === "tbd" ? "Senza data" : monthLabel(u.from), items: [] }));
    byKey[k].items.push(u);
  });
  return (
    <>
      <Text style={{ color: t.ink2, fontSize: 13.6, marginBottom: 12 }}>Dalla più vicina. Le date possono riferirsi all'uscita giapponese: quella inglese può arrivare più tardi.</Text>
      {groups.map((g) => (
        <View key={g.k} style={{ paddingLeft: 18, borderLeftWidth: 2, borderLeftColor: t.line, marginLeft: 5, paddingBottom: 10 }}>
          <View style={{ position: "absolute", left: -7, top: 8, width: 12, height: 12, borderRadius: 6, backgroundColor: t.cyan, boxShadow: `0 0 0 4px ${t.bg}` }} />
          <Text style={{ color: t.ink, fontFamily: DISPLAY, fontWeight: "700", fontSize: 16.8, marginBottom: 10, paddingTop: 2 }}>{g.label}</Text>
          {g.items.map((u) => (
            <SoonItem key={u.code} u={u} />
          ))}
        </View>
      ))}
    </>
  );
}

export default function Prodotti() {
  const t = useTheme();
  const bar = useBarState();
  useStore();
  const params = useLocalSearchParams<{ seg?: string }>();
  const [seg, setSeg] = useState(params.seg === "soon" ? "soon" : "sets");
  const [pord, setPord] = useState(PORD);
  const [q, setQ] = useState("");
  const [type, setType] = useState("ALL");
  const [px, setPx] = useState(false);
  useEffect(() => {
    if (params.seg) setSeg(params.seg === "soon" ? "soon" : "sets");
  }, [params.seg]);
  const pickSeg = (v: string) => {
    setSeg(v);
    router.setParams({ seg: v });
  };
  const pickOrd = (v: "type" | "date") => {
    PORD = v;
    setPord(v);
    AsyncStorage.setItem("dg-pord", v).catch(() => {});
  };

  const { groups, hits } = useMemo(() => {
    const nq = normQ(q);
    const hits: Record<string, number> = {};
    const list = SETS.filter((x) => {
      if (soonSet(x)) return false;
      if (type !== "ALL" && x.type !== type) return false;
      if (!nq || normQ(x.code + " " + x.name).indexOf(nq) >= 0) return true;
      const parts = nq.split(" ");
      const n = cardsOfSet(x.id).filter((c) => parts.every((p) => fold(c.name).indexOf(p) >= 0)).length;
      if (n) hits[x.id] = n;
      return n > 0;
    });
    let groups: [string, CardSet[]][] = [];
    if (pord === "date") {
      const cl = list
        .filter((s) => s.date && s.date.charAt(0) !== "0" && (type !== "ALL" || (s.type !== "ST" && s.type !== "PB")))
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0) || numOf(b.code) - numOf(a.code));
      cl.forEach((s) => {
        const y = s.date.slice(0, 4);
        if (!groups.length || groups[groups.length - 1][0] !== y) groups.push([y, []]);
        groups[groups.length - 1][1].push(s);
      });
    } else
      groups = Object.keys(TYPES)
        .map((k) => [TYPES[k], list.filter((s) => s.type === k)] as [string, CardSet[]])
        .filter((g) => g[1].length);
    return { groups, hits };
  }, [q, type, pord]);

  return (
    <Screen bs={bar}>
      <ScrollView onScroll={bar.onScroll} scrollEventThrottle={16} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 4 + bar.pad, paddingBottom: seg === "sets" ? BOTTOM_PAD + (px ? 46 : 0) : 28 }}>
        <PageTitle>Prodotti</PageTitle>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2, marginBottom: 12 }}>
          <Seg active={seg} onPick={pickSeg} />
          {seg === "sets" ? (
            <View style={{ flexDirection: "row", gap: 6 }}>
              <OrdBtn kind="date" on={pord === "date"} onPress={() => pickOrd("date")} />
              <OrdBtn kind="type" on={pord === "type"} onPress={() => pickOrd("type")} />
            </View>
          ) : null}
        </View>
        {seg === "soon" ? (
          <SoonList />
        ) : !groups.length ? (
          <Text style={{ color: t.ink2, textAlign: "center", marginTop: 30 }}>Nessun set corrisponde ai filtri.</Text>
        ) : (
          groups.map(([label, items], i) => (
            <View key={label}>
              <GroupTitle top={i ? 18 : 6}>{label + " · " + items.length}</GroupTitle>
              <Grid2 gap={10}>{(w) => items.map((s) => <ProdTile key={s.id} s={s} hit={hits[s.id]} q={q} w={w} />)}</Grid2>
            </View>
          ))
        )}
      </ScrollView>
      {seg === "sets" ? (
        <BottomBar
          q={q}
          setQ={setQ}
          placeholder="Cerca per set, codice o Digimon…"
          x={{ open: px, onPress: () => setPx(!px) }}
          below={px ? CHIPS.map(([k, label]) => <Chip key={k} label={label} on={type === k} onPress={() => setType(k)} shadow />) : undefined}
        />
      ) : null}
    </Screen>
  );
}
