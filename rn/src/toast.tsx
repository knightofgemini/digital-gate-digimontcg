// Avvisi brevi in basso (come toast() e favToast() dell'app attuale), es. "Massimo 4 copie per Agumon."
// Con un'azione (es. "Liste e avviso" dopo aver toccato il cuore) l'avviso ha un pulsante arancione a destra.
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "./Text";
import { Card } from "./data";
import { useTheme } from "./theme";

type Act = { label: string; onPress: () => void };
let show: ((m: string, a?: Act) => void) | null = null;
export function toast(msg: string, action?: Act) {
  show && show(msg, action);
}
// apertura del foglio "Salva in…" da qualunque pagina (registrata da FavSheetHost)
export const favSheetRef: { open: (c: Card) => void } = { open: () => {} };
export function favToast(c: Card, on: boolean) {
  toast(on ? "Aggiunta alle preferite" : "Tolta dalle preferite", on ? { label: "Liste e avviso", onPress: () => favSheetRef.open(c) } : undefined);
}
export function ToastHost() {
  const t = useTheme();
  const ins = useSafeAreaInsets();
  const [m, setM] = useState<{ msg: string; act?: Act } | null>(null);
  useEffect(() => {
    let tm: any;
    show = (msg, act) => {
      setM({ msg, act });
      clearTimeout(tm);
      tm = setTimeout(() => setM(null), 2600);
    };
    return () => {
      show = null;
      clearTimeout(tm);
    };
  }, []);
  if (!m) return null;
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: 16, right: 16, bottom: 150 + ins.bottom, alignItems: "center" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: t.ink, borderRadius: m.act ? 14 : 10, paddingVertical: 10, paddingLeft: 16, paddingRight: m.act ? 10 : 16, maxWidth: 520, boxShadow: "0 6px 24px rgba(0,0,0,.3)" }}>
        <Text style={{ color: t.bg, fontWeight: "500", fontSize: 14.1, textAlign: m.act ? "left" : "center", flexShrink: 1 }}>{m.msg}</Text>
        {m.act ? (
          <Pressable
            onPress={() => {
              setM(null);
              m.act!.onPress();
            }}
            style={{ borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: t.accent }}
          >
            <Text style={{ color: t.accentInk, fontWeight: "600", fontSize: 13.6, lineHeight: 18 }}>{m.act.label}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
