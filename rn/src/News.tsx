// Riquadro "Carte nuove" (6 novembre 2026, richiesta dell'utente: al posto dell'avviso piccolo "Sono arrivate carte
// nuove" con "Aggiorna", che spariva dopo 10 s senza dire quali carte e riavviava l'app). Elenco per prodotto delle carte
// nuove e corrette (dataupd.ts → diffData) con miniatura, colori, codice, stelle e nome; per le corrette anche cosa è
// cambiato. Compare appena le carte sono scaricate e già in uso (nessun riavvio): tocco su una carta = la sua scheda,
// sul prodotto = la pagina del prodotto. Se l'app si chiude prima di vederlo, compare alla prossima apertura.
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Sheet } from "./Sheet";
import { DISPLAY, Text } from "./Text";
import { FitText } from "./fit";
import { ColorBand } from "./ui";
import { useTheme } from "./theme";
import { BYKEY, Card, MONTHS, SETBY, thumbUrl } from "./data";
import { News, NewsCard, NewsGroup, newsSeen, startupNews } from "./dataupd";
import { openCard, openSet } from "./nav";
import { NEWS_HOOK, autoOn, bootNow } from "./offline";
import { whenIntroDone } from "./Intro";

const MAXROWS = 60; // per prodotto (es. dopo una correzione di molte carte): le altre si contano soltanto

let host: ((n: News) => void) | null = null;
let queued: News | null = null;

// avvisi in fila (12 novembre 2026, richiesta dell'utente: l'avviso "Nuova versione disponibile" copriva il riquadro):
// finché il riquadro delle carte nuove è in arrivo o aperto gli altri avvisi aspettano (Update.tsx → useNewsBusy)
let waiting = 0, // showNews in corso
  showing = false, // riquadro consegnato o aperto
  showingT: ReturnType<typeof setTimeout> | null = null;
const busySubs = new Set<() => void>();
const emitBusy = () => busySubs.forEach((f) => f());
export const newsBusy = () => waiting > 0 || !!held || !!queued || showing;
export function useNewsBusy() {
  const [b, setB] = useState(newsBusy());
  useEffect(() => {
    const f = () => setB(newsBusy());
    busySubs.add(f);
    f();
    return () => {
      busySubs.delete(f);
    };
  }, []);
  return b;
}
// f appena non c'è nessun riquadro delle carte nuove in arrivo o aperto
export function whenNewsIdle(f: () => void) {
  if (!newsBusy()) return f();
  const g = () => {
    if (newsBusy()) return;
    busySubs.delete(g);
    f();
  };
  busySubs.add(g);
}
function setShowing(v: boolean) {
  if (showingT) clearTimeout(showingT);
  showingT = null;
  if (v) {
    showing = true;
    emitBusy();
  } else
    // il tempo di chiudere il riquadro, poi il prossimo avviso
    showingT = setTimeout(() => {
      showing = false;
      emitBusy();
    }, 450);
}

// chiamata da _layout.tsx quando dataupd.ts ha scaricato e messo in uso carte nuove
function deliver(n: News) {
  setShowing(true);
  if (host) host(n);
  else queued = queued ? mergeNews(queued, n) : n;
}
// tutto insieme (12 novembre 2026, richiesta dell'utente): con lo scaricamento automatico delle immagini attivo il
// riepilogo delle carte nuove aspetta la fine del giro delle immagini e compare in un riquadro solo con quelle
// (al massimo 2 minuti: poi compare comunque, e le immagini che arrivano dopo si aggiungono al riquadro se è aperto)
let held: News | null = null;
let heldT: ReturnType<typeof setTimeout> | null = null;
function flush(extra?: News) {
  if (heldT) clearTimeout(heldT);
  heldT = null;
  const n = held && extra ? mergeNews(held, extra) : held || extra;
  held = null;
  if (n) deliver(n);
}
// chiamata da _layout.tsx quando dataupd.ts ha scaricato e messo in uso carte nuove
export function showNews(n: News) {
  waiting++;
  emitBusy();
  const done = () => {
    waiting--;
    emitBusy();
  };
  autoOn()
    .then((on) => {
      if (!on) return deliver(n);
      held = held ? mergeNews(held, n) : n;
      if (!heldT) heldT = setTimeout(() => flush(), 120e3);
      bootNow();
    })
    .catch(() => deliver(n))
    .finally(done);
}
// immagini scaricate in automatico (offline.ts): insieme alle carte in attesa, se ci sono
NEWS_HOOK.show = (n) => flush(n);
NEWS_HOOK.idle = () => held && flush();

