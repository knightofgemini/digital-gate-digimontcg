// Informazioni (come renderInfo dell'app attuale sul telefono): riquadro "Backup dei tuoi dati" e sezioni che si aprono.
// Nella nuova app il riquadro ha anche "Importa": serve a incollare il backup copiato dall'app attuale.
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import Svg, { Path } from "react-native-svg";
import { DISPLAY, Text } from "../Text";
import { BAN } from "../data";
import { fmtDate } from "../prices";
import { exportText } from "../store";
import { FS, R, useTheme } from "../theme";
import { Screen, useBarState } from "../chrome";
import { Btn } from "../visual";
import { Backup } from "../Backup";
import { toast } from "../toast";

function Sec({ title, text, open: o0 }: { title: string; text: string; open?: boolean }) {
  const t = useTheme();
  const [open, setOpen] = useState(!!o0);
  return (
    <View style={{ borderBottomWidth: 1, borderColor: t.line }}>
      <Pressable onPress={() => setOpen(!open)} accessibilityState={{ expanded: open }} style={{ minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <Text style={{ color: t.ink, fontFamily: DISPLAY, fontWeight: "700", fontSize: FS.lg, flexShrink: 1 }}>{title}</Text>
        <Svg width={18} height={18} viewBox="0 0 24 24" style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}>
          <Path d="M5 9l7 7 7-7" stroke={t.ink} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </Svg>
      </Pressable>
      {open ? <Text style={{ color: t.ink2, fontSize: FS.md, lineHeight: 23, paddingBottom: 18 }}>{text}</Text> : null}
    </View>
  );
}

export default function Info() {
  const t = useTheme();
  const bar = useBarState();
  const [imp, setImp] = useState(false);
  const secs: [string, string, boolean?][] = [
    ["Dove sono salvati i miei dati?", "Le copie della collezione e i mazzi restano salvati su questo dispositivo, nel browser o nell'app. Non c'è ancora una sincronizzazione tra dispositivi: cancellando i dati del browser o disinstallando l'app si perdono: per conservarli usa il Backup qui sopra.", true],
    ["Cos'è Digital Gate", "Un catalogo non ufficiale del Digimon Card Game in inglese: tutti i prodotti, le carte (con ristampe e alternative art), le prossime uscite, la tua collezione e i tuoi mazzi."],
    ["Da dove arrivano i dati", "Carte dal database pubblico TakaOtaku (Digimon Card App) e dal sito ufficiale Bandai; date e materiali promozionali dal sito ufficiale Digimon Card Game. Il testo delle carte resta in inglese, come stampato. Possono esserci errori: segnalali e li correggo."],
    ["Regole e lista ban", "Mazzo principale di 50 carte, 0–5 Digi-Egg, massimo 4 copie per numero di carta. Lista ban e restrizioni in vigore dal " + fmtDate(BAN.effective) + ": " + BAN.banned.length + " bandite, " + BAN.restricted.length + " limitate, " + BAN.pairs.length + " coppie vietate."],
    ["Crediti e marchi", "Digimon e Digimon Card Game sono marchi di Bandai. ©Akiyoshi Hongo, Toei Animation. Questo progetto non è affiliato a Bandai."],
  ];
  return (
    <Screen bs={bar} title="Informazioni">
      <ScrollView onScroll={bar.onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8 + bar.pad, paddingBottom: 28 }}>
        <View style={{ marginTop: 8, marginBottom: 20 }}>
          <Text accessibilityRole="header" style={{ color: t.ink, fontFamily: DISPLAY, fontWeight: "700", fontSize: FS.xl }}>Backup dei tuoi dati</Text>
          <Text style={{ color: t.ink2, fontSize: FS.md, lineHeight: 22, marginTop: 6, marginBottom: 4 }}>Copia in un testo la collezione, le preferite (con liste e avvisi) e i mazzi, per conservarli o incollarli su un altro telefono.</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 10 }}>
            <Btn
              label="Copia backup"
              pri
              onPress={async () => {
                await Clipboard.setStringAsync(exportText());
                toast("Backup copiato negli appunti.");
              }}
            />
            <Btn label="Importa backup" onPress={() => setImp(true)} />
          </View>
        </View>
        {secs.map(([a, b, o]) => (
          <Sec key={a} title={a} text={b} open={o} />
        ))}
      </ScrollView>
      <Backup visible={imp} onClose={() => setImp(false)} />
    </Screen>
  );
}
