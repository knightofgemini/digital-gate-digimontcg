// Foglio "Salva in…": preferite, liste personali e avviso di prezzo per una versione della carta (come nell'app attuale).
import { useRef, useState } from "react";
import { Pressable, ScrollView, Switch, View } from "react-native";
import { Sheet } from "./Sheet";
import { DISPLAY, Text, TextInput } from "./Text";
import Svg, { Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CmMark, CtMark } from "./shops";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card, SETBY, hostSet, verLabel } from "./data";
import { Heart, ListsIcon } from "./items";
import { bestVal, cmVal, ctVal, eurN } from "./prices";
import { S, favCount, favSet, isFav, listNew, listToggle, setAlert, useStore } from "./store";
import { useTheme } from "./theme";
import { favSheetRef } from "./toast";

// foglio aperto da "Liste e avviso" dell'avviso in basso, in qualunque pagina
export function FavSheetHost() {
  const [c, setC] = useState<Card | null>(null);
  favSheetRef.open = setC;
  return <FavSheet c={c} onClose={() => setC(null)} />;
}

export function FavSheet({ c: cOpen, onClose }: { c: Card | null; onClose: () => void }) {
  // l'ultima carta resta disegnata mentre il foglio scende in chiusura
  const last = useRef<Card | null>(null);
  if (cOpen) last.current = cOpen;
  const c = cOpen || last.current;
  const t = useTheme();
  useStore();
  const [nw, setNw] = useState<string | null>(null);
  const [eurTxt, setEurTxt] = useState<string | null>(null);
  const insB = useSafeAreaInsets().bottom;
  if (!c) return null;
  const vk = SETBY[hostSet(c)];
  const alertOn = S.fav.a[c.k] != null;

  // riga di una lista (.fsrow2): icona nel riquadretto (cuore arancione per le Preferite), nome e numero di carte, casella
  const Row = ({ name, sub, on, fav, onT }: { name: string; sub: string; on: boolean; fav?: boolean; onT: (v: boolean) => void }) => (
    <Pressable onPress={() => onT(!on)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, paddingHorizontal: 14, borderBottomWidth: 1, borderColor: t.line }}>
      <View style={{ width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: fav ? t.accentSoft : t.surface2 }}>{fav ? <Heart on size={17} color={t.accent} /> : <ListsIcon color={t.cyan} size={17} />}</View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: t.ink, fontWeight: "600", fontSize: 15.2, lineHeight: 20 }}>{name}</Text>
        <Text style={{ color: t.ink2, fontSize: 12.5, lineHeight: 16 }}>{sub}</Text>
      </View>
      <View style={{ width: 22, height: 22, borderRadius: 5, borderWidth: on ? 0 : 1.5, borderColor: t.ink2, backgroundColor: on ? t.accent : t.surface2, alignItems: "center", justifyContent: "center" }}>
        {on ? (
          <Svg width={12} height={10} viewBox="0 0 12 10">
            <Path d="M1 5l3.5 3.5L11 1.5" stroke={t.accentInk} strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        ) : null}
      </View>
    </Pressable>
  );
  const create = () => {
    if ((nw || "").trim()) listNew(nw!.trim(), c);
    setNw(null);
  };
  const on = alertOn;

  return (
    <Sheet visible={!!cOpen} onClose={onClose} maxH={0.88} scrim="rgba(4,8,18,.6)" style={{ backgroundColor: t.surface, borderTopWidth: 1, borderColor: t.line, borderTopLeftRadius: 22, borderTopRightRadius: 22, boxShadow: "0 -12px 32px rgba(0,0,0,.35)" }}>
        <ScrollView contentContainerStyle={{ paddingTop: 8, paddingHorizontal: 16, paddingBottom: 18 + insB, gap: 12 }} keyboardShouldPersistTaps="handled">
          <View style={{ alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: t.line }} />
          <View>
            <Text style={{ color: t.ink, fontFamily: DISPLAY, fontWeight: "700", fontSize: 19.2 }}>Salva in…</Text>
            <Text style={{ color: t.ink2, fontSize: 12.8, marginTop: 2 }}>{c.name + " · " + c.code + (c.suf ? " · " + (verLabel(c.ver) || "Alternative Art") : "") + (vk ? " · " + vk.code : "")}</Text>
          </View>
          <View style={{ borderWidth: 1, borderColor: t.line, borderRadius: 14, overflow: "hidden" }}>
            <Row name="Preferite" sub={favCount() + (favCount() === 1 ? " carta" : " carte")} on={isFav(c)} fav onT={(v) => favSet(c, v)} />
            {S.fav.l.map((L) => {
              const n = Object.keys(L.k).length;
              return <Row key={L.id} name={L.n} sub={n + (n === 1 ? " carta" : " carte")} on={!!L.k[c.k]} onT={(v) => listToggle(L, c, v)} />;
            })}
            {nw != null ? (
              <View style={{ flexDirection: "row", gap: 6, alignItems: "center", paddingVertical: 8, paddingHorizontal: 14 }}>
                <TextInput autoFocus value={nw} onChangeText={setNw} placeholder="Nome della lista" placeholderTextColor={t.ink2} maxLength={40} onSubmitEditing={create} style={{ flex: 1, minHeight: 36, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: t.accent, backgroundColor: t.surface, color: t.ink, fontWeight: "500", fontSize: 14.4 }} />
                <Pressable onPress={create} style={{ minHeight: 36, paddingHorizontal: 14, justifyContent: "center", borderRadius: 999, backgroundColor: t.accent }}>
                  <Text style={{ color: t.accentInk, fontWeight: "600", fontSize: 13.6 }}>Crea</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={() => setNw("")} style={{ minHeight: 48, justifyContent: "center", paddingHorizontal: 14 }}>
                <Text style={{ color: t.accent, fontWeight: "600", fontSize: 14.4 }}>+ Nuova lista</Text>
              </Pressable>
            )}
          </View>

          {/* avviso di prezzo (.fsalert): segnalato nella Wishlist quando il prezzo più basso scende sotto la soglia */}
          <View style={{ gap: 10, borderWidth: 1, borderColor: t.line, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: t.ink, fontWeight: "600", fontSize: 15.2, lineHeight: 20 }}>Avviso di prezzo</Text>
                <Text style={{ color: t.ink2, fontSize: 12.5, lineHeight: 17 }}>Segnalato nella Wishlist quando il prezzo più basso scende sotto la soglia</Text>
              </View>
              <Pressable
                accessibilityRole="switch"
                accessibilityState={{ checked: on }}
                accessibilityLabel="Avviso di prezzo"
                onPress={() => {
                  if (on) setAlert(c, null);
                  else {
                    const b0 = bestVal(c);
                    setAlert(c, b0 != null ? Math.max(0.01, Math.floor(b0 * 0.9 * 100) / 100) : 1);
                  }
                  setEurTxt(null);
                }}
                style={{ width: 50, height: 30, borderRadius: 999, backgroundColor: on ? t.accent : t.surface2, borderWidth: on ? 0 : 1, borderColor: t.line }}
              >
                <View style={{ position: "absolute", left: on ? 23 : 3, top: on ? 3 : 2, width: 24, height: 24, borderRadius: 12, backgroundColor: on ? t.accentInk : t.ink2 }} />
              </Pressable>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              {on ? (
                <View style={{ width: 128, height: 44, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: t.line, backgroundColor: t.bg }}>
                  <Text style={{ color: t.ink2 }}>€</Text>
                  <TextInput
                    value={eurTxt != null ? eurTxt : eurN(S.fav.a[c.k])}
                    onChangeText={setEurTxt}
                    keyboardType="decimal-pad"
                    accessibilityLabel="Soglia di prezzo in euro"
                    onEndEditing={() => {
                      const v = parseFloat(String(eurTxt || "").replace(/\./g, "").replace(",", "."));
                      if (v > 0) setAlert(c, Math.round(v * 100) / 100);
                      setEurTxt(null);
                    }}
                    style={{ flex: 1, minWidth: 0, color: t.ink, fontWeight: "600", fontSize: 16 }}
                  />
                </View>
              ) : null}
              <View style={{ flex: 1, gap: 4 }}>
                {(
                  [
                    ["cm", "Cardmarket", cmVal(c)],
                    ["ct", "CardTrader", ctVal(c)],
                  ] as [string, string, number | null][]
                ).map(([k, n, v]) => (
                  <View key={n} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    {k === "cm" ? <CmMark size={13} /> : <CtMark size={13} />}
                    <Text style={{ color: t.ink2, fontSize: 12.8 }}>{n}</Text>
                    <Text style={{ marginLeft: "auto", color: t.ink, fontWeight: "600", fontSize: 12.8 }}>{v == null ? "N/D" : eurN(v) + " €"}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
          <Pressable onPress={onClose} style={{ minHeight: 50, borderRadius: 14, backgroundColor: t.accent, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: t.accentInk, fontWeight: "600", fontSize: 16 }}>Fine</Text>
          </Pressable>
        </ScrollView>
    </Sheet>
  );
}