// un riquadro solo (12 novembre 2026, richiesta dell'utente): le immagini aggiornate che arrivano mentre il riquadro
// delle carte nuove è aperto (o viceversa) si aggiungono allo stesso riquadro, prodotto per prodotto, senza ripetere carte
function mergeNews(a: News, b: News): News {
  const base = a.h === "img" && b.h !== "img" ? b : a,
    add = base === a ? b : a;
  const groups: NewsGroup[] = base.groups.map((g) => ({ ...g, cards: g.cards.slice() }));
  const byId: Record<string, NewsGroup> = {};
  groups.forEach((g) => (byId[g.id] = g));
  add.groups.forEach((g) => {
    const t = byId[g.id];
    if (!t) {
      groups.push((byId[g.id] = { ...g, cards: g.cards.slice() }));
      return;
    }
    const have = new Set(t.cards.map((x) => x.k));
    g.cards.forEach((x) => {
      if (have.has(x.k)) return;
      t.cards.push(x);
      if (x.kind === "n") t.n++;
      else if (x.kind === "c") t.c++;
      else t.i = (t.i || 0) + 1;
    });
  });
  const dk = (g: NewsGroup) => (g.date && g.date.charAt(0) !== "0" ? g.date : "");
  groups.sort((x, y) => (dk(x) < dk(y) ? 1 : dk(x) > dk(y) ? -1 : 0));
  const sum = (k: "n" | "c" | "i") => groups.reduce((t, g) => t + (g[k] || 0), 0);
  return { ...base, n: sum("n"), c: sum("c"), i: sum("i"), groups };
}

const plural = (n: number, one: string, many: string) => n + " " + (n === 1 ? one : many);
function summary(n: News) {
  const p: string[] = [];
  if (n.n) p.push(plural(n.n, "carta nuova", "carte nuove"));
  if (n.c) p.push(plural(n.c, "carta corretta", "carte corrette"));
  if (n.i) p.push(plural(n.i, "carta con l'immagine nuova o aggiornata", "carte con l'immagine nuova o aggiornata"));
  const where = n.groups.length === 1 ? " in " + n.groups[0].code : " in " + n.groups.length + " prodotti";
  return p.join(" e ") + where;
}
function when(at: number) {
  const d = new Date(at);
  return "Aggiornamento del " + d.getDate() + " " + MONTHS[d.getMonth()];
}
const live = (g: NewsGroup) => g.cards.map((x) => BYKEY[x.k]).filter(Boolean) as Card[];

