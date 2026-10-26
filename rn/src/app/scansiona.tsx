// Scansione delle carte con la fotocamera (come nell'app attuale): si inquadra la carta nella cornice, l'app legge il numero
// (o il nome) e propone le versioni ordinate per somiglianza; si segnano le copie e la scansione resta in cronologia.
// Anche da una foto della galleria. Nessuna foto viene inviata o salvata.
import { useEffect, useRef, useState } from "react";
import { Animated, BackHandler, Easing, Platform, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { DISPLAY, Text } from "../Text";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { deleteAsync } from "expo-file-system/legacy";
import { Image } from "expo-image";
import { router } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Card, SETBY, fullUrl, hostSet, isAce, thumbUrl, verLabel } from "../data";
import { ConfirmBox } from "../deckui";
import { FitText } from "../fit";
import { QtyControl } from "../items";
import { Btn, ICO_PLUS } from "../visual";
import { openCard } from "../nav";
import { setProgress } from "../scan/bridge";
import { Engine } from "../scan/Engine";
import { SCH, ScanItem, ScanResult, loadHistory, rankVers, readPhoto, saveHistory, scVers, schEntry, setHistory, warm } from "../scan/recognize";
import { owned, setQty, useStore } from "../store";
import { useTheme } from "../theme";
import { toast } from "../toast";

// solo durante lo sviluppo sul sito: prova del riconoscimento con un'immagine, senza fotocamera
if (__DEV__ && typeof window !== "undefined") (window as any).__scanTest = async (img: string) => {
    const r = await readPhoto(img, null, 0);
    return r && { codes: r.codes, sure: r.sure, rank: (await rankVers(scVers(r.codes[0]), r.sig)).map((x) => [x.a.k, x.d == null ? null : Math.round(x.d * 100) / 100]) };
  };

const mk = (a: Card) => (a.suf && a.mark === "SP" ? "SP" : a.suf && a.mark === 2 ? "★★" : a.suf && a.mark === 1 ? "★" : "");

