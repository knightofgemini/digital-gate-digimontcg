// Pagina "Immagini offline": miniature, tutto in HD o un prodotto alla volta, con dimensione stimata, avanzamento,
// pausa/ripresa e svuotamento della memoria delle immagini.
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import * as Network from "expo-network";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { SETS, TYPES, cardsOfSet, soonSet } from "../data";
import { OFF, RUN, clearAll, items, label, mb, pause, progressOf, start, useOffline, weight } from "../offline";
import { useTheme } from "../theme";
import { Logo, PageTitle, common } from "../ui";

export default function Offline() {
  const t = useTheme();
  const s = common(t);
  useOffline();
  const [cell, setCell] = useState(false);
  const [cfm, setCfm] = useState(false);
  const [showSets, setShowSets] = useState(false);
  useEffect(() => {
    Network.getNetworkStateAsync()
      .then((n) => setCell(n.type === Network.NetworkStateType.CELLULAR))
      .catch(() => {});
  }, []);

  const Choice = ({ scope, title, text }: { scope: string; title: string; text: string }) => {
    const n = items(scope).length,
      p = progressOf(scope),
      done = !!OFF.done[scope],
      on = RUN.running && RUN.scope === scope;
    const pc = n ? Math.floor((p / n) * 100) : 0;
    return (
      <View style={[s.panel, { padding: 14, marginTop: 10 }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ color: t.ink, fontSize: 16, fontWeight: "800", flex: 1 }}>{title}</Text>
          <Text style={{ color: t.ink2 }}>{"circa " + mb(weight(scope))}</Text>
        </View>
        <Text style={{ color: t.ink2, marginTop: 4, lineHeight: 19 }}>{text}</Text>
        {(p > 0 || on) && (
          <View style={{ marginTop: 10 }}>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: t.surface2, overflow: "hidden" }}>
              <View style={{ width: pc + "%", height: 6, backgroundColor: done ? "#46bd73" : t.accent }} />
            </View>
            <Text style={{ color: t.ink2, fontSize: 12, marginTop: 4 }}>{done ? "Completato: " + n.toLocaleString("it-IT") + " immagini salvate" : p.toLocaleString("it-IT") + " di " + n.toLocaleString("it-IT") + " immagini (" + pc + "%)" + (on ? "" : " · in pausa")}</Text>
          </View>
        )}
        <Pressable
          disabled={RUN.running && !on}
          onPress={() => (on ? pause() : start(scope))}
          style={{ marginTop: 10, alignItems: "center", paddingVertical: 11, borderRadius: 10, backgroundColor: on ? t.surface2 : t.accent, opacity: RUN.running && !on ? 0.4 : 1 }}
        >
          <Text style={{ color: on ? t.ink : t.accentInk, fontWeight: "800" }}>{on ? "Pausa" : done ? "Controlla di nuovo" : p ? "Riprendi" : "Scarica"}</Text>
        </Pressable>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.screen} edges={["top"]}>
      <ScrollView contentContainerStyle={s.pad}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} hitSlop={12} style={{ marginBottom: 12 }}>
          <Text style={{ color: t.accent, fontSize: 16, fontWeight: "600" }}>‹ Indietro</Text>
        </Pressable>
        <PageTitle>Immagini offline</PageTitle>
        <Text style={{ color: t.ink2, lineHeight: 20 }}>Scarica in anticipo le immagini delle carte per vederle anche senza internet e senza attese. Le immagini che guardi restano comunque salvate da sole.</Text>
        {cell && <Text style={{ color: "#c77a0a", fontWeight: "700", marginTop: 8 }}>Sei sotto rete mobile: per scaricare molte immagini è meglio il Wi-Fi.</Text>}
        <Choice scope="t" title="Miniature" text="Le immagini piccole di tutte le carte (elenchi e ricerca)." />
        <Choice scope="hd" title="Tutto in HD" text="Tutte le carte in grande, le miniature, le versioni pre errata, le confezioni e i loghi dei prodotti." />

        <Pressable onPress={() => setShowSets(!showSets)} style={{ marginTop: 16 }}>
          <Text style={{ color: t.accent, fontWeight: "800" }}>{showSets ? "Nascondi i prodotti" : "Oppure un prodotto alla volta"}</Text>
        </Pressable>
        {showSets &&
          Object.keys(TYPES).map((tp) => {
            const list = SETS.filter((x) => x.type === tp && cardsOfSetLen(x.id) && !soonSet(x));
            if (!list.length) return null;
            return (
              <View key={tp}>
                <Text style={{ color: t.ink2, fontWeight: "700", marginTop: 14, marginBottom: 4 }}>{TYPES[tp]}</Text>
                {list.map((x) => {
                  const n = items(x.id).length,
                    p = progressOf(x.id),
                    on = RUN.running && RUN.scope === x.id,
                    done = !!OFF.done[x.id];
                  return (
                    <View key={x.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderColor: t.line }}>
                      <Logo code={x.code} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: t.ink, fontWeight: "700" }} numberOfLines={1}>
                          {label(x.id)}
                        </Text>
                        <Text style={{ color: done ? "#46bd73" : t.ink2, fontSize: 12 }}>{done ? "Salvato" : p ? Math.floor((p / n) * 100) + "%" + (on ? "" : " · in pausa") : "circa " + mb(weight(x.id))}</Text>
                      </View>
                      <Pressable disabled={RUN.running && !on} onPress={() => (on ? pause() : start(x.id))} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14, backgroundColor: on ? t.surface2 : done ? t.surface2 : t.accent, opacity: RUN.running && !on ? 0.4 : 1 }}>
                        <Text style={{ color: on || done ? t.ink : t.accentInk, fontWeight: "800", fontSize: 13 }}>{on ? "Pausa" : done ? "Aggiorna" : p ? "Riprendi" : "Scarica"}</Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            );
          })}

        <View style={[s.panel, { padding: 14, marginTop: 18 }]}>
          <Text style={{ color: t.ink, fontWeight: "800" }}>Libera spazio</Text>
          <Text style={{ color: t.ink2, marginTop: 4, lineHeight: 19 }}>Cancella tutte le immagini salvate nel telefono. Si riscaricheranno quando le guardi.</Text>
          <Pressable
            onPress={() => {
              if (!cfm) return setCfm(true);
              clearAll();
              setCfm(false);
            }}
            style={{ marginTop: 10, alignItems: "center", paddingVertical: 11, borderRadius: 10, backgroundColor: cfm ? "#c0261e" : t.surface2 }}
          >
            <Text style={{ color: cfm ? "#fff" : "#e5484d", fontWeight: "800" }}>{cfm ? "Sicuro? Cancella le immagini" : "Cancella le immagini salvate"}</Text>
          </Pressable>
        </View>
        <Text style={{ color: t.ink2, fontSize: 12, marginTop: 12, lineHeight: 17 }}>Lo scaricamento continua finché l'app resta aperta, anche cambiando schermata.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const cardsOfSetLen = (id: string) => cardsOfSet(id).length;
