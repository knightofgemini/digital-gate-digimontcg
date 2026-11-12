// APK: all'avvio controlla se nella release "latest" c'è una build più recente e propone di installarla
// (apre il download nel browser del telefono), come nell'app attuale. Numero di build in app.json → extra.build
// (lo scrive la pubblicazione); in Expo Go e sul sito vale 0 e il controllo non parte.
// Avvisi in fila (12 novembre 2026, richiesta dell'utente): prima il riquadro delle carte nuove, poi questo. Compare
// dopo l'intro e il primo controllo delle carte (al massimo 15 s), mai mentre il riquadro è in arrivo o aperto; se il
// riquadro arriva mentre questo è aperto, questo si toglie e torna quando il riquadro è chiuso.
import { useEffect, useState } from "react";
import { Linking, Modal, Platform, Pressable, View } from "react-native";
import { Text } from "./Text";
import Constants from "expo-constants";
import { useTheme } from "./theme";
import { useNewsBusy } from "./News";
import { whenFirstCheck } from "./dataupd";
import { whenIntroDone } from "./Intro";

const APK_URL = "https://github.com/knightofgemini/digital-gate-digimontcg/releases/download/latest/DigimonSetTracker.apk";
export const APPBUILD = +((Constants.expoConfig as any)?.extra?.build || 0);

export function UpdateCheck() {
  const t = useTheme();
  const [upd, setUpd] = useState<{ latest: number; url: string } | null>(null);
  const busy = useNewsBusy();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      whenIntroDone(() => setReady(true));
    };
    whenFirstCheck(go);
    const tm = setTimeout(go, 15000);
    return () => clearTimeout(tm);
  }, []);
  useEffect(() => {
    if (Platform.OS !== "android" || !APPBUILD) return;
    const tm = setTimeout(() => {
      fetch("https://api.github.com/repos/knightofgemini/digital-gate-digimontcg/releases/tags/latest", { headers: { Accept: "application/vnd.github+json" } })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (!j) return;
          const m = String((j.name || "") + " " + (j.body || "")).match(/build[:\s]+(\d+)/i),
            latest = m ? +m[1] : 0;
          const asset = (j.assets || []).find((a: any) => /\.apk$/i.test(a.name));
          if (!latest || latest <= APPBUILD || !asset || asset.state !== "uploaded") return;
          setUpd({ latest, url: asset.browser_download_url || APK_URL });
        })
        .catch(() => {});
    }, 1500);
    return () => clearTimeout(tm);
  }, []);
  if (!upd || !ready || busy) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => setUpd(null)}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,.6)", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <View style={{ backgroundColor: t.surface, borderRadius: 16, padding: 20, width: "100%", maxWidth: 420 }}>
          <Text style={{ color: t.ink, fontSize: 19, fontWeight: "800" }}>Nuova versione disponibile</Text>
          <Text style={{ color: t.ink2, marginTop: 8, lineHeight: 21 }}>{"È uscita una versione più recente dell'app (build " + upd.latest + ", tu hai la " + APPBUILD + "). Vuoi scaricarla e installarla adesso?"}</Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
            <Pressable onPress={() => setUpd(null)} style={{ flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 10, backgroundColor: t.surface2 }}>
              <Text style={{ color: t.ink, fontWeight: "800" }}>Più tardi</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                const u = upd.url;
                setUpd(null);
                Linking.openURL(u);
              }}
              style={{ flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 10, backgroundColor: t.accent }}
            >
              <Text style={{ color: t.accentInk, fontWeight: "800" }}>Installa</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