export default function Scansiona() {
  const t = useTheme();
  useStore();
  const { width, height } = useWindowDimensions();
  const [perm, askPerm] = useCameraPermissions();
  const cam = useRef<CameraView>(null);
  // scatti più piccoli (circa 1280×960 invece della piena risoluzione): lettura più veloce e meno memoria
  const [picSize, setPicSize] = useState<string | undefined>(undefined);
  async function pickSize() {
    try {
      const l: string[] = (await (cam.current as any)?.getAvailablePictureSizesAsync()) || [];
      const px = (x: string) => {
        const m = x.match(/(\d+)x(\d+)/);
        return m ? +m[1] * +m[2] : 0;
      };
      const ok = l.filter((x) => px(x) >= 900000 && px(x) <= 2100000).sort((a, b) => px(a) - px(b));
      if (ok.length) setPicSize(ok[0]);
    } catch (e) {}
  }
  const [status, setStatus] = useState("Avvio la fotocamera…");
  const [warn, setWarn] = useState(false);
  const [ready, setReady] = useState(false); // riconoscimento pronto
  const [camOk, setCamOk] = useState(false);
  const [torch, setTorch] = useState(false);
  const [res, setRes] = useState<ScanResult | null>(null);
  const [hist, setHist] = useState(false);
  const [fromHist, setFromHist] = useState(false); // risultato riaperto dalla cronologia
  const [view, setV] = useState({ w: width, h: height });
  const live = useRef(true);
  const busy = useRef(false);
  const tries = useRef(0);
  const cur = useRef<ScanItem | null>(null);
  const preK = useRef<string | null>(null);

  // cornice della carta al centro (proporzioni di una carta)
  const fw = Math.min(view.w * 0.72, view.h * 0.56 * 0.716, 360),
    fh = fw / 0.716,
    fx = (view.w - fw) / 2,
    fy = view.h * 0.44 - fh / 2;
  // riga azzurra che scorre su e giù nella cornice mentre si cerca
  const line = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([Animated.timing(line, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: Platform.OS !== "web" }), Animated.timing(line, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: Platform.OS !== "web" })]));
    a.start();
    return () => a.stop();
  }, []);

  useEffect(() => {
    live.current = true;
    loadHistory();
    setProgress((p) => setStatus("Preparo il riconoscimento (solo la prima volta)… " + Math.round(p * 100) + "%"));
    warm().then(
      () => {
        setReady(true);
        setProgress(null);
      },
      () => {
        setStatus("Serve la connessione a Internet per preparare il riconoscimento la prima volta.");
        setWarn(true);
      }
    );
    return () => {
      live.current = false;
      setProgress(null);
    };
  }, []);
  useEffect(() => {
    if (perm && !perm.granted && perm.canAskAgain) askPerm();
    if (perm && !perm.granted && !perm.canAskAgain) {
      setStatus("Permesso per la fotocamera negato. Puoi consentirlo nelle impostazioni del telefono, oppure usare una foto.");
      setWarn(true);
    }
  }, [perm]);

  // fotocamera che non parte (permesso negato o non disponibile): si può usare una foto
  useEffect(() => {
    if (!ready || camOk) return;
    const tm = setTimeout(() => {
      setStatus(perm && !perm.granted ? "Permesso per la fotocamera negato. Puoi consentirlo nelle impostazioni del telefono, oppure usare una foto." : "Non riesco ad aprire la fotocamera: puoi usare una foto della carta.");
      setWarn(true);
    }, 3500);
    return () => clearTimeout(tm);
  }, [ready, camOk, perm?.granted]);
  // solo durante lo sviluppo sul sito: mostra il risultato di un'immagine come se fosse stata scansionata
  useEffect(() => {
    if (!__DEV__ || typeof window === "undefined") return;
    (window as any).__scanFeed = async (img: string) => {
      const r = await readPhoto(img, null, 0);
      if (r) show(r);
      return !!r;
    };
  }, []);

  // giro continuo: scatto, lettura, se non trova riprova
  useEffect(() => {
    if (!ready || !camOk || res || hist) return;
    let stop = false;
    const loop = async () => {
      if (stop || !live.current) return;
      // una lettura ancora in corso (es. tornando dalla cronologia): si riprova poco dopo invece di fermare il giro
      if (busy.current) return void setTimeout(loop, 250);
      setStatus(tries.current >= 4 ? "Avvicina la carta, tienila ferma e con buona luce" : "Inquadra la carta dentro la cornice");
      setWarn(tries.current >= 4);
      busy.current = true;
      try {
        const p = await cam.current?.takePictureAsync({ base64: true, quality: 0.5, shutterSound: false });
        // Android salva ogni scatto nella cache: si cancella subito (prima si accumulavano decine di MB al minuto)
        if (p && p.uri && !p.uri.startsWith("data:")) deleteAsync(p.uri, { idempotent: true }).catch(() => {});
        if (stop || !p || !p.base64) throw new Error("foto");
        const img = p.uri && p.uri.startsWith("data:") ? p.uri : "data:image/jpeg;base64," + p.base64;
        const r = await readPhoto(img, { vw: view.w, vh: view.h, fx, fy, fw, fh }, 0.5);
        busy.current = false;
        if (stop) return;
        if (r) return show(r);
        tries.current++;
      } catch (e) {
        busy.current = false;
        tries.current++;
      }
      if (!stop) setTimeout(loop, 250);
    };
    setTimeout(loop, 400);
    return () => {
      stop = true;
    };
  }, [ready, camOk, res, hist]);

  function show(r: ScanResult) {
    const top = SCH[0],
      now = Date.now();
    // la stessa carta letta di nuovo entro 20 secondi non crea una seconda voce
    if (top && top.code === r.codes[0] && now - top.t < 20000) cur.current = top;
    else {
      cur.current = { t: now, code: r.codes[0], k: "", sure: r.sure ? 1 : 0 };
      SCH.unshift(cur.current);
    }
    saveHistory();
    setRes(r);
  }
  async function fromPhoto() {
    const p = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], base64: true, quality: 0.8 });
    if (p.canceled || !p.assets[0]) return;
    const a = p.assets[0];
    const img = a.uri.startsWith("data:") ? a.uri : "data:image/jpeg;base64," + a.base64;
    setStatus("Leggo la foto…");
    setWarn(false);
    try {
      await warm();
      const r = await readPhoto(img, null, 0);
      if (r) show(r);
      else {
        setStatus("Non ho riconosciuto la carta in questa foto. Prova con una foto più vicina e nitida.");
        setWarn(true);
      }
    } catch (e) {
      setStatus("Serve la connessione a Internet per preparare il riconoscimento la prima volta.");
      setWarn(true);
    }
  }
  // di nuovo alla fotocamera
  const again = () => {
    tries.current = 0;
    cur.current = null;
    preK.current = null;
    setFromHist(false);
    setRes(null);
    setHist(false);
  };
  // la cronologia prende il posto del risultato
  const toHist = () => {
    cur.current = null;
    preK.current = null;
    setFromHist(false);
    setRes(null);
    setHist(true);
  };
  // una voce della cronologia riapre il suo risultato (versione scelta allora, copie)
  const openItem = (it: ScanItem) => {
    cur.current = it;
    preK.current = it.k;
    setFromHist(true);
    setRes({ codes: [it.code], sure: !!it.sure, sig: null });
    setHist(false);
  };
  // indietro di Android: dal risultato riaperto torna alla cronologia, dal risultato o dalla cronologia alla fotocamera
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (res && fromHist) toHist();
      else if (res || hist) again();
      else return false;
      return true;
    });
    return () => sub.remove();
  }, [res, hist, fromHist]);
  const close = () => (router.canGoBack() ? router.back() : router.replace("/carte"));

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }} onLayout={(e) => setV({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      <Engine />
      {perm?.granted && <CameraView ref={cam} style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }} facing="back" enableTorch={torch} pictureSize={picSize} onCameraReady={() => (setCamOk(true), pickSize())} onMountError={() => setCamOk(false)} animateShutter={false} />}
      {/* fuori dalla cornice tutto scurito; angoli arancioni (verdi a carta trovata) e riga che scorre */}
      <View pointerEvents="none" style={{ position: "absolute", left: fx - 1000, top: fy - 1000, width: fw + 2000, height: fh + 2000, borderWidth: 1000, borderRadius: 1018, borderColor: "rgba(5,8,15,.62)" }} />
      <View pointerEvents="none" style={{ position: "absolute", left: fx, top: fy, width: fw, height: fh }}>
        {[
          { left: -3, top: -3, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 18 },
          { right: -3, top: -3, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 18 },
          { left: -3, bottom: -3, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 18 },
          { right: -3, bottom: -3, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 18 },
        ].map((c, i) => (
          <View key={i} style={[{ position: "absolute", width: 34, height: 34, borderWidth: 4, borderColor: res ? "#4ade80" : "#ff7a3d" }, c]} />
        ))}
        {!res && !hist && ready ? (
          <Animated.View style={{ position: "absolute", left: "8%", right: "8%", height: 2, borderRadius: 2, backgroundColor: "#63d5ee", opacity: 0.9, boxShadow: "0 0 14px #63d5ee", top: line.interpolate({ inputRange: [0, 1], outputRange: [fh * 0.06, fh * 0.94] }) }} />
        ) : null}
      </View>
      {/* intestazione */}
      <View style={{ position: "absolute", left: 0, right: 0, top: 0 }}>
        <Svg pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 10 100">
          <Defs>
            <LinearGradient id="schead" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#05080f" stopOpacity={0.75} />
              <Stop offset="1" stopColor="#05080f" stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect width="10" height="100" fill="url(#schead)" />
        </Svg>
        <SafeAreaView edges={["top"]}>
          <View style={{ flexDirection: "row", alignItems: "center", paddingTop: 10, paddingHorizontal: 12, paddingBottom: 10, gap: 10 }}>
            <ScBtn icon="x" onPress={close} label="Chiudi" />
            <Text style={{ flex: 1, color: "#f1f4f9", fontFamily: DISPLAY, fontWeight: "700", fontSize: 17.6, letterSpacing: 0.35, textAlign: "center" }}>Scansiona una carta</Text>
            <View style={{ opacity: camOk ? 1 : 0 }} pointerEvents={camOk ? "auto" : "none"}>
              <ScBtn icon="torch" on={torch} onPress={() => setTorch(!torch)} label="Torcia" />
            </View>
          </View>
        </SafeAreaView>
      </View>
      {!!status && !res && !hist ? (
        <View pointerEvents="none" style={{ position: "absolute", left: 16, right: 16, top: fy + fh + 16, alignItems: "center" }}>
          <View style={{ maxWidth: "100%", paddingVertical: 9, paddingHorizontal: 16, borderRadius: 99, backgroundColor: "rgba(19,27,46,.82)", borderWidth: 1, borderColor: warn ? "rgba(255,122,61,.6)" : "rgba(255,255,255,.12)" }}>
            <Text style={{ color: "#f1f4f9", fontWeight: "500", fontSize: 14.7, lineHeight: 19, textAlign: "center" }}>{status}</Text>
          </View>
        </View>
      ) : null}
      {!res && !hist ? (
        <View style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}>
          <Svg pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 10 100">
            <Defs>
              <LinearGradient id="scfoot" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#05080f" stopOpacity={0} />
                <Stop offset="1" stopColor="#05080f" stopOpacity={0.8} />
              </LinearGradient>
            </Defs>
            <Rect width="10" height="100" fill="url(#scfoot)" />
          </Svg>
          <SafeAreaView edges={["bottom"]}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: camOk ? "space-between" : "center", gap: 12, paddingTop: 14, paddingHorizontal: 22, paddingBottom: 18 }}>
              <ScPill icon="pic" label="Usa una foto" big={!camOk} onPress={fromPhoto} />
              {camOk ? (
                <ScPill icon="hist" label="Cronologia" onPress={() => setHist(true)} badge={SCH.length} />
              ) : null}
            </View>
          </SafeAreaView>
        </View>
      ) : null}
      {res && !hist && <Result key={(fromHist ? "h" : "r") + (cur.current ? cur.current.t : 0)} r={res} cur={cur.current} preK={preK.current} fromHist={fromHist} again={again} toHist={toHist} />}
      {hist && <History close={again} open={openItem} />}
    </View>
  );
}

