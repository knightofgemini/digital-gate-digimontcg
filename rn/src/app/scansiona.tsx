// Scansione delle carte con la fotocamera (come nell'app attuale): si inquadra la carta nella cornice, l'app legge il numero
// (o il nome) e propone le versioni ordinate per somiglianza; si segnano le copie e la scansione resta in cronologia.
// Anche da una foto della galleria. Nessuna foto viene inviata o salvata.
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Platform, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { DISPLAY, Text } from "../Text";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card, SETBY, fullUrl, hostSet, thumbUrl, verLabel } from "../data";
import { QtyControl } from "../items";
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
  const [status, setStatus] = useState("Avvio la fotocamera…");
  const [warn, setWarn] = useState(false);
  const [ready, setReady] = useState(false); // riconoscimento pronto
  const [camOk, setCamOk] = useState(false);
  const [torch, setTorch] = useState(false);
  const [res, setRes] = useState<ScanResult | null>(null);
  const [hist, setHist] = useState(false);
  const [view, setV] = useState({ w: width, h: height });
  const live = useRef(true);
  const busy = useRef(false);
  const tries = useRef(0);
  const cur = useRef<ScanItem | null>(null);

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
      if (stop || !live.current || busy.current) return;
      setStatus(tries.current >= 4 ? "Avvicina la carta, tienila ferma e con buona luce" : "Inquadra la carta dentro la cornice");
      setWarn(tries.current >= 4);
      busy.current = true;
      try {
        const p = await cam.current?.takePictureAsync({ base64: true, quality: 0.5, shutterSound: false });
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
  const again = () => {
    tries.current = 0;
    cur.current = null;
    setRes(null);
  };
  const close = () => (router.canGoBack() ? router.back() : router.replace("/carte"));

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }} onLayout={(e) => setV({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      <Engine />
      {perm?.granted && <CameraView ref={cam} style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }} facing="back" enableTorch={torch} onCameraReady={() => setCamOk(true)} onMountError={() => setCamOk(false)} animateShutter={false} />}
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
      {res && <Result r={res} cur={cur.current} again={again} openHist={() => setHist(true)} />}
      {hist && <History close={() => setHist(false)} />}
    </View>
  );
}

