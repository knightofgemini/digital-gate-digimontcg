// Immagini offline (come renderOffline dell'app attuale sul telefono): riquadro con le immagini salvate e l'avanzamento,
// "Cosa scaricare" (Solo miniature / Tutto in HD con peso stimato, quante sono salvate e "Scarica"), "Per prodotto"
// (codice, nome, percentuale e pulsante per scaricare) ed "Elimina tutte le immagini salvate" con conferma.
// Con i dati mobili chiede conferma prima di scaricare.
// Differenze dovute alla memoria delle immagini della nuova app: non si cancella un solo prodotto o un solo tipo di immagine.
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import * as Network from "expo-network";
import { DISPLAY, Text } from "../Text";
import { SETS, numOf } from "../data";
import { AVG, OFF, RUN, clearAll, items, label, mb, pause, progressOf, start, useOffline, weight } from "../offline";
import { useTheme } from "../theme";
import { PageTitle } from "../ui";
import { Screen, useBarState } from "../chrome";
import { Btn, Progress } from "../visual";
import { ConfirmBox } from "../deckui";

const ICO_TRASH = "M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6";
const ICO_DL = "M12 4v11M7 10l5 5 5-5M5 20h14";
const num = (n: number) => n.toLocaleString("it-IT");

function SmallBtn({ icon, color, onPress, disabled, label }: { icon: string; color: string; onPress: () => void; disabled?: boolean; label: string }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityLabel={label} style={{ width: 40, height: 40, borderRadius: 11, borderWidth: 1, borderColor: t.line, backgroundColor: t.bg, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.45 : 1 }}>
      <Svg width={20} height={20} viewBox="0 0 24 24">
        <Path d={icon} stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </Svg>
    </Pressable>
  );
}

