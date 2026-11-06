// Riquadro "Carte nuove" (6 novembre 2026, richiesta dell'utente: al posto dell'avviso piccolo "Sono arrivate carte
// nuove" con "Aggiorna", che spariva dopo 10 s senza dire quali carte). Elenco per prodotto delle carte nuove e corrette
// (dataupd.ts → diffData) con miniatura, colori, codice, stelle e nome; per le corrette anche cosa è cambiato.
// Due momenti:
// - appena scaricate (dati non ancora in uso, "pending"): "Mostra le carte" fa il riavvio veloce dell'app (il catalogo
//   si prepara all'apertura) e poi apre il prodotto, o la carta toccata; "Più tardi" = in uso dalla prossima apertura;
// - all'apertura successiva, se il riepilogo non è ancora stato visto (dati già in uso): tutto si apre subito.
import { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Sheet } from "./Sheet";
import { DISPLAY, Text } from "./Text";
import { FitText } from "./fit";
import { ColorBand } from "./ui";
import { useTheme } from "./theme";
import { BYKEY, Card, MONTHS, SETBY, thumbUrl } from "./data";
import { News, NewsCard, NewsGroup, applyNewData, newsSeen, startupNews, takeGoto } from "./dataupd";
import { openCard, openSet } from "./nav";
import { whenIntroDone } from "./Intro";

const MAXROWS = 60; // per prodotto (es. dopo una correzione di molte carte): le altre si contano soltanto

let host: ((n: News, pending: boolean) => void) | null = null;
let queued: [News, boolean] | null = null;
// chiamata da _layout.tsx quando dataupd.ts ha scaricato carte nuove
export function showNews(n: News, pending: boolean) {
  if (host) host(n, pending);
  else queued = [n, pending];
}

const plural = (n: number, one: string, many: string) => n + " " + (n === 1 ? one : many);
function summary(n: News) {
  const p: string[] = [];
  if (n.n) p.push(plural(n.n, "carta nuova", "carte nuove"));
  if (n.c) p.push(plural(n.c, "carta corretta", "carte corrette"));
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
  const [st, setSt] = useState<{ n: News; pending: boolean } | null>(null);
  const [vis, setVis] = useState(false);

  useEffect(() => {
    const show = (n: News, pending: boolean) =>
      whenIntroDone(() => {
        setSt({ n, pending });
        setVis(true);
      });
    host = show;
    if (queued) {
      show(queued[0], queued[1]);
      queued = null;
    }
    // dopo il riavvio di "Mostra le carte": dritti al prodotto (e alla carta toccata), senza riquadro
    const g = takeGoto();
    const n = startupNews();
    if (g && g.set && SETBY[g.set]) {
      if (n) newsSeen(n);
      const set = g.set;
      setTimeout(() => {
        openSet(set);
        const c = g.k && BYKEY[g.k];
        if (c) {
          const list = (g.keys || []).map((k) => BYKEY[k]).filter(Boolean) as Card[];
          setTimeout(() => openCard(c, list), 350);
        }
      }, 150);
    } else if (n) show(n, false); // carte arrivate dall'ultima volta: riepilogo appena aperta l'app
    return () => {
      host = null;
    };
  }, []);

  if (!st) return null;
  const { n, pending } = st;
  const close = () => {
    setVis(false);
    newsSeen(n);
  };
  // dati già in uso: si chiude il riquadro e si apre la pagina; altrimenti riavvio veloce e poi la pagina
  const goGroup = (g: NewsGroup) => {
    if (pending) return applyNewData({ set: g.id });
    close();
    setTimeout(() => SETBY[g.id] && openSet(g.id), 260);
  };
  const goCard = (g: NewsGroup, x: NewsCard) => {
    if (pending) return applyNewData({ set: g.id, k: x.k, keys: g.cards.map((c) => c.k) });
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
        <Text style={{ color: t.ink, fontFamily: DISPLAY, fontWeight: "700", fontStyle: "italic", textTransform: "uppercase", fontSize: 26, lineHeight: 31, marginTop: 2 }}>{n.n ? "Carte nuove" : "Carte corrette"}</Text>
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
                <Text style={{ color: t.ink2, fontSize: 12.5, marginTop: 1 }}>{[g.n ? plural(g.n, "nuova", "nuove") : "", g.c ? plural(g.c, "corretta", "corrette") : ""].filter(Boolean).join(" · ")}</Text>
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

      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14 + ins.bottom, borderTopWidth: 1, borderColor: t.line }}>
        {pending ? <Text style={{ color: t.ink2, fontSize: 12.8, lineHeight: 18, marginBottom: 10 }}>Per vederle nell'app serve un riavvio veloce, che fa "Mostra le carte". Se scegli "Più tardi" le trovi alla prossima apertura.</Text> : null}
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable onPress={close} style={[btn, { backgroundColor: t.surface2 }]}>
            <Text style={{ color: t.ink, fontWeight: "600", fontSize: 15.2 }}>{pending ? "Più tardi" : "Chiudi"}</Text>
          </Pressable>
          {pending || one ? (
            <Pressable onPress={() => (pending && !one ? applyNewData() : goGroup(one!))} style={[btn, { flex: 1.4, backgroundColor: t.accent }]}>
              <Text style={{ color: t.accentInk, fontWeight: "700", fontSize: 15.2 }} numberOfLines={1}>
                {pending ? "Mostra le carte" : "Apri " + one!.code}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Sheet>
  );
}
