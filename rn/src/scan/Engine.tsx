// Motore della scansione sul telefono: WebView invisibile con la pagina di engine.ts.
import { useEffect, useRef } from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";
import { ENGINE_HTML } from "./engineHtml";
import { engineMessage, setPoster } from "./bridge";

// (i tipi della WebView non vanno d'accordo con React 19: si usa come componente generico)
const WV: any = WebView;

export function Engine() {
  const ref = useRef<any>(null);
  useEffect(() => {
    setPoster((s) => ref.current?.injectJavaScript("window.__msg(" + s + ");true;"));
    return () => setPoster(null);
  }, []);
  return (
    <View style={{ width: 1, height: 1, position: "absolute", opacity: 0 }} pointerEvents="none">
      <WV ref={ref} source={{ html: ENGINE_HTML, baseUrl: "https://knightofgemini.github.io/" }} originWhitelist={["*"]} javaScriptEnabled onMessage={(e: any) => engineMessage(e.nativeEvent.data)} />
    </View>
  );
}
