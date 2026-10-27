// Foglio "Filtri" dal basso (come .mfsheet dell'app attuale sul telefono): titolo con "Azzera", griglia a tre colonne
// di menù a tendina (.dd: Cerca in, Colore, Tipologia, Livello solo per i Digimon, Costo, Attributo, Tipo, Rarità,
// Espansione) e "Mostra N carte". Ogni tendina apre il suo elenco (.ddpop) sopra o sotto il pulsante, al massimo metà
// schermo: Colore, Attributo e Tipo a scelta multipla (l'elenco resta aperto, caselle da spuntare), gli altri a scelta
// singola; Livello, Costo, Rarità ed Espansione a griglia; Tipo con il campo per cercare in fondo.
// Le parole delle carte restano in inglese.
import { useMemo, useRef, useState } from "react";
import { Animated, PanResponder, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { Sheet, SheetScrollView } from "./Sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { DISPLAY, Text, TextInput } from "./Text";
import { COLORS, SETBY, fold } from "./data";
import { DDN, EMPTY, Filters, Kind, MARKV, MULTI, ddFix, ddKinds, ddOptions, ddShown, ddValues, fl } from "./filters";
import { useKbH } from "./chrome";
import { useTheme } from "./theme";
import { Chevron, FltChip } from "./BottomBar";

// segno ★ / ★★ / SP nelle tendine e nelle etichette (rarIcon)
function RarLab({ v, size, color }: { v: string; size: number; color: string }) {
  const t = useTheme();
  if (v === "SP")
    return (
      <View style={{ backgroundColor: t.ink2, borderRadius: 3, paddingHorizontal: 3, paddingVertical: 1 }}>
        <Text style={{ color: t.bg, fontWeight: "700", fontSize: size * 0.62, lineHeight: size * 0.75 }}>SP</Text>
      </View>
    );
  return <Text style={{ color, fontSize: size * (v === "★★" ? 0.8 : 0.85), lineHeight: size * 1.2 }}>{v}</Text>;
}

// pallino "tutti i colori" a spicchi
function Pie({ size }: { size: number }) {
  const t = useTheme();
  const ks = Object.keys(COLORS),
    r = size / 2;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {ks.map((k, i) => {
        const a0 = (i / ks.length) * 2 * Math.PI - Math.PI / 2,
          a1 = ((i + 1) / ks.length) * 2 * Math.PI - Math.PI / 2;
        const d = `M${r} ${r}L${r + r * Math.cos(a0)} ${r + r * Math.sin(a0)}A${r} ${r} 0 0 1 ${r + r * Math.cos(a1)} ${r + r * Math.sin(a1)}Z`;
        return <Path key={k} d={d} fill={t.cards[k]} />;
      })}
    </Svg>
  );
}

// etichette dei filtri attivi (.mbchip) e "Azzera", sopra la ricerca in basso
export function fltActive(f: Filters, lockExp?: boolean): [Kind, string, string][] {
  const a: [Kind, string, string][] = [];
  if (f.qm) a.push(["qm", f.qm, f.qm === "name" ? "Solo nel nome" : "Solo nel testo"]);
  fl(f, "color").forEach((v) => a.push(["color", v, v]));
  if (f.ct) a.push(["ct", f.ct, f.ct]);
  if (f.lv) a.push(["lv", f.lv, f.lv]);
  if (f.cost) a.push(["cost", f.cost, "Costo " + f.cost]);
  fl(f, "attr").forEach((v) => a.push(["attr", v, v]));
  fl(f, "sp").forEach((v) => a.push(["sp", v, v]));
  if (f.rar) a.push(["rar", f.rar, f.rar]);
  if (f.exp && SETBY[f.exp] && !lockExp) a.push(["exp", f.exp, SETBY[f.exp].code]);
  return a;
}
export function ActiveChips({ f, setF, lockExp }: { f: Filters; setF: (f: Filters) => void; lockExp?: boolean }) {
  const t = useTheme();
  const act = fltActive(f, lockExp);
  if (!act.length) return null;
  return (
    <>
      {act.map(([k, v, label]) => (
        <FltChip
          key={k + v}
          label={label}
          dot={k === "color" ? t.cards[v] : undefined}
          onPress={() => {
            const n = { ...f };
            n[k] = MULTI[k]
              ? fl(f, k)
                  .filter((x) => x !== v)
                  .join("|")
              : "";
            setF(k === "ct" ? ddFix(n) : n);
          }}
        >
          {k === "rar" && MARKV[v] != null ? <RarLab v={v} size={13.1} color={t.ink} /> : undefined}
        </FltChip>
      ))}
      <Pressable onPress={() => setF({ ...EMPTY, exp: lockExp ? f.exp : "" })} hitSlop={6} style={{ minHeight: 34, justifyContent: "center", paddingHorizontal: 6 }}>
        <Text style={{ color: t.cyan, fontFamily: DISPLAY, fontWeight: "700", fontSize: 13.1 }}>Azzera</Text>
      </Pressable>
    </>
  );
}
export const fltCount = (f: Filters, lockExp?: boolean) => fltActive(f, lockExp).length;