const SCICO: Record<string, string[]> = {
  x: ["M6 6l12 12M18 6L6 18"],
  torch: ["M8 3h8l-1 5H9z", "M9 8l1 13h4l1-13", "M12 12v3"],
  pic: ["M5.5 4.5h13a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2z", "M20.5 16l-5-5-8.5 8.5"],
  hist: ["M3.5 12a8.5 8.5 0 1 0 2.6-6.1", "M3 4.5V9h4.5", "M12 7.5V12l3 2"],
};
function ScIco({ name, color, size = 22 }: { name: string; color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {SCICO[name].map((d) => (
        <Path key={d} d={d} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      ))}
      {name === "pic" ? <Circle cx={9} cy={10} r={1.8} stroke={color} strokeWidth={2} fill="none" /> : null}
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

function Sheet({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  const { height } = useWindowDimensions();
  return (
    <SafeAreaView edges={["bottom"]} style={{ position: "absolute", left: 0, right: 0, bottom: 0, maxHeight: height * 0.78, backgroundColor: t.bg, borderTopLeftRadius: 18, borderTopRightRadius: 18 }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>{children}</ScrollView>
    </SafeAreaView>
  );
}

// risultato: carta trovata, eventuali alternative ("Forse era"), versioni ordinate per somiglianza, copie
function Result({ r, cur, again, openHist }: { r: ScanResult; cur: ScanItem | null; again: () => void; openHist: () => void }) {
  const t = useTheme();
  useStore();
  const [ci, setCi] = useState(0);
  const code = r.codes[ci];
  const vers0 = scVers(code);
  const [vers, setVers] = useState<{ a: Card; d: number | null }[]>(vers0.map((a) => ({ a, d: null })));
  const [sel, setSel] = useState<Card>(vers0[0]);
  const [best, setBest] = useState<Card | null>(null);
  const picked = useRef(false);
  useEffect(() => {
    const v = scVers(code);
    setVers(v.map((a) => ({ a, d: null })));
    setSel(v[0]);
    setBest(null);
    picked.current = false;
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
  return (
    <Sheet>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={{ color: r.sure ? "#46bd73" : "#c77a0a", fontWeight: "800", flex: 1 }}>{r.sure ? "✓ Carta riconosciuta" : "? Riconosciuta dal nome: controlla"}</Text>
        <Pressable onPress={openHist}>
          <Text style={{ color: t.accent, fontWeight: "700" }}>Cronologia · {SCH.length}</Text>
        </Pressable>
      </View>
      {sel && (
        <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
          <Pressable onPress={() => openCard(sel)}>
            <Image source={fullUrl(sel)} placeholder={thumbUrl(sel)} style={{ width: 110, aspectRatio: 0.716, borderRadius: 8 }} cachePolicy="disk" />
          </Pressable>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ color: t.ink2 }}>{sel.code + (mk(sel) ? "  " + mk(sel) : "") + (sel.rar ? " · " + sel.rar : "")}</Text>
            <Text style={{ color: t.ink, fontSize: 18, fontWeight: "800" }} numberOfLines={2} adjustsFontSizeToFit>
              {sel.name}
            </Text>
            {s && <Text style={{ color: t.accent }}>{s.name}</Text>}
            <Text style={{ color: t.ink2 }}>
              Versione: <Text style={{ color: t.ink, fontWeight: "700" }}>{sel.suf ? (verLabel(sel.ver) || "Alternative Art") + (mk(sel) ? " " + mk(sel) : "") : "Regular"}</Text>
            </Text>
            <Text style={{ color: t.ink, fontWeight: "700", marginTop: 6 }}>Copie possedute</Text>
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
      )}
      {r.codes.length > 1 && (
        <>
          <Text style={{ color: t.ink2, fontWeight: "700", marginTop: 14 }}>Forse era</Text>
          {r.codes.map((cd, i) => {
            const c0 = scVers(cd)[0];
            return (
              <Pressable key={cd} onPress={() => setCi(i)} style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 6, marginTop: 6, borderRadius: 10, borderWidth: i === ci ? 2 : 1, borderColor: i === ci ? t.accent : t.line }}>
                <Image source={thumbUrl(c0)} style={{ width: 36, height: 50, borderRadius: 3 }} cachePolicy="disk" />
                <View>
                  <Text style={{ color: t.ink, fontWeight: "700" }}>{c0.name}</Text>
                  <Text style={{ color: t.ink2, fontSize: 12 }}>{cd + " · " + (SETBY[c0.set]?.name || "")}</Text>
                </View>
              </Pressable>
            );
          })}
        </>
      )}
      <Text style={{ color: t.ink2, fontWeight: "700", marginTop: 14 }}>
        Versioni · {vers.length}
        {vers.length > 1 ? "  —  tocca quella che hai in mano" : ""}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 8 }}>
        {vers.map(({ a }) => (
          <Pressable
            key={a.k}
            onPress={() => {
              picked.current = true;
              setSel(a);
            }}
            style={{ width: 78, alignItems: "center", padding: 4, borderRadius: 10, borderWidth: sel && sel.k === a.k ? 2 : 1, borderColor: sel && sel.k === a.k ? t.accent : t.line }}
          >
            <Image source={thumbUrl(a)} style={{ width: 66, aspectRatio: 0.716, borderRadius: 4 }} cachePolicy="disk" />
            <Text style={{ color: t.ink, fontSize: 11, marginTop: 3 }} numberOfLines={1}>
              {(SETBY[hostSet(a)]?.code || "") + " " + mk(a)}
            </Text>
            {best && best.k === a.k && <Text style={{ color: "#46bd73", fontSize: 10, fontWeight: "800" }}>Più simile</Text>}
          </Pressable>
        ))}
      </ScrollView>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
        <Pressable onPress={() => sel && openCard(sel)} style={{ flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 10, backgroundColor: t.surface2 }}>
          <Text style={{ color: t.ink, fontWeight: "800" }}>Scheda carta</Text>
        </Pressable>
        <Pressable onPress={again} style={{ flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 10, backgroundColor: t.accent }}>
          <Text style={{ color: t.accentInk, fontWeight: "800" }}>Scansiona ancora</Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

// cronologia: per giorno, "Aggiungi tutte alla collezione", copie e rimozione per riga, Svuota
function History({ close }: { close: () => void }) {
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
    <Sheet>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Text style={{ color: t.ink, fontSize: 20, fontWeight: "800", flex: 1 }}>Cronologia</Text>
        {SCH.length > 0 && (
          <Pressable
            onPress={() => {
              if (!cfm) return setCfm(true);
              setHistory([]);
              setCfm(false);
              refresh();
            }}
          >
            <Text style={{ color: "#e5484d", fontWeight: "700" }}>{cfm ? "Sicuro? Svuota" : "Svuota"}</Text>
          </Pressable>
        )}
      </View>
      {!SCH.length ? (
        <Text style={{ color: t.ink2, marginTop: 10, lineHeight: 20 }}>Nessuna scansione. Le carte che scansioni compaiono qui, così puoi rivederle e aggiungerle alla collezione quando vuoi. Restano salvate solo su questo dispositivo.</Text>
      ) : (
        <Text style={{ color: t.ink2, marginTop: 6 }}>{SCH.length + (SCH.length === 1 ? " scansione" : " scansioni") + (todo.length ? " · " + todo.length + " da aggiungere alla collezione" : " · tutte aggiunte alla collezione")}</Text>
      )}
      {todo.length > 0 && (
        <Pressable
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
          style={{ marginTop: 10, alignItems: "center", paddingVertical: 12, borderRadius: 10, backgroundColor: t.accent }}
        >
          <Text style={{ color: t.accentInk, fontWeight: "800" }}>{todo.length === 1 ? "Aggiungi alla collezione (1 copia)" : "Aggiungi tutte alla collezione (" + todo.length + " copie)"}</Text>
        </Pressable>
      )}
      {SCH.map((it, i) => {
        const a = schEntry(it);
        if (!a) return null;
        const dd = dayOf(it.t);
        const head = dd !== day ? (day = dd) : "";
        return (
          <View key={it.t + "-" + i}>
            {!!head && <Text style={{ color: t.ink2, fontWeight: "700", marginTop: 14 }}>{head}</Text>}
            <Pressable onPress={() => openCard(a)} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderColor: t.line, opacity: it.add ? 0.75 : 1 }}>
              <Image source={thumbUrl(a)} style={{ width: 40, height: 56, borderRadius: 3 }} cachePolicy="disk" />
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.ink, fontWeight: "700" }} numberOfLines={1}>
                  {a.name}
                </Text>
                <Text style={{ color: t.ink2, fontSize: 12 }}>{a.code + " · " + (SETBY[hostSet(a)]?.code || "") + (mk(a) ? " " + mk(a) : "")}</Text>
                <Text style={{ color: t.ink2, fontSize: 12 }}>
                  {new Date(it.t).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                  {!it.sure ? " · dal nome" : ""}
                  <Text style={{ color: it.add ? "#46bd73" : t.accent, fontWeight: "700" }}>{it.add ? " · Aggiunta" : " · Da aggiungere"}</Text>
                </Text>
              </View>
              <QtyControl
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
                hitSlop={8}
              >
                <Text style={{ color: t.ink2, fontSize: 16 }}>✕</Text>
              </Pressable>
            </Pressable>
          </View>
        );
      })}
      <Pressable onPress={close} style={{ marginTop: 14, alignItems: "center", paddingVertical: 12, borderRadius: 10, backgroundColor: t.surface2 }}>
        <Text style={{ color: t.ink, fontWeight: "800" }}>Torna a scansionare</Text>
      </Pressable>
    </Sheet>
  );
}
