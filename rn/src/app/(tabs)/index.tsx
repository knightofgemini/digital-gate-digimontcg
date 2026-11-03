// Home (come renderHomeMob dell'app attuale): prossima uscita in grande, "All'orizzonte", mazzo da riprendere e usciti di recente.
import { Pressable, ScrollView, View } from "react-native";
import { DISPLAY, Text } from "../../Text";
import { PRODUCTS, Upcoming, daysTo, monthLabel, recentSets, upBadge, upSorted, upWhen } from "../../data";
import { openDeck, openSet, openSoon, openUpcoming } from "../../nav";
import { useTheme } from "../../theme";
import { PageTitle } from "../../ui";
import { Screen, goTab, useBarState } from "../../chrome";
import { Badge, Banner, Grid2, Btn, ICO_ARROW, ICO_PLUS, Panel, ProdVisual, ProgLine, Progress, SecHead } from "../../visual";
import { S, setStats, useStore } from "../../store";
import { deckStats, newDeck } from "../../decks";

function UpItem({ u }: { u: Upcoming }) {
  const t = useTheme();
  const day = u.prec === "day";
  return (
    <Pressable onPress={() => (PRODUCTS[u.code] ? openUpcoming(u.code, "home") : openSoon())} style={{ flexDirection: "row", gap: 12, padding: 8, borderWidth: 1, borderColor: t.line, borderRadius: 12, backgroundColor: t.surface }}>
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
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 4 }}>
          <Text style={{ color: t.ink, fontFamily: DISPLAY, fontWeight: "700", fontSize: 12.8 }}>{u.prec === "none" ? "Da definire" : upWhen(u)}</Text>
          <View style={{ paddingHorizontal: 9, paddingVertical: 3, borderRadius: 7, backgroundColor: day ? t.accentSoft : t.cyanSoft }}>
            <Text style={{ color: day ? t.accent : t.cyan, fontWeight: "600", fontSize: 11.8 }}>{upBadge(u)}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function DeckResume() {
  const t = useTheme();
  const last = S.decks.slice().sort((a, b) => (b.upd || 0) - (a.upd || 0))[0];
  if (!last)
    return (
      <Panel title="Deckbuilding">
        <Text style={{ color: t.ink2, fontSize: 13.6, marginBottom: 10 }}>Crea il tuo primo mazzo: regole e lista ban vengono controllate mentre lo componi.</Text>
        <Btn label="Nuovo mazzo" pri icon={ICO_PLUS} onPress={() => openDeck(newDeck("Nuovo mazzo 1").id)} style={{ alignSelf: "flex-start" }} />
      </Panel>
    );
  const s0 = deckStats(last);
  const draft = s0.main < 50 && s0.problems.length === 1;
  return (
    <Panel title="Riprendi il mazzo">
      <Text style={{ color: t.ink, fontFamily: DISPLAY, fontWeight: "700", fontSize: 18.4, marginBottom: 2 }}>{last.name}</Text>
      <Text style={{ color: t.ink2, fontSize: 13.6, marginBottom: 10 }}>
        Principale {s0.main}/50 · Digi-Egg {s0.egg}/5 · {!s0.problems.length ? "mazzo valido" : draft ? "bozza" : "da sistemare"}
      </Text>
      <Progress h={Math.min(s0.main, 50)} n={50} height={6} style={{ marginBottom: 12 }} />
      <Btn label="Continua il mazzo" pri icon={ICO_ARROW} onPress={() => openDeck(last.id)} style={{ alignSelf: "flex-start" }} />
    </Panel>
  );
}

export default function Home() {
  const t = useTheme();
  const bar = useBarState();
  useStore();
  const ups = upSorted();
  const u0 = ups[0];
  const go0 = () => (u0 && PRODUCTS[u0.code] ? openUpcoming(u0.code, "home") : openSoon());
  const stats = setStats();
  return (
    <Screen bs={bar}>
      <ScrollView onScroll={bar.onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 4 + bar.pad, paddingBottom: 28 }}>
        <PageTitle>Home</PageTitle>
        {u0 ? (
          <View style={{ backgroundColor: t.surface, borderWidth: 1, borderColor: t.line, borderRadius: 16, overflow: "hidden" }}>
            <Banner code={u0.code} name={u0.name} ratio={16 / 8} radius={0} ring={false} onPress={go0}>
              <Badge icon="clock" text={upBadge(u0)} />
            </Banner>
            <View style={{ paddingTop: 12, paddingHorizontal: 14, paddingBottom: 14, gap: 4 }}>
              <Text style={{ color: t.cyan, fontFamily: DISPLAY, fontWeight: "600", fontSize: 11.2, letterSpacing: 2, textTransform: "uppercase" }}>Prossima uscita · {u0.code}</Text>
              <Text style={{ color: t.ink, fontFamily: DISPLAY, fontWeight: "700", fontSize: 21.6, lineHeight: 25 }}>{u0.name}</Text>
              <Text style={{ color: t.ink2, fontSize: 13.8 }}>
                {u0.kind} · {upWhen(u0)}
              </Text>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                {PRODUCTS[u0.code] ? <Btn label="Scheda prodotto" pri height={46} onPress={go0} style={{ flex: 1 }} /> : null}
                <Btn label="Calendario" height={46} onPress={openSoon} style={{ flex: 1 }} />
              </View>
            </View>
          </View>
        ) : null}
        {ups.length > 1 ? (
          <>
            <SecHead title="All'orizzonte" link={`Tutte (${ups.length}) →`} onLink={openSoon} />
            <View style={{ gap: 8 }}>
              {ups.slice(1, 3).map((u) => (
                <UpItem key={u.code} u={u} />
              ))}
            </View>
          </>
        ) : null}
        <View style={{ marginTop: 22 }}>
          <DeckResume />
        </View>
        <SecHead title="Usciti di recente" link="Tutti →" onLink={() => goTab("sets")} />
        <Grid2 gap={12}>
          {(w) => recentSets(8).map((x) => {
            const isNew = daysTo(x.date) >= -60;
            const s = stats[x.id];
            return (
              <View key={x.id} style={{ width: w }}>
                <Banner code={x.code} name={x.name} onPress={() => openSet(x.id, "home")}>
                  {isNew ? <Badge icon="spark" text="Nuovo" isNew /> : null}
                </Banner>
                <Text style={{ color: t.cyan, fontFamily: DISPLAY, fontWeight: "600", fontSize: 11.2, letterSpacing: 0.7, marginTop: 7 }}>
                  {x.code} · {monthLabel(x.date)}
                </Text>
                <Text style={{ color: t.ink2, fontFamily: DISPLAY, fontWeight: "700", fontStyle: "italic", textTransform: "uppercase", fontSize: 12.8, lineHeight: 16, letterSpacing: 0.25, marginTop: 7 }}>{x.name}</Text>
                {s && s.n ? <ProgLine h={s.h} n={s.n} size={11.5} style={{ marginTop: 6 }} /> : null}
              </View>
            );
          })}
        </Grid2>
      </ScrollView>
    </Screen>
  );
}
