// Immagini offline (come renderOffline dell'app attuale sul telefono): riquadro con le immagini salvate e l'avanzamento,
// "Cosa scaricare" (Solo miniature / Tutto in HD con peso stimato, quante sono salvate, cestino del tipo e "Scarica"),
// la spunta "Scarica in sottofondo le immagini nuove e aggiornate", "Per prodotto" (codice, nome, percentuale, cestino e
// pulsante per scaricare) ed "Elimina tutte le immagini salvate". Le eliminazioni chiedono conferma; con i dati mobili
// la scelta generale chiede conferma prima di scaricare.
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { DISPLAY, Text } from "../Text";
import { SETBY, SETS, numOf } from "../data";
import { haveStats } from "../imgstore";
import { AVG, OFF, PAGE, RUN, cell, choose, count, deleteAll, deleteKind, deleteSet, items, label, mb, missing, pause, setAuto, start, useOffline } from "../offline";
import { useTheme } from "../theme";
import { PageTitle } from "../ui";
import { Screen, useBarState } from "../chrome";
import { Btn, Progress } from "../visual";
import { ConfirmBox } from "../deckui";

const ICO_TRASH = "M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6";
const ICO_DL = "M12 4v11M7 10l5 5 5-5M5 20h14";
const num = (n: number) => n.toLocaleString("it-IT");

// pulsante quadrato (.offdl): scarica (arancione) o cestino (.del, grigio)
function SmallBtn({ icon, color, onPress, disabled, label, w = 2.2 }: { icon: string; color: string; onPress: () => void; disabled?: boolean; label: string; w?: number }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityLabel={label} style={{ width: 40, height: 40, borderRadius: 11, borderWidth: 1, borderColor: t.line, backgroundColor: t.bg, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.45 : 1 }}>
      <Svg width={20} height={20} viewBox="0 0 24 24">
        <Path d={icon} stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </Svg>
    </Pressable>
  );
}
// titoletto (.offh)
function H({ children }: { children: string }) {
  const t = useTheme();
  return <Text style={{ color: t.ink2, fontFamily: DISPLAY, fontWeight: "600", fontSize: 11.5, letterSpacing: 1.85, textTransform: "uppercase", marginTop: 22, marginBottom: 10 }}>{children}</Text>;
}

type Ask = { title: string[]; text: string; ok: string; go: () => void };

