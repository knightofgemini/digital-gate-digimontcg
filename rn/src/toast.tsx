// Avviso breve in basso (come toast() dell'app attuale), es. "Massimo 4 copie per Agumon."
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useTheme } from "./theme";

let show: ((m: string) => void) | null = null;
export function toast(msg: string) {
  show && show(msg);
}
export function ToastHost() {
  const t = useTheme();
  const [msg, setMsg] = useState("");
  useEffect(() => {
    let tm: any;
    show = (m) => {
      setMsg(m);
      clearTimeout(tm);
      tm = setTimeout(() => setMsg(""), 2600);
    };
    return () => {
      show = null;
      clearTimeout(tm);
    };
  }, []);
  if (!msg) return null;
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 16, right: 16, bottom: 90, alignItems: "center" }}>
      <View style={{ backgroundColor: t.ink, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, maxWidth: 520 }}>
        <Text style={{ color: t.bg, fontWeight: "600", textAlign: "center" }}>{msg}</Text>
      </View>
    </View>
  );
}
