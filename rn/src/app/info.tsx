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
import { useTheme } from "../theme";
import { PageTitle } from "../ui";
import { Screen } from "../chrome";
import { Btn } from "../visual";
import { Backup } from "../Backup";
import { toast } from "../toast";

function Sec({ title, text, open: o0 }: { title: string; text: string; open?: boolean }) {
  const t = useTheme();
  const [open, setOpen] = useState(!!o0);
  return (
    <View style={{ borderWidth: 1, borderColor: t.line, borderRadius: 12, backgroundColor: t.surface, marginBottom: 10 }}>
      <Pressable onPress={() => setOpen(!open)} accessibilityState={{ expanded: open }} style={{ minHeight: 52, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <Text style={{ color: t.ink, fontWeight: "600", flexShrink: 1 }}>{title}</Text>
        <Svg width={18} height={18} viewBox="0 0 24 24" style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}>
          <Path d="M5 9l7 7 7-7" stroke={t.ink} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </Svg>
      </Pressable>
      {open ? <Text style={{ color: t.ink2, fontSize: 14.7, lineHeight: 23.5, paddingHorizontal: 16, paddingBottom: 16 }}>{text}</Text> : null}
    </View>
  );
}

export default function Info() {
  const t = useTheme();
  const [imp, setImp] = useState(false);
  const secs: [string, string, boolean?][] = [
    ["Dove sono salvati i miei dati?", "Le copie della collezione e i mazzi restano salvati su questo dispositivo, nel browser o nell'app. Non c'è ancora una sincronizzazione tra dispositivi: cancellando i dati del browser o disinstallando l'app si perdono: per conservarli usa il Backup qui sopra.", true],
    ["Cos'è Digital Gate", "Un catalogo non ufficiale del Digimon Card Game in inglese: tutti i prodotti, le carte (con ristampe e alternative art), le prossime uscite, la tua collezione e i tuoi mazzi."],
    ["Da dove arrivano i dati", "Carte dal database pubblico TakaOtaku (Digimon Card App) e dal sito ufficiale Bandai; date e materiali promozionali dal sito ufficiale Digimon Card Game. Il testo delle carte resta in inglese, come stampato. Possono esserci errori: segnalali e li correggo."],
    ["Regole e lista ban", "Mazzo principale di 50 carte, 0–5 Digi-Egg, massimo 4 copie per numero di carta. Lista ban e restrizioni in vigore dal " + fmtDate(BAN.effective) + ": " + BAN.banned.length + " bandite, " + BAN.restricted.length + " limitate, " + BAN.pairs.length + " coppie vietate."],
    ["Crediti e marchi", "Digimon e Digimon Card Game sono marchi di Bandai. ©Akiyoshi Hongo, Toei Animation. Questo progetto non è affiliato a Bandai."],
  ];
  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 4, paddingBottom: 28 }}>
        <PageTitle>Informazioni</PageTitle>
        <View style={{ backgroundColor: t.surface, borderWidth: 1, borderColor: t.line, borderRadius: 14, padding: 14, marginBottom: 14 }}>
          <Text style={{ color: t.cyan, fontFamily: DISPLAY, fontWeight: "600", fontSize: 11.2, letterSpacing: 2, textTransform: "uppercase" }}>Backup dei tuoi dati</Text>
          <Text style={{ color: t.ink, marginTop: 14, marginBottom: 4 }}>Copia in un testo la collezione, le preferite (con liste e avvisi) e i mazzi, per conservarli o incollarli su un altro telefono.</Text>
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
