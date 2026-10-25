// Foglio "Salva in…": preferite, liste personali e avviso di prezzo per una versione della carta (come nell'app attuale).
import { useState } from "react";
import { Modal, Pressable, ScrollView, Switch, View } from "react-native";
import { Text, TextInput } from "./Text";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card, SETBY, hostSet, verLabel } from "./data";
import { Heart, ListsIcon } from "./items";
import { bestVal, cmVal, ctVal, eurN } from "./prices";
import { S, favCount, favSet, isFav, listNew, listToggle, setAlert, useStore } from "./store";
import { useTheme } from "./theme";

export function FavSheet({ c, onClose }: { c: Card | null; onClose: () => void }) {
  const t = useTheme();
  useStore();
  const [nw, setNw] = useState<string | null>(null);
  const [eurTxt, setEurTxt] = useState<string | null>(null);
  if (!c) return null;
  const vk = SETBY[hostSet(c)];
  const alertOn = S.fav.a[c.k] != null;

  const Row = ({ name, sub, on, fav, onT }: { name: string; sub: string; on: boolean; fav?: boolean; onT: (v: boolean) => void }) => (
    <Pressable onPress={() => onT(!on)} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderColor: t.line }}>
      {fav ? <Heart on size={22} color={t.ink2} /> : <ListsIcon color={t.ink2} />}
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.ink, fontWeight: "700" }}>{name}</Text>
        <Text style={{ color: t.ink2, fontSize: 12 }}>{sub}</Text>
      </View>
      <View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: on ? t.accent : t.line, backgroundColor: on ? t.accent : "transparent", alignItems: "center", justifyContent: "center" }}>
        {on && <Text style={{ color: t.accentInk, fontWeight: "900" }}>✓</Text>}
      </View>
    </Pressable>
  );

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,.55)" }} onPress={onClose} />
      <SafeAreaView edges={["bottom"]} style={{ backgroundColor: t.bg, borderTopLeftRadius: 18, borderTopRightRadius: 18, maxHeight: "86%" }}>
        <View style={{ alignItems: "center", paddingTop: 8 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: t.line }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          <Text style={{ color: t.ink, fontSize: 20, fontWeight: "800" }}>Salva in…</Text>
          <Text style={{ color: t.ink2, marginBottom: 8 }}>{c.name + " · " + c.code + (c.suf ? " · " + (verLabel(c.ver) || "Alternative Art") : "") + (vk ? " · " + vk.code : "")}</Text>
          <Row name="Preferite" sub={favCount() + (favCount() === 1 ? " carta" : " carte")} on={isFav(c)} fav onT={(v) => favSet(c, v)} />
          {S.fav.l.map((L) => {
            const n = Object.keys(L.k).length;
            return <Row key={L.id} name={L.n} sub={n + (n === 1 ? " carta" : " carte")} on={!!L.k[c.k]} onT={(v) => listToggle(L, c, v)} />;
          })}
          {nw != null ? (
            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              <TextInput
                autoFocus
                value={nw}
                onChangeText={setNw}
                placeholder="Nome della lista"
                placeholderTextColor={t.ink2}
                maxLength={40}
                onSubmitEditing={() => {
                  if (nw.trim()) listNew(nw.trim(), c);
                  setNw(null);
                }}
                style={{ flex: 1, backgroundColor: t.surface, borderColor: t.line, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, color: t.ink }}
              />
              <Pressable
                onPress={() => {
                  if (nw.trim()) listNew(nw.trim(), c);
                  setNw(null);
                }}
                style={{ backgroundColor: t.accent, borderRadius: 10, paddingHorizontal: 14, justifyContent: "center" }}
              >
                <Text style={{ color: t.accentInk, fontWeight: "800" }}>Crea</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={() => setNw("")} style={{ marginTop: 10 }}>
              <Text style={{ color: t.accent, fontWeight: "700" }}>+ Nuova lista</Text>
            </Pressable>
          )}

          {/* avviso di prezzo: segnalato nella Wishlist quando il prezzo più basso scende sotto la soglia */}
          <View style={{ marginTop: 18, backgroundColor: t.surface, borderColor: t.line, borderWidth: 1, borderRadius: 12, padding: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.ink, fontWeight: "700" }}>Avviso di prezzo</Text>
                <Text style={{ color: t.ink2, fontSize: 12 }}>Segnalato nella Wishlist quando il prezzo più basso scende sotto la soglia</Text>
              </View>
              <Switch
                value={alertOn}
                onValueChange={(v) => {
                  if (!v) setAlert(c, null);
                  else {
                    const b0 = bestVal(c);
                    setAlert(c, b0 != null ? Math.max(0.01, Math.floor(b0 * 0.9 * 100) / 100) : 1);
                  }
                  setEurTxt(null);
                }}
                trackColor={{ true: t.accent, false: t.line }}
              />
            </View>
            {alertOn && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 }}>
                <Text style={{ color: t.ink, fontWeight: "700", fontSize: 16 }}>€</Text>
                <TextInput
                  value={eurTxt != null ? eurTxt : eurN(S.fav.a[c.k])}
                  onChangeText={setEurTxt}
                  keyboardType="decimal-pad"
                  onEndEditing={() => {
                    const v = parseFloat(String(eurTxt || "").replace(/\./g, "").replace(",", "."));
                    if (v > 0) setAlert(c, v);
                    setEurTxt(null);
                  }}
                  style={{ minWidth: 90, color: t.ink, fontWeight: "800", fontSize: 16, borderBottomWidth: 2, borderColor: t.accent, paddingVertical: 2 }}
                />
              </View>
            )}
            {(
              [
                ["Cardmarket", cmVal(c)],
                ["CardTrader", ctVal(c)],
              ] as [string, number | null][]
            ).map(([n, v]) => (
              <View key={n} style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
                <Text style={{ color: t.ink2 }}>{n}</Text>
                <Text style={{ color: t.ink, fontWeight: "700" }}>{v == null ? "N/D" : eurN(v) + " €"}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
        <Pressable onPress={onClose} style={{ margin: 16, marginTop: 4, backgroundColor: t.accent, borderRadius: 12, paddingVertical: 14, alignItems: "center" }}>
          <Text style={{ color: t.accentInk, fontWeight: "800", fontSize: 16 }}>Fine</Text>
        </Pressable>
      </SafeAreaView>
    </Modal>
  );
}
