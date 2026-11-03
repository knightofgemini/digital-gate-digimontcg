// Pezzi del Deckbuilding usati in più pagine (elenco dei mazzi ed editor), come nell'app attuale:
// etichetta di stato (.dbadge), riquadro per incollare una lista (.dimport), nota sulle regole e la lista ban (.dnote).
import { useState } from "react";
import { Linking, Modal, Platform, Pressable, View } from "react-native";
import { DISPLAY, Text, TextInput } from "./Text";
import { banNote, banSource, parseDeck } from "./decks";
import { useTheme } from "./theme";
import { toast } from "./toast";

export const BADGE: Record<string, string> = { ok: "", inc: "#d9661f", bad: "#c8102e" };

// etichetta di stato del mazzo (.dbadge)
export function DBadge({ k, label }: { k: string; label: string }) {
  const t = useTheme();
  return (
    <View style={{ alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: k === "ok" ? t.ok : BADGE[k] }}>
      <Text style={{ color: k === "ok" ? "#06210f" : "#fff", fontFamily: DISPLAY, fontWeight: "700", fontSize: 11.2, letterSpacing: 0.45 }}>{label}</Text>
    </View>
  );
}

// riquadro per incollare una lista (.dimport)
export function ImportPanel({ label, onDone, onClose }: { label: string; onDone: (cards: Record<string, number>) => void; onClose: () => void }) {
  const t = useTheme();
  const [txt, setTxt] = useState("");
  return (
    <View style={{ gap: 8, marginBottom: 10 }}>
      <TextInput
        autoFocus
        value={txt}
        onChangeText={setTxt}
        multiline
        placeholder={"Incolla qui la lista, una carta per riga, es.\n4 Agumon BT1-010\n4 BT14-002"}
        placeholderTextColor={t.ink2}
        style={{ height: 8 * 19 + 22, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: t.line, backgroundColor: t.surface, color: t.ink, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", fontSize: 13.6, lineHeight: 19, textAlignVertical: "top" }}
      />
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <Pressable
          onPress={() => {
            const r = parseDeck(txt);
            if (!Object.keys(r.cards).length) return toast("Nessun codice carta riconosciuto.");
            onDone(r.cards);
            if (r.unknown.length) toast("Codici non riconosciuti: " + r.unknown.slice(0, 5).join(", ") + (r.unknown.length > 5 ? "…" : ""));
          }}
          style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: t.accent, backgroundColor: t.accent }}
        >
          <Text style={{ color: t.accentInk, fontWeight: "600", fontSize: 13.6, lineHeight: 18 }}>{label}</Text>
        </Pressable>
        <Pressable onPress={onClose} style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: t.line, backgroundColor: t.surface }}>
          <Text style={{ color: t.ink, fontWeight: "600", fontSize: 13.6, lineHeight: 18 }}>Chiudi</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function BanNote({ top = 18 }: { top?: number }) {
  const t = useTheme();
  return (
    <Text style={{ color: t.ink2, fontSize: 12.8, marginTop: top }}>
      {banNote() + " "}
      <Text style={{ color: t.blue, textDecorationLine: "underline" }} onPress={() => Linking.openURL(banSource())}>
        Fonte ufficiale
      </Text>
    </Text>
  );
}


// finestra di conferma sottile al centro (askConfirm dell'app attuale): domanda in arancione con il nome tra virgolette,
// frase che inizia con "Attenzione:", "Annulla" e il pulsante rosso. Si chiude con Annulla, tocco fuori o indietro.
export function ConfirmBox({ visible, title, text, ok, onOk, onClose }: { visible: boolean; title: string[]; text: string; ok: string; onOk: () => void; onClose: () => void }) {
  const t = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(6,10,20,.5)", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Pressable onPress={() => {}} accessibilityRole="alert" style={{ width: "100%", maxWidth: 320, backgroundColor: t.surface, borderWidth: 1, borderColor: t.line, borderRadius: 16, paddingTop: 16, paddingHorizontal: 16, paddingBottom: 14, boxShadow: "0 16px 44px rgba(0,0,0,.35)" }}>
          <Text style={{ color: t.accent, fontFamily: DISPLAY, fontWeight: "700", fontSize: 16.3, lineHeight: 21, marginBottom: 4 }}>{title.map((x, i) => (i % 2 ? "“" + x + "”" : x)).join("")}</Text>
          <Text style={{ color: t.ink2, fontSize: 13.8, lineHeight: 20 }}>
            <Text style={{ color: t.accent, fontWeight: "700" }}>Attenzione:</Text> {text}
          </Text>
          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
            <Pressable onPress={onClose} style={{ minHeight: 38, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: t.line, justifyContent: "center" }}>
              <Text style={{ color: t.ink, fontFamily: DISPLAY, fontWeight: "600", fontSize: 14.4 }}>Annulla</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                onClose();
                onOk();
              }}
              style={{ minHeight: 38, paddingHorizontal: 14, borderRadius: 10, backgroundColor: "#d4373a", justifyContent: "center" }}
            >
              <Text style={{ color: "#fff", fontFamily: DISPLAY, fontWeight: "600", fontSize: 14.4 }}>{ok}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