export function NewsHost() {
  const t = useTheme();
  const ins = useSafeAreaInsets();
  const [n, setN] = useState<News | null>(null);
  const [vis, setVis] = useState(false);
  // un riquadro solo: se arriva un altro riepilogo mentre è aperto (es. immagini dopo le carte nuove) si unisce a quello
  const open = useRef(false);
  const openNow = (x: News) => {
    open.current = true;
    setN(x);
    setVis(true);
  };

  useEffect(() => {
    const show = (x: News) =>
      whenIntroDone(() => {
        if (open.current) setN((cur) => (cur ? mergeNews(cur, x) : x));
        else openNow(x);
      });
    host = show;
    const q = queued;
    queued = null;
    // carte arrivate l'ultima volta ma riepilogo non ancora visto (app chiusa prima): appena aperta l'app
    // (anche quelle scaricate in sottofondo ad app chiusa, bgTask.ts): aspetta le immagini come le altre, così carte e
    // immagini compaiono nello stesso riquadro
    const old = q ? null : startupNews();
    if (q) show(q);
    else if (old) showNews(old);
    return () => {
      host = null;
    };
  }, []);

  if (!n) return null;
  const close = () => {
    setVis(false);
    newsSeen(n);
    open.current = false;
    setShowing(false);
  };
  // si chiude il riquadro e si apre la pagina (le carte sono già in uso)
  const goGroup = (g: NewsGroup) => {
    close();
    setTimeout(() => SETBY[g.id] && openSet(g.id), 260);
  };
  const goCard = (g: NewsGroup, x: NewsCard) => {
    const c = BYKEY[x.k];
    if (!c) return goGroup(g);
    close();
    setTimeout(() => openCard(c, live(g)), 260);
  };
  const one = n.groups.length === 1 ? n.groups[0] : null;
  const btn = { flex: 1, minHeight: 50, borderRadius: 14, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 } as const;

  return (
    <Sheet visible={vis} onClose={close} maxH={0.9} scrim="rgba(4,8,18,.6)" style={{ backgroundColor: t.surface, borderTopWidth: 1, borderColor: t.line, borderTopLeftRadius: 22, borderTopRightRadius: 22, boxShadow: "0 -12px 32px rgba(0,0,0,.35)" }}>
      {/* intestazione e pulsanti fissi, elenco che scorre in mezzo (come Backup: si chiude tirando giù dall'intestazione) */}
      <View style={{ paddingTop: 8, paddingHorizontal: 16 }}>
        <View style={{ alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: t.line }} />
        <Text style={{ color: t.cyan, fontFamily: DISPLAY, fontWeight: "700", fontSize: 12, letterSpacing: 1.6, marginTop: 12 }}>{when(n.at).toUpperCase()}</Text>
        <Text style={{ color: t.ink, fontFamily: DISPLAY, fontWeight: "700", fontStyle: "italic", textTransform: "uppercase", fontSize: 26, lineHeight: 31, marginTop: 2 }}>{n.n ? "Carte nuove" : n.c ? "Carte corrette" : "Immagini aggiornate"}</Text>
        <Text style={{ color: t.ink2, fontSize: 14.4, lineHeight: 20, marginTop: 2 }}>{summary(n) + "."}</Text>
      </View>

      <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} contentContainerStyle={{ paddingTop: 12, paddingHorizontal: 16, paddingBottom: 8, gap: 14 }}>
        {n.groups.map((g) => (
          <View key={g.id} style={{ borderWidth: 1, borderColor: t.line, borderRadius: 14, overflow: "hidden", backgroundColor: t.bg }}>
            {/* intestazione del prodotto: tocco = pagina del prodotto */}
            <Pressable onPress={() => goGroup(g)} accessibilityLabel={"Apri " + g.code + " " + g.name} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: t.surface2 }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ color: t.accent, fontFamily: DISPLAY, fontWeight: "700", fontSize: 16 }}>{g.code}</Text>
                  {g.soon ? (
                    <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: t.cyanSoft }}>
                      <Text style={{ color: t.cyan, fontSize: 11.2, fontWeight: "700" }}>SPOILER · IN ARRIVO</Text>
                    </View>
                  ) : null}
                </View>
                <FitText text={g.name} size={14.4} lines={1} style={{ color: t.ink, fontWeight: "600" }} />
                <Text style={{ color: t.ink2, fontSize: 12.5, marginTop: 1 }}>{[g.n ? plural(g.n, "nuova", "nuove") : "", g.c ? plural(g.c, "corretta", "corrette") : "", g.i ? plural(g.i, "immagine", "immagini") : ""].filter(Boolean).join(" · ")}</Text>
              </View>
              <Text style={{ color: t.cyan, fontFamily: DISPLAY, fontWeight: "700", fontSize: 14.4 }}>Apri ›</Text>
            </Pressable>
            {g.cards.slice(0, MAXROWS).map((x, i) => {
              const c = BYKEY[x.k];
              return (
                <Pressable key={x.k} onPress={() => goCard(g, x)} accessibilityLabel={"Apri " + x.name} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, paddingHorizontal: 12, borderTopWidth: 1, borderColor: t.line }}>
                  <View style={{ width: 44, gap: 3 }}>
                    <Image source={c ? thumbUrl(c) : x.u} style={{ width: 44, height: 61, borderRadius: 4, backgroundColor: t.surface2 }} contentFit="cover" cachePolicy="disk" transition={120} recyclingKey={x.k} />
                    <ColorBand colors={x.colors} height={3} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: t.ink2, fontSize: 12.5, fontWeight: "600" }}>
                      {x.code}
                      {x.mark ? <Text style={{ color: t.accent, fontWeight: "700" }}>{"  " + x.mark}</Text> : null}
                    </Text>
                    <FitText text={x.name} size={15} style={{ color: t.ink, fontWeight: "600" }} />
                    {x.kind === "n" ? (
                      <View style={{ alignSelf: "flex-start", marginTop: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: t.accentSoft }}>
                        <Text style={{ color: t.accent, fontSize: 11.5, fontWeight: "700" }}>NUOVA</Text>
                      </View>
                    ) : x.kind === "i" ? (
                      <View style={{ alignSelf: "flex-start", marginTop: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: t.dark ? "#163329" : "#eaf6ed" }}>
                        <Text style={{ color: t.ok, fontSize: 11.5, fontWeight: "700" }}>IMMAGINE NUOVA O AGGIORNATA</Text>
                      </View>
                    ) : (
                      <View style={{ alignSelf: "flex-start", marginTop: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: t.cyanSoft, maxWidth: "100%" }}>
                        <Text style={{ color: t.cyan, fontSize: 11.5, fontWeight: "700" }} numberOfLines={1}>
                          {"CORRETTA · " + (x.what || "").toUpperCase()}
                        </Text>
                      </View>
                    )}
                  </View>
                </Pressable>
              );
            })}
            {g.cards.length > MAXROWS ? (
              <Pressable onPress={() => goGroup(g)} style={{ paddingVertical: 12, alignItems: "center", borderTopWidth: 1, borderColor: t.line }}>
                <Text style={{ color: t.cyan, fontWeight: "600" }}>{"… e altre " + (g.cards.length - MAXROWS) + " nel prodotto"}</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
      </ScrollView>

      <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 14 + ins.bottom, borderTopWidth: 1, borderColor: t.line }}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable onPress={close} style={[btn, { backgroundColor: t.surface2 }]}>
            <Text style={{ color: t.ink, fontWeight: "600", fontSize: 15.2 }}>Chiudi</Text>
          </Pressable>
          {one ? (
            <Pressable onPress={() => goGroup(one)} style={[btn, { flex: 1.4, backgroundColor: t.accent }]}>
              <Text style={{ color: t.accentInk, fontWeight: "700", fontSize: 15.2 }} numberOfLines={1}>
                {"Vai a " + one.code}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Sheet>
  );
}