// cerchio come tracciato (così ogni icona è un solo elenco di tracciati)
const circ = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
const SCICO: Record<string, string[]> = {
  x: ["M6 6l12 12M18 6L6 18"],
  torch: ["M8 3h8l-1 5H9z", "M9 8l1 13h4l1-13", "M12 12v3"],
  pic: ["M5.5 4.5h13a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2z", circ(9, 10, 1.8), "M20.5 16l-5-5-8.5 8.5"],
  hist: ["M3.5 12a8.5 8.5 0 1 0 2.6-6.1", "M3 4.5V9h4.5", "M12 7.5V12l3 2"],
  cam: ["M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z", circ(12, 13.5, 3.6)],
  ok: [circ(12, 12, 9), "M8 12.5l2.6 2.6L16 9.5"],
  q: [circ(12, 12, 9), "M9.6 9.3a2.5 2.5 0 0 1 4.8 1c0 1.7-2.4 2-2.4 3.6M12 17v.5"],
  back: ["M15 5l-7 7 7 7"],
};
const CAM = SCICO.cam.join("");
function ScIco({ name, color, size = 22 }: { name: string; color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {SCICO[name].map((d) => (
        <Path key={d} d={d} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      ))}
    </Svg>
  );
}
function ScBtn({ icon, onPress, on, label }: { icon: string; onPress: () => void; on?: boolean; label: string }) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} style={{ width: 46, height: 46, borderRadius: 23, borderWidth: 1, borderColor: on ? "#ff7a3d" : "rgba(255,255,255,.18)", backgroundColor: on ? "#ff7a3d" : "rgba(19,27,46,.72)", alignItems: "center", justifyContent: "center" }}>
      <ScIco name={icon} color={on ? "#1a0b03" : "#f1f4f9"} />
    </Pressable>
  );
}
function ScPill({ icon, label, onPress, big, badge }: { icon: string; label: string; onPress: () => void; big?: boolean; badge?: number }) {
  return (
    <Pressable onPress={onPress} style={{ height: big ? 52 : 46, flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: big ? 18 : 12, paddingRight: big ? 22 : 16, borderRadius: big ? 26 : 23, borderWidth: 1, borderColor: big ? "#ff7a3d" : "rgba(255,255,255,.18)", backgroundColor: big ? "#ff7a3d" : "rgba(19,27,46,.72)" }}>
      <ScIco name={icon} color={big ? "#1a0b03" : "#f1f4f9"} size={20} />
      <Text style={{ color: big ? "#1a0b03" : "#f1f4f9", fontFamily: DISPLAY, fontWeight: "600", fontSize: big ? 16 : 14.4 }}>{label}</Text>
      {badge ? (
        <View style={{ minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 10, backgroundColor: "#63d5ee", alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: "#06222a", fontFamily: DISPLAY, fontWeight: "700", fontSize: 11.5, lineHeight: 20 }}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}


// foglio dal basso del risultato e della cronologia (.scres): maniglia, angoli arrotondati, ombra
function Sheet({ children, tall }: { children: React.ReactNode; tall?: boolean }) {
  const t = useTheme();
  const ins = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  return (
    <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, maxHeight: height * (tall ? 0.86 : 0.76), minHeight: tall ? height * 0.5 : undefined, backgroundColor: t.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, boxShadow: "0 -14px 40px rgba(0,0,0,.5)" }}>
      <ScrollView contentContainerStyle={{ paddingTop: 8, paddingHorizontal: 16, paddingBottom: 16 + ins.bottom }}>
        <View style={{ alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: t.line, marginTop: 2, marginBottom: 12 }} />
        {children}
      </ScrollView>
    </View>
  );
}

// titoletto maiuscolo (.sch) con eventuale testo a destra
function SchHead({ title, hint, top = 16 }: { title: string; hint?: string; top?: number }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginTop: top, marginBottom: 8 }}>
      <Text style={{ color: t.ink2, fontFamily: DISPLAY, fontWeight: "700", fontSize: 11.8, letterSpacing: 1.2, textTransform: "uppercase" }}>{title}</Text>
      {hint ? <Text style={{ color: t.ink2, fontWeight: "500", fontSize: 12.5 }}>{hint}</Text> : null}
    </View>
  );
}

