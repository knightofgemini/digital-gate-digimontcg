// Editor "Tagli della Home" dentro l'app (10 novembre 2026, richiesta dell'utente: centrare da sé le immagini dei
// riquadri della Home senza passare da Claude). Si apre da Altro (voce visibile solo con la chiave, oppure tenendo
// premuta la riga del copyright). Senza chiave: guida per crearla su GitHub e campo per incollarla. Con la chiave: la
// stessa pagina della versione su claude.ai (src/editor/tagli.html) in una WebView, che parla con l'app (ghArt.ts):
// l'app le manda immagini e tagli e scrive su GitHub (ramo home-art) quello che si salva.
import { ReactNode, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { WebView } from "react-native-webview";
import Svg, { Path } from "react-native-svg";
import { DISPLAY, Text, TextInput } from "../Text";
import { useTheme } from "../theme";
import { Btn } from "../visual";
import { EDITOR_HTML } from "../editor/html";
import { RAW, artState } from "../homeArt";
import { NET } from "../data";
import { checkKey, editArt, fetchFresh, getKey, onKey, saveKey, uploadImage } from "../ghArt";

// (i tipi della WebView non vanno d'accordo con React 19: si usa come componente generico, come in scan/Engine.tsx)
const WV: any = WebView;
const NEW_TOKEN = "https://github.com/settings/personal-access-tokens/new";
const SEC_NAME: Record<string, string> = { hero: "In evidenza", cover: "Set da completare", square: "All'orizzonte", prod: "Banner prodotti" };

function Top({ title, right }: { title: string; right?: ReactNode }) {
  const t = useTheme();
  const ins = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: ins.top + 6, paddingBottom: 8, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", gap: 6, borderBottomWidth: 1, borderBottomColor: t.line, backgroundColor: t.bg }}>
      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} accessibilityLabel="Indietro" hitSlop={8} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
        <Svg width={22} height={22} viewBox="0 0 24 24">
          <Path d="M15 5l-7 7 7 7" stroke={t.ink} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </Svg>
      </Pressable>
      <Text style={{ color: t.ink, fontFamily: DISPLAY, fontWeight: "700", fontSize: 18, flex: 1 }} numberOfLines={1}>
        {title}
      </Text>
      {right}
    </View>
  );
}

// ---- senza chiave: come crearla e dove incollarla
function KeySetup() {
  const t = useTheme();
  const ins = useSafeAreaInsets();
  const [k, setK] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const steps = [
    "Apri GitHub con il pulsante qui sotto (devi aver fatto l'accesso con il tuo account).",
    'Token name: scrivi "Digital Gate tagli". Expiration: scegli quanto deve durare (anche "No expiration").',
    'Repository access: "Only select repositories" e scegli digital-gate-digimontcg.',
    'Permissions → Repository permissions → Contents: "Read and write". Il resto lascialo com\'è.',
    'Premi "Generate token", copia la chiave (comincia con github_pat_) e incollala qui sotto.',
  ];
  const save = async () => {
    const v = k.trim();
    if (!v) return setErr("Incolla prima la chiave.");
    setBusy(true);
    setErr("");
    const e = await checkKey(v);
    setBusy(false);
    if (e) return setErr("Non funziona: " + e + ".");
    await saveKey(v);
  };
  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 30 + ins.bottom, gap: 14 }}>
      <Text style={{ color: t.ink, fontSize: 15, lineHeight: 22 }}>
        Per salvare i tagli l'app scrive sul tuo GitHub, nel ramo home-art, e da lì li prendono tutti i telefoni. Serve una chiave che crei tu una volta: resta solo su questo telefono e puoi cancellarla da GitHub quando vuoi.
      </Text>
      {steps.map((s, i) => (
        <View key={i} style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: t.cyanSoft, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: t.cyan, fontFamily: DISPLAY, fontWeight: "700", fontSize: 13 }}>{i + 1}</Text>
          </View>
          <Text style={{ color: t.ink2, fontSize: 14.5, lineHeight: 21, flex: 1 }}>{s}</Text>
        </View>
      ))}
      <Btn label="Apri GitHub" onPress={() => Linking.openURL(NEW_TOKEN)} style={{ alignSelf: "flex-start" }} />
      <TextInput
        value={k}
        onChangeText={setK}
        placeholder="github_pat_…"
        placeholderTextColor={t.ink2}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        accessibilityLabel="Chiave GitHub"
        style={{ color: t.ink, backgroundColor: t.surface, borderWidth: 1, borderColor: t.line, borderRadius: 10, paddingHorizontal: 12, height: 46, fontSize: 15 }}
      />
      {err ? <Text style={{ color: t.accent, fontSize: 14 }}>{err}</Text> : null}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Btn label={busy ? "Controllo…" : "Salva chiave"} pri onPress={busy ? () => {} : save} />
        {busy ? <ActivityIndicator color={t.cyan} /> : null}
      </View>
    </ScrollView>
  );
}