export default function Offline() {
  const t = useTheme();
  const bar = useBarState();
  useOffline();
  const [ask, setAsk] = useState<Ask | null>(null);
  useEffect(() => {
    PAGE.open = true;
    return () => {
      PAGE.open = false;
    };
  }, []);
  const R = RUN,
    running = !!R && !R.end;
  const off = <T,>(v: T) => (running ? undefined : v);

  const sets = useMemo(() => SETS.filter((x) => (x.v || []).length).sort((a, b) => ((a.date || "") < (b.date || "") ? 1 : (a.date || "") > (b.date || "") ? -1 : numOf(b.code) - numOf(a.code))), []);
  const S = haveStats(AVG);
  const nAll = S.nT + S.nF + S.nO;
  const pc = R && R.total ? Math.floor((R.done / R.total) * 100) : 100;

  // scelta generale: con i dati mobili prima chiede
  const pick = async (sc: string) => {
    if (await cell()) setAsk({ title: ["Scaricare circa " + mb(items(sc).w || 0) + "?"], text: "Sei connesso con i dati mobili: ti consigliamo di usare il Wi-Fi.", ok: "Scarica", go: () => choose(sc) });
    else choose(sc);
  };

  return (
    <Screen bs={bar}>
      <ScrollView onScroll={bar.onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 4 + bar.pad, paddingBottom: 28 + 24 }}>
        <PageTitle>Immagini offline</PageTitle>
        <Text style={{ color: t.ink2, fontSize: 14.7, lineHeight: 23, marginTop: -4, marginBottom: 14 }}>Scarica le immagini nel dispositivo: compaiono subito e funzionano anche senza internet. Restano salvate anche quando aggiorni l'app. Lo scaricamento continua finché l'app resta aperta, anche se cambi schermata.</Text>

        {/* stato */}
        <View style={{ borderWidth: 1, borderColor: t.line, borderRadius: 12, backgroundColor: t.surface, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
            <Text style={{ color: t.ink, fontWeight: "600", fontSize: 16.8 }}>{num(nAll) + (nAll === 1 ? " immagine salvata" : " immagini salvate")}</Text>
            {nAll ? <Text style={{ color: t.ink2, fontSize: 13.6 }}>{"circa " + mb(S.w)}</Text> : null}
          </View>
          <Text style={{ color: t.ink2, fontSize: 13.1, marginTop: 4 }}>{num(S.nF) + " carte grandi · " + num(S.nT) + " miniature · " + num(S.nO) + " banner, confezioni e loghi"}</Text>
          {R && (R.scope === "t" || R.scope === "hd" || R.scope === "upd" || running) ? (
            <View style={{ marginTop: 12 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
                <Text style={{ flexShrink: 1, color: t.ink, fontWeight: "600", fontSize: 14.1 }}>{(running ? (R.stop ? "Pausa…" : "Scaricamento · ") : R.stop ? "In pausa · " : "Completato · ") + (running && R.stop ? "" : label(R.scope))}</Text>
                <Text style={{ color: t.ink2, fontSize: 13.6, fontVariant: ["tabular-nums"] }}>{num(R.done) + " di " + num(R.total) + " · " + pc + "%"}</Text>
              </View>
              <Progress h={R.done} n={Math.max(1, R.total)} style={{ marginTop: 8 }} />
              {R.err ? (
                <Text style={{ color: t.accent, fontSize: 13.6, lineHeight: 20, marginTop: 10 }}>{R.err}</Text>
              ) : R.wait && running ? (
                <Text style={{ color: t.ink2, fontSize: 13.6, lineHeight: 20, marginTop: 10 }}>In attesa della connessione…</Text>
              ) : R.end && !R.stop && R.fail ? (
                <Text style={{ color: t.ink2, fontSize: 13.6, lineHeight: 20, marginTop: 10 }}>{num(R.fail) + (R.fail === 1 ? " immagine non è disponibile" : " immagini non sono disponibili") + " sul sito: verranno riprovate la prossima volta."}</Text>
              ) : null}
              {running ? <Btn label="Metti in pausa" onPress={pause} style={{ alignSelf: "flex-start", marginTop: 12 }} /> : null}
            </View>
          ) : OFF.m && OFF.paused ? (
            <Text style={{ color: t.ink2, fontSize: 13.6, lineHeight: 20, marginTop: 10 }}>{"In pausa: " + (OFF.m === "t" ? "miniature" : "tutto in HD") + ", " + num(count(items(OFF.m))) + " di " + num(items(OFF.m).length) + " salvate."}</Text>
          ) : null}
          {OFF.m && OFF.paused && !running ? <Btn label="Riprendi" pri onPress={() => start(OFF.m)} style={{ alignSelf: "flex-start", marginTop: 12 }} /> : null}
        </View>

        <H>Cosa scaricare</H>
        {(
          [
            ["t", "Solo miniature", "Ogni carta compare subito in piccolo, anche offline; quella nitida arriva quando c'è internet."],
            ["hd", "Tutto in HD", "Carte grandi, miniature, banner e confezioni: l'app non scarica più nessuna immagine."],
          ] as ["t" | "hd", string, string][]
        ).map(([sc, title, text]) => {
          const L = items(sc),
            cur = OFF.m === sc,
            have = count(L),
            nm = missing(L),
            all = have + nm >= L.length;
          const nk = sc === "t" ? S.nT : S.nF + S.nO;
          const dis = running || (cur && all);
          return (
            <View key={sc} style={{ borderWidth: 1, borderColor: cur ? t.accent : t.line, borderRadius: 12, backgroundColor: t.surface, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 10, boxShadow: cur ? `inset 0 0 0 1px ${t.accent}` : undefined }}>
              <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                <Text style={{ color: t.ink, fontWeight: "600", fontSize: 16 }}>{title}</Text>
                <Text style={{ color: t.ink2, fontSize: 13.6 }}>{"circa " + mb(L.w || 0)}</Text>
              </View>
              <Text style={{ color: t.ink2, fontSize: 14.1, lineHeight: 21, marginTop: 6, marginBottom: 12 }}>
                {text + (sc === "hd" && cur && OFF.x.length ? " Esclusi i prodotti che hai eliminato (" + OFF.x.map((id) => (SETBY[id] || { code: id }).code).join(", ") + ")." : "")}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <Text style={{ flexShrink: 1, color: all ? t.ok : t.ink2, fontWeight: all ? "600" : "400", fontSize: 13.1 }}>{all ? "✓ Tutte salvate" + (nm ? " · " + nm + " non disponibili" : "") : num(have) + " di " + num(L.length) + " salvate"}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  {nk > 0 && !running ? (
                    <SmallBtn
                      icon={ICO_TRASH}
                      w={2}
                      color={t.ink2}
                      label={sc === "t" ? "Elimina tutte le miniature" : "Elimina le immagini in HD"}
                      onPress={() =>
                        setAsk(
                          sc === "t"
                            ? { title: ["Eliminare tutte le miniature?"], text: "Le miniature verranno riscaricate da internet quando le guardi.", ok: "Elimina", go: () => deleteKind("t") }
                            : { title: ["Eliminare le immagini in HD?"], text: "Carte grandi, banner e confezioni verranno riscaricati da internet quando li guardi. Le miniature restano.", ok: "Elimina", go: () => deleteKind("hd") }
                        )
                      }
                    />
                  ) : null}
                  <Btn
                    label={cur && all ? "Scelta attuale" : cur && running && R && R.scope === sc ? "In corso…" : all ? "Scegli" : "Scarica"}
                    pri={!(cur && all)}
                    onPress={() => !dis && pick(sc)}
                    style={dis ? { opacity: 0.55 } : undefined}
                  />
                </View>
              </View>
            </View>
          );
        })}

        {/* aggiornamenti automatici in sottofondo (.offauto) */}
        <Pressable onPress={() => setAuto(!OFF.auto)} accessibilityRole="checkbox" accessibilityState={{ checked: OFF.auto }} style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, borderWidth: 1, borderColor: t.line, borderRadius: 12, backgroundColor: t.surface, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 10 }}>
          <View style={{ width: 20, height: 20, marginTop: 2, borderRadius: 4, borderWidth: OFF.auto ? 0 : 1.5, borderColor: t.ink2, backgroundColor: OFF.auto ? t.accent : t.bg, alignItems: "center", justifyContent: "center" }}>
            {OFF.auto ? (
              <Svg width={14} height={14} viewBox="0 0 24 24">
                <Path d="M5 12.5l4.5 4.5L19 7" stroke={t.accentInk} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </Svg>
            ) : null}
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ color: t.ink, fontWeight: "600", fontSize: 15.2 }}>Scarica in sottofondo le immagini nuove e aggiornate</Text>
            <Text style={{ color: t.ink2, fontSize: 13.1, lineHeight: 19 }}>All'uscita di carte nuove o quando vengono aggiornate le immagini (es. le ufficiali al posto delle anteprime degli spoiler, artwork e banner aggiornati), per la scelta qui sopra e per i prodotti che hai scaricato. Con i dati mobili solo aggiornamenti piccoli (fino a 10 MB).</Text>
          </View>
        </Pressable>

        <H>Per prodotto</H>
        <Text style={{ color: t.ink2, fontSize: 14.7, lineHeight: 23, marginTop: -4, marginBottom: 14 }}>Solo i prodotti che ti interessano, in HD. Il cestino elimina le immagini di quel prodotto.</Text>
        <View style={{ borderWidth: 1, borderColor: t.line, borderRadius: 12, backgroundColor: t.surface, paddingVertical: 4 }}>
          {sets.map((x, i) => {
            const L = items(x.id),
              have = count(L),
              all = have + missing(L) >= L.length,
              me = !!R && R.scope === x.id && !R.end;
            // percentuale delle sole carte grandi (miniature, banner e confezioni possono essere già salvati)
            const Lf = L.filter((z) => z.w === AVG.f),
              hF = count(Lf),
              pHd = Math.floor((hF / Math.max(1, Lf.length)) * 100);
            return (
              <View key={x.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52, paddingLeft: 16, paddingRight: 8, borderTopWidth: i ? 1 : 0, borderColor: t.line }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: t.ink, fontWeight: "600", fontSize: 14.4, lineHeight: 19 }}>{x.code}</Text>
                  <Text style={{ color: t.ink2, fontSize: 12.8, lineHeight: 17 }} numberOfLines={1}>
                    {x.name}
                  </Text>
                </View>
                <Text style={{ color: all ? t.ok : t.ink2, fontWeight: all ? "600" : "400", fontSize: 12.8, fontVariant: ["tabular-nums"], paddingRight: all ? 8 : 0 }}>{me ? pc + "%" : all ? "✓ Salvato" : pHd >= 1 ? pHd + "% · " + mb(L.w || 0) : mb(L.w || 0)}</Text>
                {hF > 0 && !me ? (
                  <SmallBtn
                    icon={ICO_TRASH}
                    w={2}
                    color={t.ink2}
                    disabled={running}
                    label={"Elimina le immagini di " + x.code}
                    onPress={() => setAsk({ title: ["Eliminare le immagini di ", x.code, "?"], text: "Le immagini di questo prodotto verranno riscaricate da internet quando le guardi.", ok: "Elimina", go: () => deleteSet(x.id) })}
                  />
                ) : null}
                {!all ? <SmallBtn icon={ICO_DL} color={t.accent} disabled={running} label={"Scarica " + x.code} onPress={() => start(x.id)} /> : null}
              </View>
            );
          })}
        </View>
        <Pressable
          onPress={off(() => setAsk({ title: ["Eliminare tutte le immagini salvate?"], text: "Miniature, carte grandi, banner e confezioni verranno riscaricati da internet quando li guardi.", ok: "Elimina", go: deleteAll }))}
          disabled={running}
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 18, minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: t.dark ? "#6e3a44" : "#e6a3a1", backgroundColor: t.surface, opacity: running ? 0.5 : 1 }}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24">
            <Path d={ICO_TRASH} stroke={t.cards.Red} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </Svg>
          <Text style={{ color: t.cards.Red, fontWeight: "600", fontSize: 14.7 }}>Elimina tutte le immagini salvate</Text>
        </Pressable>
      </ScrollView>
      <ConfirmBox visible={!!ask} title={ask ? ask.title : [""]} text={ask ? ask.text : ""} ok={ask ? ask.ok : ""} onClose={() => setAsk(null)} onOk={() => ask && ask.go()} />
    </Screen>
  );
}