type Rect = { x: number; y: number; w: number; h: number };

// lockExp: pagina di un prodotto (l'espansione è il prodotto). Con onExp la tendina Espansione mostra il prodotto (expCur):
// sceglierne un altro apre quel prodotto, "Tutte le espansioni" porta a Ricerca carte con gli stessi filtri
export function FilterSheet({ visible, f: f0, setF: setF0, onClose, count, lockExp, expCur, onExp }: { visible: boolean; f: Filters; setF: (f: Filters) => void; onClose: () => void; count: number; lockExp?: boolean; expCur?: string; onExp?: (v: string) => void }) {
  const f = onExp ? { ...f0, exp: expCur || "" } : f0;
  const setF = (n: Filters) => setF0(onExp ? { ...n, exp: f0.exp } : n);
  const t = useTheme();
  const ins = useSafeAreaInsets();
  const { width: vw, height: vh } = useWindowDimensions();
  const [dd, setDd] = useState<{ kind: Kind; r: Rect } | null>(null);
  // altezza vera della finestra del foglio (su alcuni telefoni diversa da quella dello schermo)
  const [mh, setMh] = useState(0);
  const refs = useRef<Record<string, any>>({});
  const kinds = ddKinds(f).filter((k) => !(lockExp && k === "exp" && !onExp));

  function setK(kind: Kind, v: string) {
    let n: Filters = { ...f, [kind]: v };
    if (kind === "ct") n = ddFix(n);
    setF(n);
  }
  function toggle(kind: Kind, v: string) {
    if (!v) return setK(kind, "");
    const a = fl(f, kind);
    const i = a.indexOf(v);
    if (i >= 0) a.splice(i, 1);
    else a.push(v);
    // stesso ordine dell'app attuale (colori come nell'elenco dei colori, attributi e tipi come nella tendina)
    const ord = kind === "color" ? Object.keys(COLORS) : ddValues(kind, f);
    a.sort((x, y) => ord.indexOf(x) - ord.indexOf(y));
    setK(kind, a.join("|"));
  }
  function open(kind: Kind) {
    if (dd && dd.kind === kind) return setDd(null);
    const node = refs.current[kind];
    if (!node) return;
    node.measureInWindow((x: number, y: number, w: number, h: number) => setDd({ kind, r: { x, y, w, h } }));
  }
  const close = () => (dd ? setDd(null) : onClose());

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      onBack={close}
      maxH={0.82}
      overlay={
        <>
          <View pointerEvents="none" onLayout={(e) => setMh(Math.round(e.nativeEvent.layout.height))} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
          {dd ? (
          <>
            <Pressable style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} onPress={() => setDd(null)} />
            <DDPop key={dd.kind} kind={dd.kind} r={dd.r} f={f} vw={vw} vh={mh || vh} onClose={() => setDd(null)} pick={(v) => (MULTI[dd.kind] ? toggle(dd.kind, v) : dd.kind === "exp" && onExp ? (setDd(null), v !== f.exp && onExp(v)) : (setK(dd.kind, v), setDd(null)))} />
          </>
        ) : null}
        </>
      }
      style={{ backgroundColor: t.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, borderColor: t.line, boxShadow: "0 -14px 36px rgba(0,0,0,.35)", paddingHorizontal: 14, paddingBottom: 14 + ins.bottom }}
    >
        <Pressable onPress={onClose} accessibilityLabel="Chiudi i filtri" style={{ height: 26, alignItems: "center", justifyContent: "center" }}>
          <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: t.line }} />
        </Pressable>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <Text style={{ color: t.ink, fontFamily: DISPLAY, fontWeight: "700", fontSize: 19.2 }}>Filtri</Text>
          <Pressable onPress={() => setF({ ...EMPTY, exp: lockExp ? f.exp : "" })} hitSlop={6} style={{ minHeight: 40, justifyContent: "center" }}>
            <Text style={{ color: t.cyan, fontFamily: DISPLAY, fontWeight: "700", fontSize: 15.2 }}>Azzera</Text>
          </Pressable>
        </View>
        <SheetScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ paddingVertical: 6, flexDirection: "row", flexWrap: "wrap", gap: 6 }} keyboardShouldPersistTaps="handled" onScrollBeginDrag={() => setDd(null)}>
          {kinds.map((kind) => {
            const on = !!f0[kind]; // nella pagina di un prodotto l'Espansione mostra il prodotto ma non è un filtro attivo
            const exp = dd && dd.kind === kind;
            const cols = fl(f, "color");
            return (
              <Pressable
                key={kind}
                ref={(n) => {
                  refs.current[kind] = n;
                }}
                onPress={() => open(kind)}
                accessibilityLabel={DDN[kind] + ": " + ddShown(kind, f)}
                style={{ width: (vw - 28 - 12) / 3 - 0.5, height: 46, flexDirection: "row", alignItems: "center", gap: 4, paddingLeft: 10, paddingRight: 6, borderRadius: 11, borderWidth: on ? 1.5 : 1, borderColor: on || exp ? t.cyan : t.line, backgroundColor: on ? t.cyanSoft : t.surface }}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: on ? t.cyan : t.ink2, opacity: on ? 0.8 : 1, fontFamily: DISPLAY, fontWeight: "600", fontSize: 9.6, lineHeight: 11, letterSpacing: 1.15, textTransform: "uppercase" }} numberOfLines={1}>
                    {DDN[kind]}
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                    {kind === "color" && f.color ? cols.map((c) => <View key={c} style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.cards[c] }} />) : null}
                    {kind === "rar" && MARKV[f.rar] != null ? (
                      <RarLab v={f.rar} size={13.8} color={t.cyan} />
                    ) : (
                      <Text style={{ flexShrink: 1, color: on ? t.cyan : t.ink, fontWeight: "600", fontSize: 13.8, lineHeight: 16 }} numberOfLines={1}>
                        {ddShown(kind, f)}
                      </Text>
                    )}
                  </View>
                </View>
                <View style={{ width: 18, alignItems: "center" }}>
                  <Chevron color={t.ink2} up={!!exp} size={16} />
                </View>
              </Pressable>
            );
          })}
        </SheetScrollView>
        <Pressable onPress={onClose} style={{ marginTop: 14, height: 52, borderRadius: 14, backgroundColor: t.accent, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: t.accentInk, fontFamily: DISPLAY, fontWeight: "700", fontSize: 16 }}>Mostra {count + (count === 1 ? " carta" : " carte")}</Text>
        </Pressable>
    </Sheet>
  );
}