export default function Offline() {
  const t = useTheme();
  const bar = useBarState();
  useOffline();
  const [cell, setCell] = useState(false);
  const [ask, setAsk] = useState<string | null>(null);
  const [del, setDel] = useState(false);
  useEffect(() => {
    Network.getNetworkStateAsync()
      .then((n) => setCell(n.type === Network.NetworkStateType.CELLULAR))
      .catch(() => {});
  }, []);
  const go = (scope: string) => (cell ? setAsk(scope) : start(scope));
  const running = RUN.running;

  // immagini già salvate (unione di tutte le scelte), divise per tipo, e peso stimato
  const sets = useMemo(() => SETS.filter((x) => (x.v || []).length).sort((a, b) => ((a.date || "") < (b.date || "") ? 1 : (a.date || "") > (b.date || "") ? -1 : numOf(b.code) - numOf(a.code))), []);
  const seen: Record<string, number> = {};
  ["t", "hd", ...sets.map((x) => x.id)].forEach((sc) => {
    const p = progressOf(sc);
    if (!p) return;
    items(sc)
      .slice(0, p)
      .forEach((x) => (seen[x.u] = x.w));
  });
  let nF = 0,
    nT = 0,
    nO = 0,
    w = 0;
  Object.keys(seen).forEach((u) => {
    const v = seen[u];
    w += v;
    if (v === AVG.f || v === AVG.pre) nF++;
    else if (v === AVG.t) nT++;
    else nO++;
  });
  const nAll = nF + nT + nO;

  const pScope = RUN.scope;
  const pTot = pScope ? items(pScope).length : 0;
  const pDone = pScope ? progressOf(pScope) : 0;
  const paused = !running && ["t", "hd"].find((sc) => OFF.pos[sc] && !OFF.done[sc]);

  return (
    <Screen bs={bar}>
      <ScrollView onScroll={bar.onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 4 + bar.pad, paddingBottom: 28 + 24 }}>
        <PageTitle>Immagini offline</PageTitle>
        <Text style={{ color: t.ink2, fontSize: 14.7, lineHeight: 23, marginTop: -4, marginBottom: 14 }}>Scarica le immagini nel dispositivo: compaiono subito e funzionano anche senza internet. Restano salvate anche quando aggiorni l'app. Lo scaricamento continua finché l'app resta aperta, anche se cambi schermata.</Text>

        {/* stato */}
        <View style={{ borderWidth: 1, borderColor: t.line, borderRadius: 12, backgroundColor: t.surface, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
            <Text style={{ color: t.ink, fontWeight: "600", fontSize: 16.8 }}>{num(nAll) + (nAll === 1 ? " immagine salvata" : " immagini salvate")}</Text>
            {nAll ? <Text style={{ color: t.ink2, fontSize: 13.6 }}>{"circa " + mb(w)}</Text> : null}
          </View>
          <Text style={{ color: t.ink2, fontSize: 13.1, marginTop: 4 }}>{num(nF) + " carte grandi · " + num(nT) + " miniature · " + num(nO) + " confezioni e loghi"}</Text>
          {pScope && (running || pDone) ? (
            <View style={{ marginTop: 12 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
                <Text style={{ color: t.ink, fontWeight: "600", fontSize: 14.1 }}>{(running ? "Scaricamento · " : OFF.done[pScope] ? "Completato · " : "In pausa · ") + label(pScope)}</Text>
                <Text style={{ color: t.ink2, fontSize: 14.1, fontVariant: ["tabular-nums"] }}>{pTot ? Math.floor((pDone / pTot) * 100) + "%" : ""}</Text>
              </View>
              <Progress h={pDone} n={pTot} style={{ marginTop: 8 }} />
            </View>
          ) : null}
          {running ? <Btn label="Metti in pausa" onPress={pause} style={{ alignSelf: "flex-start", marginTop: 12 }} /> : null}
          {paused ? <Btn label="Riprendi" pri onPress={() => go(paused)} style={{ alignSelf: "flex-start", marginTop: 12 }} /> : null}
        </View>

        <Text style={{ color: t.ink2, fontFamily: DISPLAY, fontWeight: "600", fontSize: 11.5, letterSpacing: 1.85, textTransform: "uppercase", marginTop: 22, marginBottom: 10 }}>Cosa scaricare</Text>
        {(
          [
            ["t", "Solo miniature", "Ogni carta compare subito in piccolo, anche offline; quella nitida arriva quando c'è internet."],
            ["hd", "Tutto in HD", "Carte grandi, miniature, banner e confezioni: l'app non scarica più nessuna immagine."],
          ] as [string, string, string][]
        ).map(([sc, title, text]) => {
          const n = items(sc).length,
            p = progressOf(sc),
            all = !!OFF.done[sc],
            cur = RUN.scope === sc || !!OFF.pos[sc] || all;
          return (
            <View key={sc} style={{ borderWidth: 1, borderColor: cur ? t.accent : t.line, borderRadius: 12, backgroundColor: t.surface, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 10, boxShadow: cur ? `inset 0 0 0 1px ${t.accent}` : undefined }}>
              <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                <Text style={{ color: t.ink, fontWeight: "600", fontSize: 16 }}>{title}</Text>
                <Text style={{ color: t.ink2, fontSize: 13.6 }}>{"circa " + mb(weight(sc))}</Text>
              </View>
              <Text style={{ color: t.ink2, fontSize: 14.1, lineHeight: 21, marginTop: 6, marginBottom: 12 }}>{text}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <Text style={{ color: all ? t.ok : t.ink2, fontWeight: all ? "600" : "400", fontSize: 13.1 }}>{all ? "✓ Tutte salvate" : num(p) + " di " + num(n) + " salvate"}</Text>
                <Btn label={all ? "Scelta attuale" : running && RUN.scope === sc ? "In corso…" : "Scarica"} pri={!all} onPress={() => !running && !all && go(sc)} />
              </View>
            </View>
          );
        })}

        <Text style={{ color: t.ink2, fontFamily: DISPLAY, fontWeight: "600", fontSize: 11.5, letterSpacing: 1.85, textTransform: "uppercase", marginTop: 22, marginBottom: 10 }}>Per prodotto</Text>
        <Text style={{ color: t.ink2, fontSize: 14.7, lineHeight: 23, marginTop: -4, marginBottom: 14 }}>Solo i prodotti che ti interessano, in HD.</Text>
        <View style={{ borderWidth: 1, borderColor: t.line, borderRadius: 12, backgroundColor: t.surface, paddingVertical: 4 }}>
          {sets.map((x, i) => {
            const n = items(x.id).length,
              p = progressOf(x.id),
              all = !!OFF.done[x.id],
              me = running && RUN.scope === x.id;
            return (
              <View key={x.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52, paddingLeft: 16, paddingRight: 8, borderTopWidth: i ? 1 : 0, borderColor: t.line }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: t.ink, fontWeight: "600", fontSize: 14.4, lineHeight: 19 }}>{x.code}</Text>
                  <Text style={{ color: t.ink2, fontSize: 12.8, lineHeight: 17 }} numberOfLines={1}>
                    {x.name}
                  </Text>
                </View>
                <Text style={{ color: all ? t.ok : t.ink2, fontWeight: all ? "600" : "400", fontSize: 12.8, fontVariant: ["tabular-nums"], paddingRight: all ? 8 : 0 }}>{me ? Math.floor((p / Math.max(1, n)) * 100) + "%" : all ? "✓ Salvato" : p ? Math.floor((p / n) * 100) + "% · " + mb(weight(x.id)) : mb(weight(x.id))}</Text>
                {!all ? <SmallBtn icon={ICO_DL} color={t.accent} disabled={running} label={"Scarica " + x.code} onPress={() => go(x.id)} /> : null}
              </View>
            );
          })}
        </View>
        <Pressable onPress={() => setDel(true)} disabled={running} style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 18, minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: t.dark ? "#6e3a44" : "#e6a3a1", backgroundColor: t.surface, opacity: running ? 0.5 : 1 }}>
          <Svg width={20} height={20} viewBox="0 0 24 24">
            <Path d={ICO_TRASH} stroke={t.cards.Red} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </Svg>
          <Text style={{ color: t.cards.Red, fontWeight: "600", fontSize: 14.7 }}>Elimina tutte le immagini salvate</Text>
        </Pressable>
      </ScrollView>
      <ConfirmBox visible={!!ask} title={["Scaricare circa " + (ask ? mb(weight(ask)) : "") + "?"]} text="Sei connesso con i dati mobili: ti consigliamo di usare il Wi-Fi." ok="Scarica" onClose={() => setAsk(null)} onOk={() => ask && start(ask)} />
      <ConfirmBox visible={del} title={["Eliminare tutte le immagini salvate?"]} text="Miniature, carte grandi, banner e confezioni verranno riscaricati da internet quando li guardi." ok="Elimina" onClose={() => setDel(false)} onOk={() => clearAll()} />
    </Screen>
  );
}