// risultato: carta trovata, eventuali alternative ("Forse era"), versioni ordinate per somiglianza, copie
function Result({ r, cur, preK, fromHist, again, toHist }: { r: ScanResult; cur: ScanItem | null; preK: string | null; fromHist: boolean; again: () => void; toHist: () => void }) {
  const t = useTheme();
  useStore();
  const [ci, setCi] = useState(0);
  const code = r.codes[ci];
  const vers0 = scVers(code);
  const pre = useRef(preK);
  const [vers, setVers] = useState<{ a: Card; d: number | null }[]>(vers0.map((a) => ({ a, d: null })));
  const [sel, setSel] = useState<Card>((preK && vers0.find((a) => a.k === preK)) || vers0[0]);
  const [best, setBest] = useState<Card | null>(null);
  const picked = useRef(false);
  useEffect(() => {
    const v = scVers(code);
    // dalla cronologia si riparte dalla versione scelta allora
    const p = pre.current ? v.find((a) => a.k === pre.current) : undefined;
    pre.current = null;
    setVers(v.map((a) => ({ a, d: null })));
    setSel(p || v[0]);
    setBest(null);
    picked.current = !!p;
    rankVers(v, r.sig).then((rk) => {
      setVers(rk);
      const b = rk[0] && rk[0].d != null ? rk[0].a : null;
      setBest(b);
      if (b && !picked.current) setSel(b);
    }, () => {});
  }, [code]);
  useEffect(() => {
    if (cur && sel && (cur.k !== sel.k || cur.code !== sel.code)) {
      cur.code = sel.code;
      cur.k = sel.k;
      saveHistory();
    }
  }, [sel]);
  const s = sel ? SETBY[hostSet(sel)] : null;
  const okc = r.sure ? t.ok : t.accent;
  return (
    <Sheet>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <ScIco name={r.sure ? "ok" : "q"} color={okc} size={18} />
        <Text style={{ flex: 1, minWidth: 0, color: okc, fontFamily: DISPLAY, fontWeight: "700", fontSize: 11.8, letterSpacing: 1.2, textTransform: "uppercase" }}>
          {fromHist ? "Dalla cronologia" + (r.sure ? "" : " · riconosciuta dal nome") : r.sure ? "Carta riconosciuta" : "Riconosciuta dal nome: controlla"}
        </Text>
        <Pressable onPress={toHist} style={{ flexDirection: "row", alignItems: "center", gap: 5, height: 32, paddingLeft: 9, paddingRight: 11, borderRadius: 16, borderWidth: 1, borderColor: t.line, backgroundColor: t.surface }}>
          <ScIco name={fromHist ? "back" : "hist"} color={t.ink} size={16} />
          <Text style={{ color: t.ink, fontFamily: DISPLAY, fontWeight: "600", fontSize: 12.5 }}>{fromHist ? "Cronologia" : "Cronologia · " + SCH.length}</Text>
        </Pressable>
      </View>
      {sel && (
        <View style={{ flexDirection: "row", gap: 14, alignItems: "flex-start" }}>
          <Pressable onPress={() => openCard(sel)} accessibilityLabel="Apri la scheda della carta" style={{ width: 104, borderRadius: 7, overflow: "hidden", boxShadow: "0 6px 18px rgba(0,0,0,.28)" }}>
            <Image source={fullUrl(sel)} placeholder={thumbUrl(sel)} style={{ width: 104, aspectRatio: 63 / 88 }} cachePolicy="disk" />
          </Pressable>
          <View style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
            <Text style={{ color: t.ink2, fontFamily: DISPLAY, fontWeight: "600", fontSize: 13.1 }}>{sel.code + (mk(sel) ? "  " + mk(sel) : "") + (sel.rar ? " · " + sel.rar : "")}</Text>
            <FitText text={sel.name} size={20} lines={1} display ace={isAce(sel)} boxStyle={{ marginTop: 2, marginBottom: 4 }} style={{ color: t.ink, fontFamily: DISPLAY, fontWeight: "700" }} />
            {s && (
              <Text numberOfLines={1} style={{ color: t.accent, fontSize: 13.4, fontWeight: "600" }}>
                {s.name}
              </Text>
            )}
            <Text style={{ marginTop: 6, color: t.ink2, fontSize: 12.8 }}>
              Versione: <Text style={{ color: t.ink, fontWeight: "600" }}>{sel.suf ? (verLabel(sel.ver) || "Alternative Art") + (mk(sel) ? " " + mk(sel) : "") : "Regular"}</Text>
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: t.line, backgroundColor: t.surface }}>
              <Text style={{ flexShrink: 1, color: t.ink2, fontSize: 13.6 }}>Copie possedute</Text>
              <QtyControl
                value={owned(sel)}
                onSet={(v) => {
                  setQty(sel, v);
                  if (cur && !cur.add) {
                    cur.add = 1;
                    saveHistory();
                  }
                }}
              />
            </View>
          </View>
        </View>
      )}
      {r.codes.length > 1 && (
        <>
          <SchHead title="Forse era" />
          <View style={{ gap: 6 }}>
            {r.codes.map((cd, i) => {
              const c0 = scVers(cd)[0];
              return (
                <Pressable key={cd} onPress={() => setCi(i)} style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 6, borderRadius: 10, borderWidth: 1, borderColor: i === ci ? t.accent : t.line, backgroundColor: t.surface }}>
                  <Image source={thumbUrl(c0)} style={{ width: 34, aspectRatio: 63 / 88, borderRadius: 4 }} cachePolicy="disk" />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ color: t.ink, fontFamily: DISPLAY, fontWeight: "600", fontSize: 14.4 }}>
                      {c0.name}
                    </Text>
                    <Text numberOfLines={1} style={{ color: t.ink2, fontSize: 12.2 }}>
                      {cd + " · " + (SETBY[c0.set]?.name || "")}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </>
      )}
      <SchHead title={"Versioni · " + vers.length} hint={vers.length > 1 ? "Tocca quella che hai in mano" : ""} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -2 }} contentContainerStyle={{ gap: 10, paddingTop: 4, paddingBottom: 6, paddingHorizontal: 4 }}>
        {vers.map(({ a }) => {
          const on = !!sel && sel.k === a.k;
          return (
            <Pressable
              key={a.k}
              onPress={() => {
                picked.current = true;
                setSel(a);
              }}
              accessibilityState={{ selected: on }}
              style={{ width: 74 }}
            >
              <View>
                <Image source={thumbUrl(a)} style={{ width: 74, aspectRatio: 63 / 88, borderRadius: 6 }} cachePolicy="disk" />
                {on ? <View pointerEvents="none" style={{ position: "absolute", left: -4, top: -4, right: -4, bottom: -4, borderWidth: 2, borderColor: t.accent, borderRadius: 10 }} /> : null}
              </View>
              <Text numberOfLines={1} style={{ marginTop: 5, textAlign: "center", color: t.ink, fontFamily: DISPLAY, fontWeight: "600", fontSize: 11.5 }}>
                {(SETBY[hostSet(a)]?.code || "") + " "}
                {mk(a) ? <Text style={{ color: t.accent }}>{mk(a)}</Text> : null}
              </Text>
              <Text style={{ minHeight: 13, textAlign: "center", color: t.ok, fontFamily: DISPLAY, fontWeight: "700", fontSize: 9.9, letterSpacing: 0.4, textTransform: "uppercase" }}>{best && best.k === a.k ? "Più simile" : ""}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
        <Btn label="Scheda carta" onPress={() => sel && openCard(sel)} height={48} fs={15.2} style={{ flex: 1, paddingHorizontal: 8 }} />
        <Btn label="Scansiona ancora" pri icon={CAM} onPress={again} height={48} fs={15.2} style={{ flex: 1, paddingHorizontal: 8 }} />
      </View>
    </Sheet>
  );
}

// etichetta colorata nelle righe della cronologia (Da aggiungere, Aggiunta, dal nome)
function Tag({ text, bg, fg }: { text: string; bg: string; fg: string }) {
  return (
    <View style={{ paddingHorizontal: 7, paddingVertical: 1, borderRadius: 6, backgroundColor: bg }}>
      <Text style={{ color: fg, fontFamily: DISPLAY, fontWeight: "600", fontSize: 10.9, lineHeight: 16 }}>{text}</Text>
    </View>
  );
}

// cronologia: per giorno, "Aggiungi tutte alla collezione", copie e rimozione per riga, Svuota (con conferma);
// toccando una riga si riapre il risultato di quella scansione
function History({ close, open }: { close: () => void; open: (it: ScanItem) => void }) {
  const t = useTheme();
  useStore();
  const [, force] = useState(0);
  const [cfm, setCfm] = useState(false);
  const refresh = () => force((x) => x + 1);
  const todo = SCH.filter((it) => !it.add);
  const dayOf = (ts: number) => {
    const d = new Date(ts),
      n = new Date(),
      y = new Date();
    y.setDate(n.getDate() - 1);
    if (d.toDateString() === n.toDateString()) return "Oggi";
    if (d.toDateString() === y.toDateString()) return "Ieri";
    return d.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: d.getFullYear() === n.getFullYear() ? undefined : "numeric" });
  };
  let day = "";
  return (
    <Sheet tall>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <ScIco name="hist" color={t.accent} size={22} />
          <Text style={{ color: t.ink, fontFamily: DISPLAY, fontWeight: "700", fontSize: 19.2 }}>Cronologia</Text>
        </View>
        {SCH.length > 0 && (
          <Pressable onPress={() => setCfm(true)} hitSlop={6} style={{ minHeight: 36, justifyContent: "center", paddingHorizontal: 6 }}>
            <Text style={{ color: t.ink2, fontFamily: DISPLAY, fontWeight: "600", fontSize: 13.6 }}>Svuota</Text>
          </Pressable>
        )}
      </View>
      {!SCH.length ? (
        <View style={{ alignItems: "center", paddingTop: 22, paddingHorizontal: 12, paddingBottom: 10 }}>
          <ScIco name="cam" color={t.accent} size={38} />
          <Text style={{ marginTop: 8, marginBottom: 4, color: t.ink, fontFamily: DISPLAY, fontWeight: "700", fontSize: 16.8 }}>Nessuna scansione</Text>
          <Text style={{ color: t.ink2, fontSize: 14.1, lineHeight: 20.4, textAlign: "center" }}>Le carte che scansioni compaiono qui, così puoi rivederle e aggiungerle alla collezione quando vuoi. Restano salvate solo su questo dispositivo.</Text>
        </View>
      ) : (
        <>
          <Text style={{ marginTop: 4, marginBottom: 12, color: t.ink2, fontSize: 13.6 }}>{SCH.length + (SCH.length === 1 ? " scansione" : " scansioni") + (todo.length ? " · " + todo.length + " da aggiungere alla collezione" : " · tutte aggiunte alla collezione")}</Text>
          {todo.length > 0 && (
            <Btn
              pri
              icon={ICO_PLUS}
              height={46}
              style={{ marginBottom: 4 }}
              label={todo.length === 1 ? "Aggiungi alla collezione (1 copia)" : "Aggiungi tutte alla collezione (" + todo.length + " copie)"}
              onPress={() => {
                todo.forEach((it) => {
                  const a = schEntry(it);
                  setQty(a, owned(a) + 1);
                  it.add = 1;
                });
                saveHistory();
                toast(todo.length === 1 ? "1 carta aggiunta alla collezione" : todo.length + " carte aggiunte alla collezione");
                refresh();
              }}
            />
          )}
        </>
      )}
      {SCH.map((it, i) => {
        const a = schEntry(it);
        if (!a) return null;
        const dd = dayOf(it.t);
        const first = !day;
        const head = dd !== day ? (day = dd) : "";
        const done = !!it.add;
        return (
          <View key={it.t + "-" + i}>
            {!!head && <SchHead title={head} top={first ? 8 : 16} />}
            <Pressable onPress={() => open(it)} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 8, marginBottom: 8, borderRadius: 12, borderWidth: 1, borderColor: t.line, backgroundColor: t.surface }}>
              <Image source={thumbUrl(a)} style={{ width: 46, aspectRatio: 63 / 88, borderRadius: 4 }} cachePolicy="disk" />
              <View style={{ flex: 1, minWidth: 0 }}>
                <FitText text={a.name} size={15.7} lines={1} display ace={isAce(a)} style={{ color: t.ink, fontFamily: DISPLAY, fontWeight: "700" }} />
                <Text numberOfLines={1} style={{ marginTop: 2, color: t.ink2, fontFamily: DISPLAY, fontWeight: "600", fontSize: 12.2 }}>
                  {a.code + " · " + (SETBY[hostSet(a)]?.code || "")}
                  {mk(a) ? <Text style={{ color: t.accent }}>{" " + mk(a)}</Text> : null}
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 5 }}>
                  <Text style={{ color: t.ink2, fontSize: 11.8 }}>{new Date(it.t).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</Text>
                  {!it.sure ? <Tag text="dal nome" bg={t.surface2} fg={t.ink2} /> : null}
                  <Tag text={done ? "Aggiunta" : "Da aggiungere"} bg={(done ? t.ok : t.accent) + "24"} fg={done ? t.ok : t.accent} />
                </View>
              </View>
              {/* copie e ✕: toccandoli non si apre la scansione */}
              <Pressable onPress={() => {}} style={{ alignItems: "flex-end", gap: 6 }}>
                <QtyControl
                  size={34}
                  value={owned(a)}
                  onSet={(v) => {
                    setQty(a, v);
                    if (!it.add) {
                      it.add = 1;
                      saveHistory();
                    }
                  }}
                />
                <Pressable
                  onPress={() => {
                    SCH.splice(SCH.indexOf(it), 1);
                    saveHistory();
                    refresh();
                  }}
                  accessibilityLabel="Togli dalla cronologia"
                  hitSlop={6}
                  style={{ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" }}
                >
                  <ScIco name="x" color={t.ink2} size={16} />
                </Pressable>
              </Pressable>
            </Pressable>
          </View>
        );
      })}
      <Btn label="Torna a scansionare" icon={CAM} height={46} onPress={close} style={{ marginTop: 8 }} />
      <ConfirmBox
        visible={cfm}
        title={["Svuotare la cronologia delle scansioni?"]}
        text="La cronologia di tutte le scansioni effettuate verrà cancellata definitivamente."
        ok="Svuota"
        onOk={() => {
          setHistory([]);
          refresh();
        }}
        onClose={() => setCfm(false)}
      />
    </Sheet>
  );
}