// ---- editor: la pagina in una WebView
function Editor() {
  const t = useTheme();
  const ref = useRef<any>(null);
  const [note, setNote] = useState("");
  const send = (m: any) => ref.current?.injectJavaScript("window.__recv(" + JSON.stringify(m) + ");true;");
  const sendData = () => {
    const s = artState();
    // loghi delle espansioni dal sito (per la pagina "Banner prodotti")
    const logos: Record<string, string> = {};
    Object.keys(s.immagini).forEach((k) => {
      const c = k.replace(/@ban$/, "");
      const u = NET.logo(c);
      if (u) logos[c] = u;
    });
    send({ t: "data", data: { immagini: s.immagini, tagli: s.tagli, logos } });
  };
  const onMessage = async (e: any) => {
    let m: any;
    try {
      m = JSON.parse(e.nativeEvent.data);
    } catch (x) {
      return;
    }
    if (m.t === "ready") {
      // subito quello che c'è nel telefono, poi la versione più recente da GitHub
      sendData();
      fetchFresh()
        .then(() => (sendData(), setNote("")))
        .catch((x: any) => setNote("Non riesco a leggere i tagli da GitHub: " + (x?.message || "errore") + "."));
      return;
    }
    try {
      let res: any = null;
      if (m.t === "upload") {
        res = await uploadImage(m.code, m.b64, m.ext);
      } else if (m.t === "set" || m.t === "del") {
        const [coll, doc] = String(m.path || "").split("/");
        if ((coll !== "tagli" && coll !== "immagini") || !doc) throw new Error("percorso sconosciuto");
        const [code, sec] = doc.split("__");
        const what = coll === "immagini" ? "immagine di " + doc : code + " · " + (SEC_NAME[(sec || "").split("@")[0]] || sec) + ((sec || "").includes("@") ? " (" + sec.split("@")[1] + ")" : "");
        await editArt((s) => {
          const box = coll === "tagli" ? s.tagli : s.immagini;
          if (m.t === "set") box[doc] = m.body;
          else delete box[doc];
        }, "Tagli della Home: " + (m.t === "del" ? "tolto " : "") + what);
      }
      send({ id: m.id, res });
      if (m.t !== "upload") sendData();
    } catch (x: any) {
      send({ id: m.id, err: (x && x.message) || "errore" });
    }
  };
  return (
    <View style={{ flex: 1, backgroundColor: "#0b1120" }}>
      {note ? <Text style={{ color: t.accent, fontSize: 13.5, paddingHorizontal: 14, paddingVertical: 8 }}>{note}</Text> : null}
      <WV
        ref={ref}
        source={{ html: EDITOR_HTML, baseUrl: RAW }}
        injectedJavaScriptBeforeContentLoaded={"window.__BLOB=" + JSON.stringify(RAW + "img/") + ";true;"}
        originWhitelist={["*"]}
        javaScriptEnabled
        setBuiltInZoomControls={false}
        overScrollMode="never"
        style={{ flex: 1, backgroundColor: "#0b1120" }}
        onMessage={onMessage}
      />
    </View>
  );
}

export default function Tagli() {
  const t = useTheme();
  const [key, setKeyState] = useState(getKey());
  useEffect(() => onKey(() => setKeyState(getKey())), []);
  const forget = () =>
    Alert.alert("Togliere la chiave?", "L'app non potrà più salvare i tagli da questo telefono finché non ne incolli una. Per disattivarla del tutto cancellala anche su GitHub.", [
      { text: "Annulla", style: "cancel" },
      { text: "Togli", style: "destructive", onPress: () => saveKey("") },
    ]);
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Top
        title="Tagli della Home"
        right={
          key ? (
            <Pressable onPress={forget} hitSlop={8} style={{ paddingHorizontal: 10, paddingVertical: 6 }}>
              <Text style={{ color: t.ink2, fontSize: 13.5, fontWeight: "600" }}>Chiave</Text>
            </Pressable>
          ) : null
        }
      />
      {key ? <Editor /> : <KeySetup />}
    </View>
  );
}
