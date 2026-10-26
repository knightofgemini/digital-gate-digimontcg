// Backup di collezione, preferite e mazzi: esporta (copia o condividi il testo) e importa (incolla il testo, unendo o
// sostituendo). Lo stesso testo di "Copia backup" dell'app attuale (Informazioni → Backup dei tuoi dati).
import { useState } from "react";
import { Pressable, ScrollView, Share, View } from "react-native";
import { Sheet } from "./Sheet";
import { Text, TextInput } from "./Text";
import * as Clipboard from "expo-clipboard";
import { SafeAreaView } from "react-native-safe-area-context";
import { exportText, importText } from "./store";
import { useTheme } from "./theme";

// ---- Backup: esporta (copia o condividi il testo) e importa (incolla il testo, unendo o sostituendo)
export function Backup({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const [txt, setTxt] = useState("");
  const [msg, setMsg] = useState("");
  const [confirm, setConfirm] = useState(false);
  function done(r: { ok: boolean; msg: string }) {
    setMsg(r.msg);
    if (r.ok) setTxt("");
    setConfirm(false);
  }
  return (
    <Sheet visible={visible} onClose={onClose} maxH={0.90} scrim="rgba(0,0,0,.55)">
      <SafeAreaView edges={["bottom"]} style={{ backgroundColor: t.bg, borderTopLeftRadius: 18, borderTopRightRadius: 18, flexShrink: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
          <Text style={{ color: t.ink, fontSize: 20, fontWeight: "800" }}>Backup</Text>
          <Text style={{ color: t.ink2, marginTop: 4, lineHeight: 20 }}>Collezione, preferite, liste e mazzi in un testo da conservare o da incollare su un altro telefono (anche dall'app attuale di Digital Gate).</Text>

          <Text style={{ color: t.accent, fontWeight: "800", marginTop: 16 }}>Esporta</Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            <Pressable
              onPress={async () => {
                await Clipboard.setStringAsync(exportText());
                setMsg("Backup copiato: incollalo dove vuoi conservarlo.");
              }}
              style={{ flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 10, backgroundColor: t.accent }}
            >
              <Text style={{ color: t.accentInk, fontWeight: "800" }}>Copia</Text>
            </Pressable>
            <Pressable onPress={() => Share.share({ message: exportText(), title: "Backup Digital Gate" }).catch(() => {})} style={{ flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 10, backgroundColor: t.surface2 }}>
              <Text style={{ color: t.ink, fontWeight: "800" }}>Condividi</Text>
            </Pressable>
          </View>

          <Text style={{ color: t.accent, fontWeight: "800", marginTop: 20 }}>Importa</Text>
          <TextInput
            value={txt}
            onChangeText={(v) => {
              setTxt(v);
              setMsg("");
              setConfirm(false);
            }}
            placeholder="Incolla qui il testo del backup"
            placeholderTextColor={t.ink2}
            multiline
            style={{ marginTop: 8, minHeight: 90, maxHeight: 160, backgroundColor: t.surface, borderColor: t.line, borderWidth: 1, borderRadius: 10, padding: 10, color: t.ink, textAlignVertical: "top" }}
          />
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            <Pressable
              onPress={async () => {
                const v = await Clipboard.getStringAsync();
                if (v) setTxt(v);
              }}
              style={{ alignItems: "center", paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, backgroundColor: t.surface2 }}
            >
              <Text style={{ color: t.ink, fontWeight: "700" }}>Incolla</Text>
            </Pressable>
            <Pressable disabled={!txt.trim()} onPress={() => done(importText(txt, false))} style={{ flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 10, backgroundColor: t.accent, opacity: txt.trim() ? 1 : 0.4 }}>
              <Text style={{ color: t.accentInk, fontWeight: "800" }}>Unisci</Text>
            </Pressable>
            <Pressable
              disabled={!txt.trim()}
              onPress={() => (confirm ? done(importText(txt, true)) : setConfirm(true))}
              style={{ flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 10, backgroundColor: confirm ? "#c0261e" : t.surface2, opacity: txt.trim() ? 1 : 0.4 }}
            >
              <Text style={{ color: confirm ? "#fff" : t.ink, fontWeight: "800" }}>{confirm ? "Sicuro?" : "Sostituisci"}</Text>
            </Pressable>
          </View>
          <Text style={{ color: t.ink2, fontSize: 12, marginTop: 6, lineHeight: 17 }}>Unisci aggiunge i dati a quelli che hai (per ogni carta tiene il numero di copie più alto). Sostituisci cancella i dati di questo telefono e mette quelli del backup.</Text>
          {!!msg && <Text style={{ color: t.ink, fontWeight: "700", marginTop: 10 }}>{msg}</Text>}
        </ScrollView>
        <Pressable onPress={onClose} style={{ margin: 16, marginTop: 4, backgroundColor: t.surface2, borderRadius: 12, paddingVertical: 14, alignItems: "center" }}>
          <Text style={{ color: t.ink, fontWeight: "800", fontSize: 16 }}>Chiudi</Text>
        </Pressable>
      </SafeAreaView>
    </Sheet>
  );
}
