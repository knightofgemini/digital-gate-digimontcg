// Recupero una tantum dei dati dell'app attuale (sito impacchettato con Capacitor) quando la nuova app viene installata sopra:
// stesso pacchetto Android, quindi collezione, preferite, mazzi e scelte sono ancora nel telefono, nella memoria della WebView
// dell'indirizzo https://localhost. Una WebView invisibile con la stessa origine li legge e li passa all'app, che li unisce
// ai propri (per ogni versione tiene il numero di copie più alto, come "Unisci" del backup).
// Prima di aprirla si cancella la vecchia memoria delle immagini (fino a ~500 MB), che la nuova app non usa più.
import { useEffect, useRef } from "react";
import { Platform, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { WebView } from "react-native-webview";
import { importText } from "./store";
import { setThemePref } from "./theme";
import { toast } from "./toast";
import { BGD } from "./bgdl";

const WV: any = WebView;
const FLAG = "dg-migrated";
const TRIES = "dg-migr-try";
const DATA = ["dgm-qty", "dg-fav", "dgm-decks"];
// scelte copiate solo se la nuova app non ne ha già una
const PREFS = ["dgm-view", "dg-theme", "dg-scans", "dg-pord", "dg-dkview"];

export async function needMigration() {
  if (Platform.OS !== "android") return false;
  try {
    return !(await AsyncStorage.getItem(FLAG));
  } catch (e) {
    return false;
  }
}

const READ = `(function(){var o={};${JSON.stringify(DATA.concat(PREFS))}.forEach(function(k){try{o[k]=localStorage.getItem(k)}catch(e){}});window.ReactNativeWebView.postMessage(JSON.stringify(o))})();true;`;

export function Migrate({ onDone }: { onDone: () => void }) {
  const done = useRef(false);
  const finish = async (flag: string | null) => {
    if (done.current) return;
    done.current = true;
    try {
      if (flag) await AsyncStorage.setItem(FLAG, flag);
      else {
        // non riuscito: si riprova ai prossimi avvii, al massimo 3 volte
        const n = parseInt((await AsyncStorage.getItem(TRIES)) || "0", 10) + 1;
        await AsyncStorage.setItem(TRIES, String(n));
        if (n >= 3) await AsyncStorage.setItem(FLAG, "fail");
      }
    } catch (e) {}
    onDone();
  };
  useEffect(() => {
    BGD && BGD.clearOldImages();
    const t = setTimeout(() => finish(null), 20000);
    return () => clearTimeout(t);
  }, []);

  const onMessage = async (e: any) => {
    let o: Record<string, string | null> = {};
    try {
      o = JSON.parse(e.nativeEvent.data) || {};
    } catch (er) {
      return finish(null);
    }
    const js = (k: string, d: any) => {
      try {
        const v = JSON.parse(o[k] || "null");
        return v == null ? d : v;
      } catch (er) {
        return d;
      }
    };
    const qty = js("dgm-qty", {}),
      fav = js("dg-fav", null),
      decks = js("dgm-decks", []);
    const any = Object.keys(qty || {}).length || (fav && Object.keys(fav.f || {}).length) || (Array.isArray(decks) && decks.length);
    if (any) {
      const r = importText(JSON.stringify({ qty, fav: fav || {}, decks: Array.isArray(decks) ? decks : [] }), false);
      if (r.ok) toast("Recuperati i dati dell'app precedente: collezione, preferite e mazzi.");
    }
    try {
      const cur = await AsyncStorage.multiGet(PREFS);
      const set: [string, string][] = [];
      cur.forEach(([k, v]) => {
        if (v == null && o[k] != null) set.push([k, o[k] as string]);
      });
      if (set.length) await AsyncStorage.multiSet(set);
      const th = set.find(([k]) => k === "dg-theme");
      if (th && (th[1] === "light" || th[1] === "dark")) setThemePref(th[1]);
    } catch (er) {}
    finish(any ? "1" : "none");
  };

  return (
    <View style={{ position: "absolute", width: 1, height: 1, opacity: 0 }} pointerEvents="none">
      <WV
        source={{ html: "<!doctype html><html><body></body></html>", baseUrl: "https://localhost" }}
        originWhitelist={["*"]}
        domStorageEnabled
        javaScriptEnabled
        injectedJavaScript={READ}
        onMessage={onMessage}
        onError={() => finish(null)}
        onRenderProcessGone={() => (finish(null), true)}
        style={{ width: 1, height: 1 }}
      />
    </View>
  );
}
