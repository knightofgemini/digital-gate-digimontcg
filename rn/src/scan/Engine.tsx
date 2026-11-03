// Motore della scansione sul telefono: WebView invisibile con la pagina di engine.ts.
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";
import { ENGINE_HTML } from "./engineHtml";
import { engineGone, engineMessage, setPoster } from "./bridge";

// (i tipi della WebView non vanno d'accordo con React 19: si usa come componente generico)
const WV: any = WebView;

export function Engine() {
  const ref = useRef<any>(null);
  // se il processo della WebView muore (memoria) la si ricrea invece di far chiudere tutta l'app
  const [gen, setGen] = useState(0);
  useEffect(() => {
    setPoster((s) => ref.current?.injectJavaScript("window.__msg(" + s + ");true;"));
    return () => setPoster(null);
  }, [gen]);
  const gone = () => {
    engineGone();
    setPoster(null);
    setGen((g) => g + 1);
    return true;
  };
  return (
    <View style={{ width: 1, height: 1, position: "absolute", opacity: 0 }} pointerEvents="none">
      <WV key={gen} ref={ref} onRenderProcessGone={gone} source={{ html: ENGINE_HTML, baseUrl: "https://knightofgemini.github.io/" }} originWhitelist={["*"]} javaScriptEnabled onMessage={(e: any) => engineMessage(e.nativeEvent.data)} />
    </View>
  );
}