// elenco di una tendina (.ddpop.boxed)
function DDPop({ kind, r, f, vw, vh, pick, onClose }: { kind: Kind; r: Rect; f: Filters; vw: number; vh: number; pick: (v: string) => void; onClose: () => void }) {
  const t = useTheme();
  // tirando giù l'elenco già in cima la tendina segue il dito, sfuma e si chiude (come ddDrag dell'app attuale);
  // con un piccolo trascinamento torna al suo posto
  const dy = useRef(new Animated.Value(0)).current;
  const sy = useRef(0);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, g) => sy.current <= 0 && g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx) * 1.2,
      onPanResponderMove: (_, g) => dy.setValue(Math.max(0, g.dy - 8)),
      onPanResponderRelease: (_, g) => {
        const d = Math.max(0, g.dy - 8);
        if (d > 70 || (g.vy > 0.45 && d > 16)) Animated.timing(dy, { toValue: d + 60, duration: 170, useNativeDriver: true }).start(() => closeRef.current());
        else Animated.spring(dy, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
      },
      onPanResponderTerminate: () => Animated.spring(dy, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start(),
    })
  ).current;
  const [find, setFind] = useState("");
  const opts = useMemo(() => ddOptions(kind, f), [kind, f.ct]);
  const multi = !!MULTI[kind];
  const grid = kind === "lv" || kind === "cost" || kind === "rar" || kind === "exp";
  const w = Math.min(vw - 16, Math.max(r.w, kind === "qm" || kind === "sp" || kind === "exp" ? 280 : 210));
  const left = Math.max(8, Math.min(r.x, vw - w - 8));
  // altezza stimata dell'elenco: sopra il pulsante se sotto non c'è spazio (e sempre per "Cerca in")
  const nOpt = opts.filter((o) => o[0] !== null).length;
  const ph = grid ? Math.ceil(nOpt / 4) * 50 + opts.filter((o) => o[0] === null).length * 26 + 70 : nOpt * 46 + 16 + (kind === "sp" ? 48 : 0);
  const cap = Math.round(vh / 2),
    below = vh - (r.y + r.h) - 12,
    above = r.y - 12;
  const up = (kind === "qm" && above >= Math.min(ph, 140)) || (ph > below && above > below);
  const pos0 = up ? { bottom: vh - (r.y - 6), maxHeight: Math.max(120, Math.min(cap, above)) } : { top: r.y + r.h + 6, maxHeight: Math.min(cap, Math.max(160, below)) };
  // Tipo con il campo di ricerca: con la tastiera aperta la tendina sale sopra la tastiera (come nell'app attuale)
  const kb = useKbH();
  const insTop = useSafeAreaInsets().top;
  const pos = kind === "sp" && kb > 0 ? { bottom: kb + 8, maxHeight: Math.max(120, Math.min(cap, vh - kb - insTop - 24)) } : pos0;
  const isOn = (v: string) => (multi ? (v === "" ? !f[kind] : fl(f, kind).indexOf(v) >= 0) : (f[kind] || "") === v);
  const ff = fold(find);
  const first = kind === "rar" ? opts.find((o) => o[0] && MARKV[o[0]] != null)?.[0] : null;
  const cellW = (w - 16 - 18) / 4;
  const items: React.ReactNode[] = [];
  opts.forEach((o, i) => {
    if (o[0] === null) {
      items.push(
        <Text key={"g" + i} style={{ width: "100%", paddingTop: items.length ? 8 : 2, paddingHorizontal: 6, paddingBottom: 2, color: t.ink2, fontFamily: DISPLAY, fontWeight: "600", fontSize: 9.9, letterSpacing: 1.2, textTransform: "uppercase" }}>
          {o[1]}
        </Text>
      );
      return;
    }
    const v = o[0];
    if (ff && (i === 0 || fold(o[1]).indexOf(ff) < 0)) return;
    const on = isOn(v);
    const all = i === 0;
    if (first && v === first) items.push(<View key="br" style={{ width: "100%" }} />);
    items.push(
      <Pressable
        key={v || "all"}
        onPress={() => pick(v)}
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        style={[
          { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 10, backgroundColor: on ? t.cyanSoft : "transparent" },
          grid && !all ? { width: cellW, justifyContent: "center", paddingHorizontal: 4, borderWidth: 1, borderColor: on ? t.cyan : t.line } : { paddingHorizontal: 12, width: grid ? "100%" : undefined },
        ]}
      >
        {kind === "color" ? all ? <Pie size={15} /> : <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: t.cards[v] }} /> : null}
        {kind === "rar" && MARKV[v] != null ? (
          <RarLab v={v} size={14.1} color={on ? t.cyan : t.ink} />
        ) : (
          <Text style={{ color: on ? t.cyan : t.ink, fontWeight: on ? "700" : "500", fontSize: grid ? 14.1 : 15.2, lineHeight: 20, flexShrink: 1 }} numberOfLines={1} adjustsFontSizeToFit={grid} minimumFontScale={0.75}>
            {o[1]}
          </Text>
        )}
        {multi && !all ? (
          <View style={{ marginLeft: "auto", width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, borderColor: on ? t.cyan : t.line, backgroundColor: on ? t.cyan : "transparent", alignItems: "center", justifyContent: "center" }}>
            {on ? (
              <Svg width={10} height={8} viewBox="0 0 10 8">
                <Path d="M1 4l3 3 5-6" stroke="#fff" strokeWidth={2} fill="none" />
              </Svg>
            ) : null}
          </View>
        ) : (on || multi) && !grid ? (
          <Text style={{ marginLeft: "auto", color: t.cyan, fontWeight: "700", opacity: multi && !on ? 0 : 1 }}>✓</Text>
        ) : null}
      </Pressable>
    );
  });
  return (
    <Animated.View {...pan.panHandlers} style={{ position: "absolute", left, width: w, ...pos, borderRadius: 14, borderWidth: 1, borderColor: t.line, backgroundColor: t.surface, boxShadow: "0 14px 40px rgba(0,0,0,.25)", overflow: "hidden", opacity: dy.interpolate({ inputRange: [0, 187], outputRange: [1, 0.15], extrapolate: "clamp" }), transform: [{ translateY: dy }] }}>
      <ScrollView style={{ flexShrink: 1 }} onScroll={(e) => void (sy.current = e.nativeEvent.contentOffset.y)} scrollEventThrottle={16} contentContainerStyle={[{ paddingVertical: 8, paddingHorizontal: 6, gap: grid ? 6 : 2 }, grid ? { flexDirection: "row", flexWrap: "wrap" } : null]} keyboardShouldPersistTaps="handled">
        {items}
      </ScrollView>
      {kind === "sp" ? (
        <TextInput value={find} onChangeText={setFind} placeholder="Cerca un tipo, es. Dragonkin" placeholderTextColor={t.ink2} autoCorrect={false} returnKeyType="done" style={{ height: 48, paddingHorizontal: 12, borderTopWidth: 1, borderColor: t.line, backgroundColor: t.surface2, color: t.ink, fontSize: 16 }} />
      ) : null}
    </Animated.View>
  );
}
