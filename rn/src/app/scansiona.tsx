// Scansione delle carte con la fotocamera (come nell'app attuale): si inquadra la carta nella cornice, l'app legge il numero
// (o il nome) e propone le versioni ordinate per somiglianza; si segnano le copie e la scansione resta in cronologia.
// Anche da una foto della galleria. Nessuna foto viene inviata o salvata.
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
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
  const fw = Math.min(view.w * 0.72, (view.h * 0.55) * 0.716),
    fh = fw / 0.716,
    fx = (view.w - fw) / 2,
    fy = (view.h - fh) / 2 - 20;

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
      {/* cornice */}
      <View pointerEvents="none" style={{ position: "absolute", left: fx, top: fy, width: fw, height: fh, borderRadius: 14, borderWidth: 3, borderColor: res ? "#46bd73" : "rgba(255,255,255,.9)" }} />
      <SafeAreaView style={{ position: "absolute", left: 0, right: 0, top: 0 }} edges={["top"]}>
        <View style={{ flexDirection: "row", alignItems: "center", padding: 12, gap: 12 }}>
          <Btn label="✕" onPress={close} />
          <Text style={{ flex: 1, color: "#fff", fontSize: 18, fontWeight: "800", textAlign: "center" }}>Scansiona una carta</Text>
          <Btn label="🔦" on={torch} onPress={() => setTorch(!torch)} />
        </View>
        {!!status && !res && !hist && (
          <View style={{ alignSelf: "center", backgroundColor: warn ? "rgba(192,38,30,.85)" : "rgba(0,0,0,.6)", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, marginHorizontal: 16 }}>
            <Text style={{ color: "#fff", fontWeight: "600", textAlign: "center" }}>{status}</Text>
          </View>
        )}
      </SafeAreaView>
      {!res && !hist && (
        <SafeAreaView edges={["bottom"]} style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}>
          <View style={{ flexDirection: "row", gap: 10, padding: 16 }}>
            <Pressable onPress={fromPhoto} style={{ flex: 1, alignItems: "center", paddingVertical: 14, borderRadius: 14, backgroundColor: camOk ? "rgba(255,255,255,.18)" : t.accent }}>
              <Text style={{ color: camOk ? "#fff" : t.accentInk, fontWeight: "800" }}>Usa una foto</Text>
            </Pressable>
            <Pressable onPress={() => setHist(true)} style={{ flex: 1, alignItems: "center", paddingVertical: 14, borderRadius: 14, backgroundColor: "rgba(255,255,255,.18)" }}>
              <Text style={{ color: "#fff", fontWeight: "800" }}>Cronologia{SCH.length ? " · " + SCH.length : ""}</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      )}
      {res && <Result r={res} cur={cur.current} again={again} openHist={() => setHist(true)} />}
      {hist && <History close={() => setHist(false)} />}
    </View>
  );
}

function Btn({ label, onPress, on }: { label: string; onPress: () => void; on?: boolean }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: on ? "#ff7a3d" : "rgba(0,0,0,.5)" }}>
      <Text style={{ color: "#fff", fontSize: 18, fontWeight: "800" }}>{label}</Text>
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
