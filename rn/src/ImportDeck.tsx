// Importazione di un mazzo da una lista di testo (stesso formato dell'esportazione e dei siti di mazzi).
import { useState } from "react";
import { Modal, Pressable, View } from "react-native";
import { Text, TextInput } from "./Text";
import { SafeAreaView } from "react-native-safe-area-context";
import { parseDeck } from "./decks";
import { useTheme } from "./theme";
import { toast } from "./toast";

// incolla una lista (una carta per riga, es. "4 Agumon BT1-010" o "4 BT14-002")
export function ImportDeck({ visible, label, onClose, onDone }: { visible: boolean; label: string; onClose: () => void; onDone: (cards: Record<string, number>) => void }) {
  const t = useTheme();
  const [txt, setTxt] = useState("");
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,.55)" }} onPress={onClose} />
      <SafeAreaView edges={["bottom"]} style={{ backgroundColor: t.bg, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, maxHeight: "85%" }}>
        <Text style={{ color: t.ink, fontSize: 20, fontWeight: "800" }}>Importa una lista</Text>
        <TextInput
          value={txt}
          onChangeText={setTxt}
          multiline
          placeholder={"Incolla qui la lista, una carta per riga, es.\n4 Agumon BT1-010\n4 BT14-002"}
          placeholderTextColor={t.ink2}
          style={{ marginTop: 10, height: 170, backgroundColor: t.surface, borderColor: t.line, borderWidth: 1, borderRadius: 10, padding: 10, color: t.ink, textAlignVertical: "top" }}
        />
        <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
          <Pressable
            onPress={() => {
              const r = parseDeck(txt);
              if (!Object.keys(r.cards).length) {
                toast("Nessun codice carta riconosciuto.");
                return;
              }
              onDone(r.cards);
              setTxt("");
              if (r.unknown.length) toast("Codici non riconosciuti: " + r.unknown.slice(0, 5).join(", ") + (r.unknown.length > 5 ? "…" : ""));
            }}
            style={{ flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 10, backgroundColor: t.accent }}
          >
            <Text style={{ color: t.accentInk, fontWeight: "800" }}>{label}</Text>
          </Pressable>
          <Pressable onPress={onClose} style={{ flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 10, backgroundColor: t.surface2 }}>
            <Text style={{ color: t.ink, fontWeight: "800" }}>Chiudi</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
