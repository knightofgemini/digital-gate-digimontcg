// Motore della scansione sul sito: iframe invisibile con la pagina di engine.ts.
import { useEffect } from "react";
import { ENGINE_HTML } from "./engineHtml";
import { engineMessage, setPoster } from "./bridge";

export function Engine() {
  useEffect(() => {
    const f = document.createElement("iframe");
    f.style.cssText = "position:absolute;width:1px;height:1px;opacity:0;border:0;pointer-events:none";
    f.srcdoc = ENGINE_HTML;
    const onMsg = (e: MessageEvent) => {
      if (e.source === f.contentWindow && typeof e.data === "string") engineMessage(e.data);
    };
    window.addEventListener("message", onMsg);
    setPoster((s) => f.contentWindow && f.contentWindow.postMessage(s, "*"));
    document.body.appendChild(f);
    return () => {
      window.removeEventListener("message", onMsg);
      setPoster(null);
      f.remove();
    };
  }, []);
  return null;
}
