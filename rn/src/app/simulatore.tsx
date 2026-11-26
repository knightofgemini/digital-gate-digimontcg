// Simulatore (ramo `simulatore`, 26 novembre 2026, richiesta dell'utente): partita contro il telefono con i mazzi base
// ST1 Gaia Red e ST2 Cocytus Blue. Regole ed effetti in `src/sim/engine.ts`, animazioni in `src/sim/fx.tsx`.
// Tavolo sul modello di Aegis (verticale) e di Digimon Alysion (orizzontale, fascia della memoria a monete, pulsante
// rotondo del turno, Sicurezza come fila di carte coperte), con i colori di Digital Gate e le immagini delle carte
// dell'app. Questa schermata può girare in orizzontale (expo-screen-orientation); uscendo torna verticale.
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, PanResponder, Platform, Pressable, ScrollView, useWindowDimensions, View } from "react-native";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as ScreenOrientation from "expo-screen-orientation";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { DISPLAY, Text } from "../Text";
import { BYCODE, Card, fullUrl, thumbUrl, useData } from "../data";
import { Rich } from "../rich";
import { CardInst, DECKS, Def, Fx, Game, Opt, SIM_CODES, Sim, SimUI, Stack, toDef } from "../sim/engine";
import { av, Box, FX, FxLayer, measure, PULSE, REFS, resetAV, ROOT, run, sp, tm, wait } from "../sim/fx";

const C = {
  bg: "#0a0f24",
  bg2: "#141b3a",
  line: "#2c3a72",
  ink: "#eef2ff",
  mut: "#9aa6c7",
  acc: "#38d6f5",
  gold: "#f5c542",
  pink: "#ff5fb3",
  red: "#e0414c",
  blue: "#2f86ea",
  ok: "#7dffa8",
  opp: "#3fd6a6",
};
const COL: Record<string, string> = { Red: "#e0414c", Blue: "#2f86ea", Yellow: "#e2b21a", Green: "#2e9e57", Black: "#555", Purple: "#8a4fd0", White: "#c4cad6" };
let SPEED = 1;
const W8 = (ms: number) => wait(ms * SPEED);

function cardOf(code: string): Card | undefined {
  const l = BYCODE[code] || [];
  return l.find((c) => !c.suf) || l[0];
}

// ---- carte ----
function Face({ code, w, h, big }: { code: string; w: number; h: number; big?: boolean }) {
  const c = cardOf(code);
  return (
    <View style={{ width: w, height: h, borderRadius: Math.max(4, w * 0.06), overflow: "hidden", backgroundColor: "#1b2340" }}>
      {/* sotto l'immagine (mentre si carica o se manca): colore, livello e nome */}
      {c ? (
        <View style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }}>
          <View style={{ height: h * 0.22, backgroundColor: COL[c.colors[0]] || "#444", paddingHorizontal: 3, justifyContent: "center" }}>
            <Text style={{ color: "#fff", fontFamily: DISPLAY, fontWeight: "700", fontSize: Math.max(7, w * 0.15) }}>{c.lv || c.ct}</Text>
          </View>
          <Text numberOfLines={3} style={{ color: C.ink, fontWeight: "600", fontSize: Math.max(7, w * 0.14), lineHeight: Math.max(8, w * 0.17), padding: 3 }}>{c.name}</Text>
        </View>
      ) : null}
      {c ? <Image source={thumbUrl(c)} style={{ width: w, height: h }} contentFit="cover" cachePolicy="disk" recyclingKey={code} transition={120} /> : null}
      {/* grande: sopra la miniatura (già salvata), così non resta mai vuota mentre l'immagine grande arriva */}
      {c && big ? <Image source={fullUrl(c)} style={{ position: "absolute", left: 0, top: 0, width: w, height: h }} contentFit="cover" cachePolicy="disk" recyclingKey={code + "f"} transition={150} /> : null}
    </View>
  );
}
function Back({ w, h, red }: { w: number; h: number; red?: boolean }) {
  return (
    <Svg width={w} height={h} viewBox="0 0 43 60">
      <Defs>
        <LinearGradient id={"bk" + (red ? "r" : "b")} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={red ? "#c0303c" : "#2c4bb8"} />
          <Stop offset="1" stopColor={red ? "#5a1018" : "#121c52"} />
        </LinearGradient>
      </Defs>
      <Rect x={0.5} y={0.5} width={42} height={59} rx={3.5} fill={`url(#bk${red ? "r" : "b"})`} stroke={red ? "#ff9aa3" : "#7f95e6"} />
      <Circle cx={21.5} cy={30} r={11} stroke="#ffffff55" strokeWidth={1.4} fill="none" />
      <Circle cx={21.5} cy={30} r={6} stroke="#ffffff88" strokeWidth={1.4} fill="none" />
    </Svg>
  );
}

// trascinamento (26 novembre 2026, richiesta dell'utente): carta della mano su un proprio Digimon = digievolvi, sul
// campo = gioca/usa; Digimon in campo su un Digimon avversario sospeso = attacca, sulla Sicurezza o sul campo avversario
// = attacca il giocatore. Il tocco resta per la scheda della carta.
type DragView = { src: string; code: string; w: number; h: number; keys: string[]; hover: string | null; label: string | null; arrow?: boolean };
type DragFns = { begin: (kind: "hand" | "stack", u: string, gx: number, gy: number) => boolean; move: (gx: number, gy: number) => void; end: (cancel: boolean) => void };
type Ctx = { sim: Sim; G: Game; cw: number; ch: number; tap: (k: string) => void; canS: (s: Stack) => boolean; drag: DragView | null; dfn: DragFns };
function useDragPan(kind: "hand" | "stack", u: string, dfn: DragFns) {
  const r = useRef({ kind, u, dfn });
  r.current = { kind, u, dfn };
  return useMemo(() => {
    const want = (g: { dx: number; dy: number; x0: number; y0: number }) => (Math.abs(g.dy) > 10 || Math.abs(g.dx) > 14 ? r.current.dfn.begin(r.current.kind, r.current.u, g.x0, g.y0) : false);
    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_e, g) => want(g),
      onMoveShouldSetPanResponderCapture: (_e, g) => want(g),
      onPanResponderMove: (_e, g) => r.current.dfn.move(g.moveX, g.moveY),
      onPanResponderRelease: () => r.current.dfn.end(false),
      onPanResponderTerminate: () => r.current.dfn.end(true),
      onPanResponderTerminationRequest: () => false,
    });
  }, []);
}

function StackView({ s, owner, x, sz }: { s: Stack; owner: 0 | 1; x: Ctx; sz?: [number, number] }) {
  const { sim } = x;
  const [cw, ch] = sz || [x.cw, x.ch];
  const a = av(s.u);
  const sr = useRef(new Animated.Value(s.susp ? 1 : 0)).current;
  useEffect(() => {
    sp(sr, s.susp ? 1 : 0, 7, 50).start();
  }, [s.susp]);
  const code = sim.topCode(s),
    d = sim.DB[code];
  const dpv = d.t === "Digimon" ? sim.dp(owner, s) : null;
  const mod = dpv != null ? dpv - d.dp : 0;
  const n = sim.nsrc(s);
  const can = x.canS(s);
  const sa = d.t === "Digimon" ? sim.secA(owner, s) - 1 : 0;
  const rot = Animated.add(Animated.multiply(sr, 90), a.rot).interpolate({ inputRange: [-720, 720], outputRange: ["-720deg", "720deg"] });
  const pan = useDragPan("stack", s.u, x.dfn);
  const hi = !!x.drag && x.drag.keys.includes(s.u);
  const hov = !!x.drag && x.drag.hover === s.u;
  const src = !!x.drag && x.drag.src === s.u && !x.drag.arrow;
  return (
    <View {...pan.panHandlers} style={{ opacity: src ? 0.35 : 1, transform: [{ scale: hov ? 1.08 : 1 }] }}>
    <Pressable onPress={() => x.tap(s.u)} style={{ width: cw + 10, height: ch + 18, alignItems: "center", justifyContent: "center" }}>
      {n ? (
        <View style={{ position: "absolute", top: 0, left: 2, zIndex: 3, flexDirection: "row", alignItems: "center", backgroundColor: C.pink, borderRadius: 8, paddingHorizontal: 5 }}>
          <Text style={{ color: "#2b0018", fontFamily: DISPLAY, fontWeight: "700", fontSize: 10.5 }}>×{n + 1}</Text>
        </View>
      ) : null}
      {mod ? (
        <View style={{ position: "absolute", top: 0, right: 0, zIndex: 3, backgroundColor: "#0b0f22", borderWidth: 1, borderColor: mod > 0 ? C.ok : C.red, borderRadius: 8, paddingHorizontal: 4 }}>
          <Text style={{ color: mod > 0 ? C.ok : C.red, fontFamily: DISPLAY, fontWeight: "700", fontSize: 10.5 }}>{(mod > 0 ? "+" : "") + mod}</Text>
        </View>
      ) : null}
      <Animated.View
        ref={(r: any) => {
          REFS.set(s.u, r);
        }}
        collapsable={false}
        style={{ width: cw, height: ch, opacity: a.op, transform: [{ translateX: a.tx }, { translateY: a.ty }, { rotate: rot }, { scale: a.sc }] }}
      >
        {/* carte sotto, appena sporgenti */}
        {n ? <View style={{ position: "absolute", left: 3, top: 4, width: cw, height: ch, borderRadius: 5, backgroundColor: "#0b0f22", borderWidth: 1, borderColor: "#ffffff33" }} /> : null}
        {can && !x.drag ? <Animated.View style={{ position: "absolute", left: -4, top: -4, right: -4, bottom: -4, borderRadius: 8, borderWidth: 2.5, borderColor: C.acc, opacity: PULSE.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }) }} /> : null}
        {hi ? <Animated.View style={{ position: "absolute", left: -5, top: -5, right: -5, bottom: -5, borderRadius: 9, borderWidth: hov ? 4 : 2.5, borderColor: hov ? "#fff" : C.gold, opacity: hov ? 1 : PULSE.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }} /> : null}
        <Face code={code} w={cw} h={ch} />
        <Animated.View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, borderRadius: 5, backgroundColor: "#fff", opacity: a.flash }} />
        <Animated.View pointerEvents="none" style={{ position: "absolute", left: -6, top: -6, right: -6, bottom: -6, borderRadius: 10, borderWidth: 3, borderColor: C.gold, opacity: a.glow }} />
        {dpv != null ? (
          <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "#0b0f22dd", paddingVertical: 1, alignItems: "center", borderBottomLeftRadius: 5, borderBottomRightRadius: 5 }}>
            <Text style={{ color: mod > 0 ? C.ok : C.ink, fontFamily: DISPLAY, fontWeight: "700", fontSize: Math.max(10, cw * 0.2) }}>{dpv}</Text>
          </View>
        ) : null}
      </Animated.View>
      {d.t === "Digimon" ? (
        <View style={{ position: "absolute", right: -2, top: 18, zIndex: 3, gap: 3 }}>
          {s.noAB >= x.G.turn ? <Ico bg="#555" ring="#bbb" t="✕" /> : sim.blocker(s) ? <Ico bg="#2f6fe0" ring="#cfe0ff" t="B" /> : null}
          {sa > 0 ? <Ico bg={C.red} ring="#ffd2d6" t={"+" + sa} /> : null}
        </View>
      ) : null}
    </Pressable>
    </View>
  );
}
const Ico = ({ bg, ring, t }: { bg: string; ring: string; t: string }) => (
  <View style={{ width: 19, height: 19, borderRadius: 10, backgroundColor: bg, borderWidth: 2, borderColor: ring, alignItems: "center", justifyContent: "center" }}>
    <Text style={{ color: "#fff", fontWeight: "700", fontSize: 8.5 }}>{t}</Text>
  </View>
);

function HandCard({ c, i, n, w, h, can, onPress, mx, x }: { c: CardInst; i: number; n: number; w: number; h: number; can: boolean; onPress: () => void; mx: number; x: Ctx }) {
  const a = av(c.u);
  const off = i - (n - 1) / 2;
  const pan = useDragPan("hand", c.u, x.dfn);
  const src = !!x.drag && x.drag.src === c.u;
  return (
    <View {...pan.panHandlers} style={{ opacity: src ? 0.3 : 1 }}>
    <Pressable onPress={onPress} style={{ width: w, height: h + 10, marginHorizontal: mx }}>
      <Animated.View
        ref={(r: any) => {
          REFS.set(c.u, r);
        }}
        collapsable={false}
        style={{ width: w, height: h, opacity: a.op, transform: [{ translateX: a.tx }, { translateY: Animated.add(a.ty, Math.abs(off) * Math.abs(off) * 1.6) }, { rotate: off * 3.5 + "deg" }, { scale: a.sc }] }}
      >
        {can ? <Animated.View style={{ position: "absolute", left: -3, top: -3, right: -3, bottom: -3, borderRadius: 7, borderWidth: 2.5, borderColor: C.acc, opacity: PULSE.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }} /> : null}
        <Face code={c.c} w={w} h={h} />
        <Animated.View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, borderRadius: 5, backgroundColor: "#fff", opacity: a.flash }} />
      </Animated.View>
    </Pressable>
    </View>
  );
}

// ---- pile ----
function Pile({ label, n, kind, top, w, h, onPress, rk, noN }: { label: string; n: number; kind: "deck" | "egg" | "trash"; top?: string; w: number; h: number; onPress?: () => void; rk?: string; noN?: boolean }) {
  return (
    <Pressable onPress={onPress} style={{ alignItems: "center" }}>
      <Text style={{ color: C.mut, fontSize: 9.5, marginBottom: 2 }}>{label}</Text>
      <Animated.View
        ref={(r: any) => {
          if (rk) REFS.set(rk, r);
        }}
        collapsable={false}
        style={{ width: w, height: h, borderRadius: 5, alignItems: "center", justifyContent: "center", borderWidth: kind === "trash" && !top ? 1 : 0, borderStyle: "dashed", borderColor: "#4a5690", transform: rk ? [{ translateX: av(rk).tx }, { translateY: av(rk).ty }, { rotate: av(rk).rot.interpolate({ inputRange: [-90, 90], outputRange: ["-90deg", "90deg"] }) }] : [] }}
      >
        {kind === "deck" && n ? <Back w={w} h={h} /> : null}
        {kind === "egg" && n ? (
          <View style={{ width: w, height: h, borderRadius: 5, backgroundColor: "#dfe9ff", borderWidth: 1, borderColor: "#fff", alignItems: "center", justifyContent: "center" }}>
            <Svg width={w * 0.5} height={w * 0.62} viewBox="0 0 20 25">
              <Path d="M10 1C5 1 1.5 9 1.5 15a8.5 8.5 0 0 0 17 0C18.5 9 15 1 10 1z" fill="#9fc2ff" stroke="#4a6fd0" strokeWidth={1.2} />
            </Svg>
          </View>
        ) : null}
        {kind === "trash" && top ? (
          <View style={{ opacity: 0.85 }}>
            <Face code={top} w={w} h={h} />
          </View>
        ) : null}
        {noN ? <Text style={{ color: "#56628a", fontSize: 9.5 }}>empty</Text> : <View style={{ position: "absolute", right: -5, bottom: -5, backgroundColor: "#0b0f22", borderWidth: 1, borderColor: C.line, borderRadius: 9, paddingHorizontal: 5 }}>
          <Text style={{ color: C.ink, fontFamily: DISPLAY, fontWeight: "700", fontSize: 11 }}>{n}</Text>
        </View>}
      </Animated.View>
    </Pressable>
  );
}
// Sicurezza: scudo con il numero e, sotto, le carte coperte messe di traverso una sopra l'altra come sul tavolo
// (richiesta dell'utente, 26 novembre 2026)
function HBack({ w, h, red }: { w: number; h: number; red?: boolean }) {
  return (
    <Svg width={w} height={h} viewBox="0 0 60 43">
      <Defs>
        <LinearGradient id={"hb" + (red ? "r" : "b")} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={red ? "#c0303c" : "#2c4bb8"} />
          <Stop offset="1" stopColor={red ? "#5a1018" : "#121c52"} />
        </LinearGradient>
      </Defs>
      <Rect x={0.5} y={0.5} width={59} height={42} rx={3.5} fill={`url(#hb${red ? "r" : "b"})`} stroke={red ? "#ff9aa3" : "#7f95e6"} />
      <Circle cx={30} cy={21.5} r={11} stroke="#ffffff55" strokeWidth={1.4} fill="none" />
      <Circle cx={30} cy={21.5} r={6} stroke="#ffffff88" strokeWidth={1.4} fill="none" />
    </Svg>
  );
}
function Security({ n, i, x, compact }: { n: number; i: 0 | 1; w?: number; row?: boolean; x?: Ctx; compact?: boolean }) {
  const hov = !!(x && x.drag && x.drag.hover === "sec" + i);
  const hi = !!(x && x.drag && x.drag.keys.includes("sec" + i));
  const cw = compact ? 36 : 42,
    chh = Math.round(cw * 0.716),
    base = compact ? 4 : 6;
  // altezza fissa della pila: con meno carte si allargano (richiesta dell'utente)
  const room = base * 4,
    step = n > 1 ? Math.min(base * 2.4, room / (n - 1)) : 0;
  const inA = useRef(new Animated.Value(1)).current;
  // la carta che se ne va scivola via a destra e svanisce
  const out = useRef(new Animated.Value(0)).current;
  const last = useRef(n);
  useEffect(() => {
    if (n < last.current) {
      out.setValue(1);
      tm(out, 0, 450).start();
    } else if (n > last.current) {
      inA.setValue(0);
      sp(inA, 1, 7, 90).start();
    }
    last.current = n;
  }, [n]);
  return (
    <View
      ref={(r: any) => {
        REFS.set("sec" + i, r);
      }}
      collapsable={false}
      style={{ alignItems: "center", padding: 3, borderRadius: 12, borderWidth: hi ? 2 : 0, borderColor: hov ? "#fff" : C.gold, backgroundColor: hov ? "#ff5a4f33" : "transparent", transform: [{ scale: hov ? 1.1 : 1 }] }}
    >
      <View style={{ width: 40, height: 46, alignItems: "center", justifyContent: "center", zIndex: 2 }}>
        <Svg width={40} height={46} viewBox="0 0 40 46" style={{ position: "absolute" }}>
          <Path d="M20 1 39 7v18c0 10-8 17-19 20C9 42 1 35 1 25V7z" fill={i ? "#1b3c96" : "#8d1c2a"} stroke={i ? "#6f9bff" : "#ff8a94"} strokeWidth={1.5} />
        </Svg>
        <Text style={{ color: "#fff", fontFamily: DISPLAY, fontWeight: "700", fontSize: 20 }}>{n}</Text>
      </View>
      <View style={{ width: cw + 4, height: chh + room + 2, marginTop: -4 }}>
        {Array.from({ length: n }, (_, k) =>
          k === n - 1 ? (
            <Animated.View key={k} style={{ position: "absolute", left: 2, top: k * step, opacity: inA, transform: [{ translateX: inA.interpolate({ inputRange: [0, 1], outputRange: [-30, 0] }) }, { translateY: inA.interpolate({ inputRange: [0, 1], outputRange: [-18, 0] }) }] }}>
              <HBack w={cw} h={chh} red={!i} />
            </Animated.View>
          ) : (
            <View key={k} style={{ position: "absolute", left: 2, top: k * step, shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 3, elevation: 2 }}>
              <HBack w={cw} h={chh} red={!i} />
            </View>
          ),
        )}
        <Animated.View pointerEvents="none" style={{ position: "absolute", left: 2, top: n * (n > 1 ? step : base), opacity: out, transform: [{ translateX: out.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }, { rotate: out.interpolate({ inputRange: [0, 1], outputRange: ["20deg", "0deg"] }) }] }}>
          <HBack w={cw} h={chh} red={!i} />
        </Animated.View>
      </View>
    </View>
  );
}

// ---- memoria ----
const MEMV = new Animated.Value(0);
function MemBar({ v, width }: { v: number; width: number }) {
  const step = width / 21;
  const d = Math.min(30, step - 2);
  useEffect(() => {
    sp(MEMV, v, 7, 60).start();
  }, [v]);
  return (
    <View style={{ width, height: d + 12, justifyContent: "center" }}>
      <View style={{ position: "absolute", left: step / 2, right: step / 2, height: 4, borderRadius: 2, backgroundColor: "#ffffff1a" }} />
      <View style={{ flexDirection: "row" }}>
        {Array.from({ length: 21 }, (_, k) => {
          const m = k - 10;
          const side = m < 0 ? "o" : m > 0 ? "m" : "z";
          const dim = (v >= 0 && m < 0) || (v <= 0 && m > 0);
          const dd = side === "z" ? Math.min(d * 1.25, step) : d;
          return (
            <View key={k} style={{ width: step, alignItems: "center" }}>
              <View style={{ width: dd, height: dd, borderRadius: dd / 2, alignItems: "center", justifyContent: "center", opacity: dim ? 0.4 : 1, backgroundColor: side === "o" ? "#1d8a6a" : side === "m" ? "#c98a12" : "#c2550f", borderWidth: 2, borderColor: side === "o" ? "#a9ffe0" : side === "m" ? "#fff0b8" : "#ffd2a8" }}>
                <Text style={{ color: side === "m" ? "#3a2500" : "#fff", fontFamily: DISPLAY, fontWeight: "700", fontSize: Math.max(8, dd * 0.42) }}>{Math.abs(m)}</Text>
              </View>
            </View>
          );
        })}
      </View>
      <Animated.View
        pointerEvents="none"
        style={{ position: "absolute", left: step / 2 - (d + 10) / 2, width: d + 10, height: d + 10, borderRadius: (d + 10) / 2, borderWidth: 3, borderColor: "#fff", shadowColor: "#fff", shadowOpacity: 1, shadowRadius: 8, elevation: 6, transform: [{ translateX: MEMV.interpolate({ inputRange: [-10, 10], outputRange: [0, step * 20] }) }] }}
      />
    </View>
  );
}

// ---- sovrapposizioni ----
function BannerV({ text, op, small }: { text: string; op: boolean; small?: boolean }) {
  const p = useRef(new Animated.Value(0)).current;
  const { width } = useWindowDimensions();
  useEffect(() => {
    run(Animated.sequence([tm(p, 1, 280), Animated.delay(small ? 380 : 620), tm(p, 2, 260, Easing.in(Easing.cubic))]));
  }, []);
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: "40%", alignItems: "center" }}>
      <Animated.View style={{ width: "100%", paddingVertical: small ? 8 : 14, alignItems: "center", backgroundColor: op ? "#3d78e8e6" : "#ff5fb3e6", opacity: p.interpolate({ inputRange: [0, 0.4, 1, 1.6, 2], outputRange: [0, 1, 1, 1, 0] }), transform: [{ translateX: p.interpolate({ inputRange: [0, 1, 2], outputRange: [-width, 0, width] }) }, { scaleY: p.interpolate({ inputRange: [0, 1, 2], outputRange: [0.4, 1, 0.6] }) }] }}>
        <Text style={{ color: "#fff", fontFamily: DISPLAY, fontWeight: "700", fontStyle: "italic", fontSize: small ? 20 : 28, letterSpacing: 1, textTransform: "uppercase", textShadowColor: "#0006", textShadowRadius: 6 }}>{text}</Text>
      </Animated.View>
    </View>
  );
}
function RevealV({ e, sim }: { e: Extract<Fx, { k: "reveal" }>; sim: Sim }) {
  const flip = useRef(new Animated.Value(0)).current;
  const inA = useRef(new Animated.Value(0)).current;
  const res = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    run(Animated.sequence([tm(inA, 1, 260), tm(flip, 1, 420, Easing.inOut(Easing.cubic)), Animated.delay(250), sp(res, 1, 5, 90)]));
  }, []);
  const w = 104,
    h = 145;
  const sd = sim.DB[e.sec],
    ad = sim.DB[e.atk];
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "#05081acc", alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={{ width: 330, maxWidth: "94%", backgroundColor: C.bg2, borderRadius: 18, borderWidth: 1, borderColor: C.line, padding: 14, alignItems: "center", opacity: inA, transform: [{ scale: inA.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] }}>
        <Text style={{ color: C.mut, fontFamily: DISPLAY, fontWeight: "700", fontSize: 13, letterSpacing: 1.5 }}>SECURITY CHECK</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 }}>
          <View style={{ alignItems: "center", width: 120 }}>
            <View style={{ width: w, height: h }}>
              <Animated.View style={{ position: "absolute", opacity: flip.interpolate({ inputRange: [0, 0.5, 0.51, 1], outputRange: [1, 1, 0, 0] }), transform: [{ perspective: 600 }, { rotateY: flip.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] }) }] }}>
                <Back w={w} h={h} red={e.pi === 0} />
              </Animated.View>
              <Animated.View style={{ position: "absolute", opacity: flip.interpolate({ inputRange: [0, 0.5, 0.51, 1], outputRange: [0, 0, 1, 1] }), transform: [{ perspective: 600 }, { rotateY: flip.interpolate({ inputRange: [0, 1], outputRange: ["-180deg", "0deg"] }) }] }}>
                <Face code={e.sec} w={w} h={h} big />
              </Animated.View>
            </View>
            <Text numberOfLines={1} style={{ color: C.ink, fontFamily: DISPLAY, fontWeight: "700", fontSize: 13, marginTop: 6 }}>{sd.n}</Text>
            <Text style={{ color: C.acc, fontFamily: DISPLAY, fontWeight: "700", fontSize: 18 }}>{e.secDp != null ? e.secDp + " DP" : sd.t}</Text>
          </View>
          <Text style={{ color: C.gold, fontFamily: DISPLAY, fontWeight: "700", fontStyle: "italic", fontSize: 22 }}>VS</Text>
          <Animated.View style={{ alignItems: "center", width: 120, transform: [{ translateX: inA.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) }] }}>
            <Face code={e.atk} w={w} h={h} />
            <Text numberOfLines={1} style={{ color: C.ink, fontFamily: DISPLAY, fontWeight: "700", fontSize: 13, marginTop: 6 }}>{ad.n}</Text>
            <Text style={{ color: C.acc, fontFamily: DISPLAY, fontWeight: "700", fontSize: 18 }}>{e.atkDp} DP</Text>
          </Animated.View>
        </View>
        <Animated.View style={{ marginTop: 10, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10, backgroundColor: e.lost ? "#7a1b25" : "#164a3a", opacity: res, transform: [{ scale: res.interpolate({ inputRange: [0, 1], outputRange: [1.8, 1] }) }] }}>
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>{e.res}</Text>
        </Animated.View>
      </Animated.View>
    </View>
  );
}
function EffectV({ e, sim, land }: { e: Extract<Fx, { k: "effect" }>; sim: Sim; land: boolean }) {
  const p = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    run(Animated.sequence([sp(p, 1, 8, 70), Animated.delay(900 * SPEED), tm(p, 0, 220)]));
  }, []);
  const d = sim.DB[e.code];
  return (
    <Animated.View pointerEvents="none" style={{ position: "absolute", right: 8, top: land ? 40 : "22%", width: 190, backgroundColor: "#0b0f22f0", borderRadius: 14, borderWidth: 1, borderColor: e.pi ? "#3d78e8" : C.pink, padding: 8, alignItems: "center", opacity: p, transform: [{ translateX: p.interpolate({ inputRange: [0, 1], outputRange: [220, 0] }) }] }}>
      <Face code={e.code} w={86} h={120} big />
      <Text style={{ color: C.mut, fontSize: 10.5, marginTop: 5 }}>Effect resolution · {e.pi ? "opponent" : "you"}</Text>
      <Text style={{ color: C.ink, fontFamily: DISPLAY, fontWeight: "700", fontSize: 13 }} numberOfLines={1}>{d.n}</Text>
      <Text style={{ color: "#c4cde9", fontSize: 11, marginTop: 3 }} numberOfLines={4}>{e.text}</Text>
    </Animated.View>
  );
}
function EndV({ win, onNew, onClose }: { win: boolean; onNew: () => void; onClose: () => void }) {
  const p = useRef(new Animated.Value(0)).current;
  const rays = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    sp(p, 1, 5, 60).start();
    Animated.loop(Animated.timing(rays, { toValue: 1, duration: 9000, easing: Easing.linear, useNativeDriver: true })).start();
  }, []);
  return (
    <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "#05081add", alignItems: "center", justifyContent: "center" }}>
      <Animated.View pointerEvents="none" style={{ position: "absolute", opacity: 0.35, transform: [{ rotate: rays.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }] }}>
        <Svg width={520} height={520} viewBox="-50 -50 100 100">
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i / 12) * Math.PI * 2;
            const b = a + 0.18;
            return <Path key={i} d={`M0 0L${Math.cos(a) * 50} ${Math.sin(a) * 50}L${Math.cos(b) * 50} ${Math.sin(b) * 50}z`} fill={win ? C.gold : "#5b6a9a"} />;
          })}
        </Svg>
      </Animated.View>
      <Animated.View style={{ alignItems: "center", opacity: p, transform: [{ scale: p.interpolate({ inputRange: [0, 1], outputRange: [2.2, 1] }) }] }}>
        <Text style={{ color: win ? C.gold : "#c4cde9", fontFamily: DISPLAY, fontWeight: "700", fontStyle: "italic", fontSize: 46, textShadowColor: "#000", textShadowRadius: 10 }}>{win ? "VICTORY" : "DEFEAT"}</Text>
        <Text style={{ color: C.ink, fontSize: 15, marginTop: 4 }}>{win ? "You won the game!" : "The opponent won the game."}</Text>
        <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
          <Btn label="New game" pri onPress={onNew} />
          <Btn label="View board" onPress={onClose} />
        </View>
      </Animated.View>
    </View>
  );
}
function Btn({ label, pri, onPress, disabled, small }: { label: string; pri?: boolean; onPress?: () => void; disabled?: boolean; small?: boolean }) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => ({ minHeight: small ? 38 : 44, paddingHorizontal: small ? 10 : 14, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: pri ? C.acc : C.bg2, borderWidth: 1, borderColor: pri ? C.acc : C.line, opacity: disabled ? 0.45 : pressed ? 0.75 : 1 })}>
      <Text style={{ color: pri ? "#04212b" : C.ink, fontWeight: "600", fontSize: small ? 12.5 : 14 }}>{label}</Text>
    </Pressable>
  );
}

// foglio dal basso (verticale) o finestra al centro (orizzontale)
function Panel({ land, onClose, children }: { land: boolean; onClose?: () => void; children: React.ReactNode }) {
  const p = useRef(new Animated.Value(0)).current;
  const ins = useSafeAreaInsets();
  useEffect(() => {
    tm(p, 1, 220).start();
  }, []);
  return (
    <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, justifyContent: land ? "center" : "flex-end", alignItems: "center" }}>
      <Pressable onPress={onClose} style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "#0009" }} />
      <Animated.View style={{ width: land ? 560 : "100%", maxWidth: "100%", maxHeight: land ? "92%" : "84%", backgroundColor: C.bg2, borderRadius: land ? 18 : 0, borderTopLeftRadius: 18, borderTopRightRadius: 18, borderWidth: 1, borderColor: C.line, paddingBottom: land ? 0 : ins.bottom, opacity: p, transform: [{ translateY: p.interpolate({ inputRange: [0, 1], outputRange: [land ? 20 : 120, 0] }) }] }}>
        <ScrollView contentContainerStyle={{ padding: 14 }}>{children}</ScrollView>
      </Animated.View>
    </View>
  );
}
type Q = { title: string; opts: Opt<any>[]; cancel?: string; body?: string; res: (v: any) => void };
type Sheet = { code: string; src?: string[]; acts: { label: string; sub?: string; pri?: boolean; go: () => Promise<void> }[]; who: string };

export default function Simulatore() {
  // ?demo=1: il telefono gioca da solo con tutti e due i mazzi (Menu → Guarda una partita; usato anche dalla prova su emulatore)
  const params = useLocalSearchParams<{ demo?: string; l?: string }>();
  const demo = useRef(params.demo === "1");
  useData();
  const { width: W, height: H } = useWindowDimensions();
  const ins = useSafeAreaInsets();
  const [layout, setLayout] = useState<"auto" | "h" | "v">("auto");
  const land = W > H;
  const [, setTick] = useState(0);
  const update = () => setTick((t) => t + 1);
  const [q, setQ] = useState<Q | null>(null);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [ban, setBan] = useState<{ text: string; op: boolean; small?: boolean; id: number } | null>(null);
  const [rev, setRev] = useState<Extract<Fx, { k: "reveal" }> | null>(null);
  const [eff, setEff] = useState<(Extract<Fx, { k: "effect" }> & { id: number }) | null>(null);
  const [end, setEnd] = useState<null | boolean>(null);
  const [mull, setMull] = useState<{ hand: string[]; res: (v: boolean) => void } | null>(null);
  const [first, setFirst] = useState<null | 0 | 1>(null);
  const [menu, setMenu] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [deck, setDeck] = useState("red");
  const [speed, setSpeed] = useState(1);
  const alive = useRef(true);
  const [drag, setDrag] = useState<DragView | null>(null);
  const dragSt = useRef<{ tgts: { k: string; label: string; go: () => Promise<void>; box?: Box | null }[]; hover: number; rx: number; ry: number; w: number; h: number; arrow: boolean; sx: number; sy: number } | null>(null);
  const DXY = useRef(new Animated.ValueXY()).current;
  const nid = useRef(0);

  const DB = useMemo(() => {
    const db: Record<string, Def> = {};
    for (const k of SIM_CODES) {
      const c = cardOf(k);
      if (c) db[k] = toDef(c);
    }
    return db;
  }, []);

  const ui: SimUI = {
    ask: (title, opts, cancel, body) => new Promise((res) => setQ({ title, opts, cancel, body, res })),
    update,
    isLive: (g) => alive.current && simRef.current.G === g,
    mulligan: (hand) => new Promise((res) => setMull({ hand, res })),
    fx: async (e) => fxRun(e),
  };
  const simRef = useRef<Sim>(null as any);
  if (!simRef.current) simRef.current = new Sim(DB, ui);
  const sim = simRef.current;
  sim.ui = ui;
  // per le prove nel browser (scripts di prova con Playwright)
  if (Platform.OS === "web") (globalThis as any).__sim = sim;

  async function fxRun(e: Fx) {
    switch (e.k) {
      case "banner":
        setBan({ text: e.text, op: e.op, id: ++nid.current });
        await W8(1200);
        setBan(null);
        return;
      case "phase":
        setBan({ text: e.text, op: false, small: true, id: ++nid.current });
        await W8(900);
        setBan(null);
        return;
      case "mem":
        update();
        await W8(420);
        return;
      case "spawn": {
        const a = av(e.u);
        if (e.how === "draw") {
          if (sim.G.P[1].hand.some((c) => c.u === e.u)) return void (await W8(120));
          a.ty.setValue(140);
          a.op.setValue(0);
          a.sc.setValue(1.2);
          await run(Animated.parallel([sp(a.ty, 0, 7, 55), tm(a.op, 1, 220), sp(a.sc, 1)]));
          return;
        }
        if (e.how === "evo") {
          a.flash.setValue(1);
          a.sc.setValue(1.45);
          a.glow.setValue(1);
          await W8(30);
          const b = await measure(e.u);
          if (b) {
            FX.ring(b.cx, b.cy, C.gold, 170);
            FX.burst(b.cx, b.cy, C.gold, true);
          }
          await run(Animated.parallel([tm(a.flash, 0, 520), sp(a.sc, 1, 5, 60), tm(a.glow, 0, 900)]));
          return;
        }
        if (e.how === "hatch") {
          a.sc.setValue(0.1);
          a.rot.setValue(-30);
          await W8(30);
          const b = await measure(e.u);
          if (b) FX.burst(b.cx, b.cy, "#9fc2ff");
          await run(Animated.parallel([sp(a.sc, 1, 4, 70), sp(a.rot, 0, 3, 80)]));
          return;
        }
        if (e.how === "move") {
          a.sc.setValue(0.5);
          a.op.setValue(0);
          await run(Animated.parallel([sp(a.sc, 1), tm(a.op, 1, 250)]));
          return;
        }
        // play, sec, free: la carta cala dall'alto sul tavolo
        a.sc.setValue(1.9);
        a.op.setValue(0);
        a.ty.setValue(-30);
        a.flash.setValue(0.8);
        await run(Animated.parallel([tm(a.sc, 1, 340, Easing.in(Easing.cubic)), tm(a.op, 1, 200), tm(a.ty, 0, 340, Easing.in(Easing.cubic))]));
        const b = await measure(e.u);
        if (b) {
          FX.ring(b.cx, b.cy, e.how === "sec" ? C.pink : C.acc, 130);
          FX.burst(b.cx, b.cy, e.how === "sec" ? C.pink : C.acc);
        }
        await run(tm(a.flash, 0, 300));
        return;
      }
      case "attack": {
        const A = await measure(e.from),
          B = await measure(e.to);
        if (!A || !B) return;
        const a = av(e.from);
        const dx = (B.cx - A.cx) * 0.78,
          dy = (B.cy - A.cy) * 0.78;
        a.glow.setValue(1);
        await run(Animated.parallel([tm(a.sc, 1.12, 150), tm(a.ty, -dy * 0.08, 150)]));
        await run(Animated.parallel([tm(a.tx, dx, 230, Easing.in(Easing.quad)), tm(a.ty, dy, 230, Easing.in(Easing.quad))]));
        FX.slash(B.cx, B.cy, "#ff5a4f");
        FX.burst(B.cx, B.cy, "#ffb347", true);
        if (!e.to.startsWith("sec")) {
          const t = av(e.to);
          run(Animated.sequence([tm(t.tx, 9, 50), tm(t.tx, -9, 70), tm(t.tx, 6, 60), tm(t.tx, 0, 60)]));
        }
        await run(Animated.parallel([sp(a.tx, 0, 6, 60), sp(a.ty, 0, 6, 60), sp(a.sc, 1), tm(a.glow, 0, 400)]));
        return;
      }
      case "block": {
        const b = await measure(e.u);
        if (b) FX.shield(b.cx, b.cy);
        await W8(750);
        return;
      }
      case "clash": {
        const A = await measure(e.a),
          B = await measure(e.b);
        if (A) FX.float(A.cx, A.y, String(e.da), e.da >= e.db ? C.ok : "#ff8a94");
        if (B) FX.float(B.cx, B.y, String(e.db), e.db >= e.da ? C.ok : "#ff8a94");
        await W8(700);
        return;
      }
      case "delete": {
        const a = av(e.u);
        const b = await measure(e.u);
        if (b) {
          FX.burst(b.cx, b.cy, "#ff5a4f", true);
          FX.ring(b.cx, b.cy, "#ff5a4f", 140);
        }
        a.flash.setValue(1);
        await run(Animated.parallel([tm(a.sc, 0.2, 460, Easing.in(Easing.cubic)), tm(a.op, 0, 460), tm(a.rot, 40, 460)]));
        return;
      }
      case "bounce": {
        const a = av(e.u);
        await run(Animated.parallel([tm(a.ty, -70, 380, Easing.in(Easing.cubic)), tm(a.op, 0, 380), tm(a.sc, 0.6, 380)]));
        return;
      }
      case "reveal":
        setRev(e);
        await W8(2300);
        setRev(null);
        return;
      case "buff": {
        const b = await measure(e.u);
        if (b) {
          FX.float(b.cx, b.y, "+" + e.n, C.ok);
          FX.ring(b.cx, b.cy, C.ok, 120);
        }
        const a = av(e.u);
        a.glow.setValue(1);
        await run(tm(a.glow, 0, 700));
        return;
      }
      case "effect":
        setEff({ ...e, id: ++nid.current });
        await W8(1400);
        setEff(null);
        return;
      case "trashSrc": {
        const b = await measure(e.u);
        if (b) FX.float(b.cx, b.y, "−" + e.n + (e.n > 1 ? " cards" : " card"), "#ff8a94");
        const a = av(e.u);
        await run(Animated.sequence([tm(a.tx, 7, 50), tm(a.tx, -7, 70), tm(a.tx, 0, 60)]));
        await W8(300);
        return;
      }
      case "unsusp":
        await W8(380);
        return;
      case "first":
        setFirst(e.pi);
        await W8(2200);
        setFirst(null);
        return;
      case "shuffle": {
        setBan({ text: "Shuffling", op: false, small: true, id: ++nid.current });
        const runs = [0, 1].map(async (i) => {
          const a = av("deck" + i);
          const b = await measure("deck" + i);
          if (b) FX.burst(b.cx, b.cy, i ? "#6f9bff" : "#ff8a94");
          await run(Animated.sequence([0, 1, 2, 3, 4].map((k) => Animated.parallel([tm(a.tx, k % 2 ? -7 : 7, 90), tm(a.rot, k % 2 ? -9 : 9, 90)])).concat([Animated.parallel([sp(a.tx, 0), sp(a.rot, 0)])])));
        });
        await Promise.all(runs);
        await W8(250);
        setBan(null);
        return;
      }
      case "secAdd":
        await W8(140);
        return;
      case "end":
        for (let k = 0; k < 3; k++) FX.burst(W / 2 + (k - 1) * 90, H * 0.4, e.win === 0 ? C.gold : "#7f95e6", true);
        await W8(500);
        if (demo.current) {
          // partita dimostrativa: dopo la fine ne parte un'altra
          const g = sim.G;
          setTimeout(() => alive.current && sim.G === g && newGame(), 3500);
          return;
        }
        setEnd(e.win === 0);
        return;
    }
  }

  // ---- partita ----
  async function newGame(key = deck) {
    alive.current = true;
    resetAV();
    setEnd(null);
    setQ(null);
    setSheet(null);
    const G = sim.newGame(key);
    G.P[0].ai = demo.current;
    G.busy = true;
    update();
    await sim.setup();
    if (sim.G !== G) return;
    await sim.startTurn();
    if (sim.G === G) {
      G.busy = false;
      update();
    }
  }
  useEffect(() => {
    let ok = true;
    (async () => {
      try {
        let [l, d, s] = await Promise.all([AsyncStorage.getItem("sim-layout"), AsyncStorage.getItem("sim-deck"), AsyncStorage.getItem("sim-speed")]);
        if (!ok) return;
        // ?l=h / ?l=v: disposizione scelta dal collegamento (prova su emulatore)
        if (params.l === "h" || params.l === "v") l = params.l;
        if (l === "h" || l === "v") setLayout(l);
        if (d && DECKS[d]) setDeck(d);
        if (s) setSpeed((SPEED = parseFloat(s) || 1));
        applyLayout(l === "h" || l === "v" ? l : "auto");
        newGame(d && DECKS[d] ? d : "red");
      } catch {
        newGame();
      }
    })();
    return () => {
      ok = false;
      alive.current = false;
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, []);
  function applyLayout(l: "auto" | "h" | "v") {
    const O = ScreenOrientation.OrientationLock;
    // "segue il telefono" = SCREEN_ORIENTATION_FULL_USER (13): gira col telefono ma rispetta il blocco della rotazione
    // (unlockAsync tornerebbe al verticale fisso di app.json)
    (l === "h" ? ScreenOrientation.lockAsync(O.LANDSCAPE) : l === "v" ? ScreenOrientation.lockAsync(O.PORTRAIT_UP) : Platform.OS === "android" ? ScreenOrientation.lockPlatformAsync({ screenOrientationConstantAndroid: 13 }) : ScreenOrientation.lockAsync(O.ALL)).catch(() => {});
  }

  const G = sim.G;
  if (!G) return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  const me = G.P[0],
    op = G.P[1];
  const myMain = G.cur === 0 && G.phase === "main" && G.over == null && !G.busy;
  const act = async (fn: () => Promise<void>) => {
    if (G.busy || G.over != null) return;
    G.busy = true;
    update();
    try {
      await fn();
      await sim.after();
    } finally {
      if (sim.G === G) {
        G.busy = false;
        update();
      }
    }
  };
  const canHand = (c: CardInst) => myMain && (sim.canUse(0, c) || sim.evoTargets(0, c).some(() => sim.canPay(sim.DB[c.c].ec || 0)));
  const x: Ctx = {
    sim,
    G,
    cw: 0,
    ch: 0,
    canS: (s) => myMain && sim.canAtk(0, s),
    tap: (u) => tapStack(u),
    drag,
    dfn: { begin: dragBegin, move: dragMove, end: dragEnd },
  };

  // ---- trascinamento ----
  type Tgt = { k: string; label: string; go: () => Promise<void>; box?: Box | null };
  function dragBegin(kind: "hand" | "stack", u: string, gx: number, gy: number) {
    if (!myMain || dragSt.current) return false;
    let code = "",
      tg: Tgt[] = [];
    if (kind === "hand") {
      const c = me.hand.find((z) => z.u === u);
      if (!c) return false;
      const d = sim.DB[c.c];
      code = c.c;
      for (const s of sim.evoTargets(0, c)) if (sim.canPay(d.ec || 0)) tg.push({ k: s.u, label: "Digivolve " + sim.top(s).n, go: () => sim.evo(0, c, s) });
      if (sim.canUse(0, c)) tg.push({ k: "zone0", label: d.t === "Option" ? "Use " + d.n : "Play " + d.n, go: () => sim.play(0, c) });
    } else {
      const s = me.field.find((z) => z.u === u);
      if (!s || !sim.canAtk(0, s)) return false;
      code = sim.topCode(s);
      for (const t of sim.digis(1).filter((z) => z.susp)) tg.push({ k: t.u, label: "Attack " + sim.top(t).n, go: () => sim.attack(0, s, t) });
      tg.push({ k: "sec1", label: "Attack the player", go: () => sim.attack(0, s, "p") });
      tg.push({ k: "zone1", label: "Attack the player", go: () => sim.attack(0, s, "p") });
    }
    if (!tg.length) return false;
    const w = Math.round(Math.max(cw, 56) * 1.15),
      h = Math.round(w * 1.396);
    // dal campo: niente carta che si sposta ma una freccia dal Digimon al bersaglio (richiesta dell'utente)
    const arrow = kind === "stack";
    const st = { tgts: tg, hover: -1, rx: 0, ry: 0, w, h, arrow, sx: -1, sy: -1 };
    dragSt.current = st;
    DXY.setValue({ x: gx - w / 2, y: gy - h * 0.85 });
    ROOT.v?.measureInWindow((rx: number, ry: number) => {
      st.rx = rx;
      st.ry = ry;
    });
    if (arrow)
      measure(u).then((b) => {
        if (b) {
          st.sx = b.cx;
          st.sy = b.cy;
        }
      });
    tg.forEach((t) => measure(t.k).then((b) => (t.box = b)));
    setDrag({ src: u, code, w, h, keys: tg.map((t) => t.k), hover: null, label: null, arrow });
    return true;
  }
  function dragMove(gx: number, gy: number) {
    const st = dragSt.current;
    if (!st) return;
    const px = gx - st.rx,
      py = gy - st.ry;
    if (st.arrow) {
      if (st.sx >= 0) ARROW.set?.({ x1: st.sx, y1: st.sy, x2: px, y2: py });
    } else DXY.setValue({ x: px - st.w / 2, y: py - st.h * 0.85 });
    // prima i Digimon (più piccoli), poi Sicurezza e campo
    const i = st.tgts.findIndex((t) => t.box && px >= t.box.x - 8 && px <= t.box.x + t.box.w + 8 && py >= t.box.y - 8 && py <= t.box.y + t.box.h + 8);
    if (i !== st.hover) {
      st.hover = i;
      const t = i >= 0 ? st.tgts[i] : null;
      setDrag((d) => d && { ...d, hover: t ? t.k : null, label: t ? t.label : null });
    }
  }
  function dragEnd(cancel: boolean) {
    const st = dragSt.current;
    dragSt.current = null;
    const t = !cancel && st && st.hover >= 0 ? st.tgts[st.hover] : null;
    ARROW.set?.(null);
    setDrag(null);
    if (t) act(t.go);
  }

  function tapStack(u: string) {
    if (G.busy && !(G.cur === 1)) return;
    for (const i of [0, 1] as const) {
      const p = G.P[i];
      const s = [...p.field, p.breed].find((z) => z && z.u === u);
      if (!s) continue;
      const acts: Sheet["acts"] = [];
      if (i === 0 && myMain && sim.canAtk(0, s)) {
        acts.push({ label: "Attack the player", sub: "DP " + sim.dp(0, s) + (sim.secA(0, s) > 1 ? " · checks " + sim.secA(0, s) + " cards" : ""), pri: true, go: () => sim.attack(0, s, "p") });
        for (const t of sim.digis(1).filter((z) => z.susp)) acts.push({ label: "Attack " + sim.top(t).n, sub: "DP " + sim.dp(0, s, t) + " vs " + sim.dp(1, t, s), go: () => sim.attack(0, s, t) });
      }
      setSheet({ code: sim.topCode(s), src: s.cards.slice(0, -1).map((c) => sim.DB[c.c].n), acts, who: i ? "Opponent" : p.breed === s ? "Breeding area" : "Battle area" });
      return;
    }
  }
  function tapHand(c: CardInst) {
    const d = sim.DB[c.c];
    const acts: Sheet["acts"] = [];
    if (myMain) {
      if (sim.canUse(0, c)) acts.push({ label: d.t === "Option" ? "Use" : "Play", sub: "cost " + d.pc + (G.mem - d.pc < 0 ? " · ends your turn" : ""), pri: true, go: () => sim.play(0, c) });
      for (const s of sim.evoTargets(0, c)) if (sim.canPay(d.ec || 0)) acts.push({ label: "Digivolve " + sim.top(s).n + (s === me.breed ? " (breeding)" : ""), sub: "cost " + d.ec + " · draw 1" + (G.mem - (d.ec || 0) < 0 ? " · ends your turn" : ""), pri: !acts.length, go: () => sim.evo(0, c, s) });
    }
    setSheet({ code: c.c, acts, who: d.t === "Option" && !sim.hasColor(0, d.col) && myMain ? "Needs a " + d.col + " Digimon or Tamer in play" : "In hand" });
  }

  // ---- misure ----
  const usableH = H - ins.top - ins.bottom;
  const memH = 58;
  const bandH = Math.floor((usableH - 14 - memH) / 2);
  let cw: number, ch: number, hw: number, hh: number, pw: number, ph: number;
  if (land) {
    ch = Math.round(Math.max(50, Math.min(96, bandH - 38)));
    cw = Math.round(ch / 1.396);
    hh = Math.round(Math.max(60, Math.min(124, bandH - 14)));
    hw = Math.round(hh / 1.396);
    pw = Math.round(Math.min(bandH < 175 ? 31 : 38, cw * 0.6));
    ph = Math.round(pw * 1.396);
  } else {
    cw = Math.round(Math.max(44, Math.min(66, (W - 40) / 6)));
    ch = Math.round(cw * 1.396);
    hw = Math.round(Math.min(78, cw * 1.12));
    hh = Math.round(hw * 1.396);
    pw = Math.round(Math.min(42, cw * 0.66));
    ph = Math.round(pw * 1.396);
  }
  x.cw = cw;
  x.ch = ch;
  const vMem = G.cur === 0 ? G.mem : -G.mem;

  const battle = (i: 0 | 1, center?: boolean) => {
    const p = G.P[i],
      dg = p.field.filter((s) => sim.top(s).t !== "Tamer"),
      tm_ = p.field.filter((s) => sim.top(s).t === "Tamer");
    return (
      <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, alignItems: "center", justifyContent: center ? "center" : "flex-start", paddingHorizontal: 4 }}>
          {dg.length ? dg.map((s) => <StackView key={s.u} s={s} owner={i} x={x} />) : <Text style={{ color: "#56628a", fontSize: 12, paddingHorizontal: 6 }}>No Digimon in play</Text>}
        </ScrollView>
        <View style={{ borderLeftWidth: 1, borderColor: "#ffffff22", paddingLeft: 4, flexDirection: "row", alignItems: "center", minWidth: 40, minHeight: ch * 0.8 }}>
          {tm_.length ? tm_.map((s) => <StackView key={s.u} s={s} owner={i} x={x} />) : <Text style={{ color: "#56628a", fontSize: 11 }}>Tamers</Text>}
        </View>
      </View>
    );
  };
  const breed = (i: 0 | 1) => {
    const p = G.P[i];
    return p.breed ? (
      <View style={{ alignItems: "center" }}>
        <Text style={{ color: C.mut, fontSize: 9.5 }}>Breeding</Text>
        <StackView s={p.breed} owner={i} x={x} sz={land ? [Math.round(pw * 1.25), Math.round(pw * 1.25 * 1.396)] : undefined} />
      </View>
    ) : (
      <Pile label="Breeding" n={0} kind="trash" w={pw} h={ph} noN />
    );
  };
  const trashTop = (i: 0 | 1) => (G.P[i].trash.length ? G.P[i].trash[G.P[i].trash.length - 1].c : undefined);
  const openTrash = (i: 0 | 1) => setSheet({ code: "", acts: [], who: "trash" + i });
  const piles = (i: 0 | 1) => (
    <>
      <Pile label="Deck" n={G.P[i].deck.length} kind="deck" w={pw} h={ph} rk={"deck" + i} />
      <Pile label="Trash" n={G.P[i].trash.length} kind="trash" top={trashTop(i)} w={pw} h={ph} onPress={() => openTrash(i)} />
    </>
  );
  const eggs = (i: 0 | 1) => <Pile label="Eggs" n={G.P[i].eggs.length} kind="egg" w={pw} h={ph} />;
  const oppHand = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <Text style={{ color: C.mut, fontSize: 11 }}>Hand {op.hand.length}</Text>
      <View style={{ flexDirection: "row", paddingLeft: 8 }}>
        {op.hand.map((c) => (
          <View key={c.u} style={{ marginLeft: -8 }}>
            <Back w={16} h={22} />
          </View>
        ))}
      </View>
    </View>
  );
  const controls = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
      {G.over != null ? (
        <Btn small label="New game" pri onPress={() => newGame()} />
      ) : G.phase === "setup" ? null : G.cur !== 0 ? (
        <Dial label="Opp. turn" off />
      ) : G.phase === "breed" && !G.busy ? (
        <>
          {!me.breed && me.eggs.length ? <Btn small pri label="Hatch" onPress={() => act(async () => (await sim.hatch(0), await sim.toMain()))} /> : null}
          {me.breed && sim.top(me.breed).lv >= 3 ? <Btn small pri label="Move out" onPress={() => act(async () => (await sim.moveOut(0), await sim.toMain()))} /> : null}
          <Btn small label="Skip" onPress={() => act(() => sim.toMain())} />
        </>
      ) : (
        <Dial label="End turn" off={!myMain} onPress={() => act(() => sim.endTurn(true))} />
      )}
    </View>
  );
  const handW = land ? W * 0.3 - 8 : W - 24 - ins.left - ins.right;
  const nH = Math.max(1, me.hand.length);
  // poche carte: si allargano fino a non sovrapporsi (richiesta dell'utente)
  const step = Math.min(hw * 1.06, nH > 1 ? (handW - hw) / (nH - 1) : hw);
  const handMx = -(hw - step) / 2;
  const phaseTxt = G.over != null ? "GAME OVER" : G.phase === "setup" ? "SETUP" : G.phase === "breed" ? "BREEDING" : "MAIN";
  const hand = (
    <View
      ref={(r: any) => {
        REFS.set("hand0", r);
      }}
      collapsable={false}
      style={{ flexDirection: "row", justifyContent: "center", alignItems: "flex-end", paddingHorizontal: -handMx }}
    >
      {me.hand.map((c, i) => (
        <HandCard key={c.u} c={c} i={i} n={me.hand.length} w={hw} h={hh} mx={handMx} x={x} can={canHand(c)} onPress={() => tapHand(c)} />
      ))}
    </View>
  );
  const side = Math.max(170, Math.round(W * 0.21));
  const backBtn = (
    <Pressable onPress={() => router.back()} hitSlop={10} style={{ width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: C.bg2, borderWidth: 1, borderColor: C.line }}>
      <Svg width={20} height={20} viewBox="0 0 24 24">
        <Path d="M15 5l-7 7 7 7" stroke={C.ink} strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </Pressable>
  );
  const top = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <Pressable onPress={() => router.back()} hitSlop={10} style={{ width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: C.bg2, borderWidth: 1, borderColor: C.line }}>
        <Svg width={20} height={20} viewBox="0 0 24 24">
          <Path d="M15 5l-7 7 7 7" stroke={C.ink} strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={{ color: C.ink, fontFamily: DISPLAY, fontWeight: "700", fontSize: 15 }}>Turn {Math.max(1, G.turn)}</Text>
        <Text style={{ color: C.mut, fontSize: 11 }} numberOfLines={1}>{DECKS[me.key].name} vs {DECKS[op.key].name}</Text>
      </View>
      <Btn small label="Log" onPress={() => setLogOpen(true)} />
      <Btn small label="Menu" onPress={() => setMenu(true)} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar hidden={land} style="light" />
      <Mat />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom", "left", "right"]}>
        <View
          ref={(r: any) => {
            ROOT.v = r;
          }}
          collapsable={false}
          style={{ flex: 1 }}
        >
          {land ? (
            <View style={{ flex: 1, padding: 6, gap: 4 }}>
              {/* avversario */}
              <View style={{ height: bandH, flexDirection: "row", gap: 6 }}>
                <View style={{ width: side, justifyContent: "space-between" }}>
                  <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                    {backBtn}
                    <Btn small label="Menu" onPress={() => setMenu(true)} />
                    <Btn small label="Log" onPress={() => setLogOpen(true)} />
                  </View>
                  <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
                    {piles(1)}
                    <View style={{ flex: 1, alignItems: "flex-end" }}>
                      <Text style={{ color: C.ink, fontFamily: DISPLAY, fontWeight: "700", fontSize: 14 }}>Turn {Math.max(1, G.turn)}</Text>
                      <Text style={{ color: C.mut, fontSize: 11 }}>Opp. hand {op.hand.length}</Text>
                    </View>
                  </View>
                </View>
                <Zone fill rk="zone1" x={x}>{battle(1, true)}</Zone>
                <View style={{ width: side, flexDirection: "row", justifyContent: "flex-end", alignItems: "flex-start", gap: 8 }}>
                  <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end", alignSelf: "flex-end" }}>
                    {breed(1)}
                    {eggs(1)}
                  </View>
                  <Security n={op.sec.length} i={1} x={x} compact />
                </View>
              </View>
              {/* memoria */}
              <View style={{ height: memH, flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ flex: 1, alignItems: "center" }}>
                  <MemBar v={vMem} width={Math.min(W - 260 - ins.left - ins.right, 680)} />
                </View>
                <View style={{ backgroundColor: "#1e3fa8", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 }}>
                  <Text style={{ color: "#fff", fontFamily: DISPLAY, fontWeight: "700", fontSize: 11.5 }}>{phaseTxt}</Text>
                </View>
                {controls}
              </View>
              {/* tu */}
              <View style={{ height: bandH, flexDirection: "row", gap: 6 }}>
                <View style={{ width: side, flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
                  <Security n={me.sec.length} i={0} compact />
                  <View style={{ flex: 1, justifyContent: "space-between", height: "100%" }}>
                    <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
                      {eggs(0)}
                      {breed(0)}
                    </View>
                    <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>{piles(0)}</View>
                  </View>
                </View>
                <Zone fill rk="zone0" x={x}>{battle(0, true)}</Zone>
                <View style={{ width: W * 0.3, justifyContent: "flex-end", alignItems: "center", overflow: "visible" }}>{hand}</View>
              </View>
            </View>
          ) : (
            <View style={{ flex: 1, paddingHorizontal: 8, paddingTop: 4 }}>
              {top}
              <View style={{ height: 6 }} />
              <Zone opp rk="zone1" x={x}>
                <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
                  {piles(1)}
                  <View style={{ flex: 1, alignItems: "center" }}>{oppHand}</View>
                  {breed(1)}
                  {eggs(1)}
                  <Security n={op.sec.length} i={1} w={0} x={x} />
                </View>
                <View style={{ height: ch + 22, marginTop: 4 }}>{battle(1)}</View>
              </Zone>
              <View style={{ marginVertical: 6, gap: 4 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <View style={{ backgroundColor: C.pink, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 }}>
                    <Text style={{ color: "#2b0018", fontFamily: DISPLAY, fontWeight: "700", fontSize: 12 }}>{phaseTxt}</Text>
                  </View>
                  <View style={{ flex: 1 }} />
                  {controls}
                </View>
                <MemBar v={vMem} width={W - 16 - ins.left - ins.right} />
              </View>
              <Zone rk="zone0" x={x}>
                <View style={{ height: ch + 22 }}>{battle(0)}</View>
                <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: 4 }}>
                  <Security n={me.sec.length} i={0} w={0} />
                  {eggs(0)}
                  {breed(0)}
                  <View style={{ flex: 1 }} />
                  {piles(0)}
                </View>
              </Zone>
              <View style={{ flex: 1, justifyContent: "flex-end", paddingBottom: 4 }}>{hand}</View>
            </View>
          )}
          <FxLayer />
          <Arrow />
          {drag && !drag.arrow ? (
            <Animated.View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, alignItems: "center", transform: DXY.getTranslateTransform() }}>
              <View style={{ transform: [{ rotate: "-5deg" }], shadowColor: "#000", shadowOpacity: 0.6, shadowRadius: 12, elevation: 14, borderRadius: 8, borderWidth: 2, borderColor: drag.hover ? "#fff" : C.acc }}>
                <Face code={drag.code} w={drag.w} h={drag.h} />
              </View>
            </Animated.View>
          ) : null}
          {drag ? (
            // cosa succede lasciando la carta: fisso in alto al centro, sempre leggibile
            <View pointerEvents="none" style={{ position: "absolute", top: land ? 4 : 52, left: 0, right: 0, alignItems: "center" }}>
              <View style={{ backgroundColor: drag.label ? C.acc : "#0b0f22e6", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: drag.label ? C.acc : C.line }}>
                <Text numberOfLines={1} style={{ color: drag.label ? "#04212b" : C.mut, fontWeight: "700", fontSize: 14 }}>{drag.label || "Drag onto a target"}</Text>
              </View>
            </View>
          ) : null}
        </View>
      </SafeAreaView>

      {ban ? <BannerV key={ban.id} text={ban.text} op={ban.op} small={ban.small} /> : null}
      {eff ? <EffectV key={eff.id} e={eff} sim={sim} land={land} /> : null}
      {rev ? <RevealV e={rev} sim={sim} /> : null}
      {first != null ? <FirstV pi={first} /> : null}
      {mull ? (
        <MulliganV
          hand={mull.hand}
          land={land}
          W={W}
          onPick={(v) => {
            const r = mull.res;
            setMull(null);
            r(v);
          }}
        />
      ) : null}
      {end != null ? <EndV win={end} onNew={() => newGame()} onClose={() => setEnd(null)} /> : null}

      {sheet ? (
        <Panel land={land} onClose={() => setSheet(null)}>
          {sheet.who.startsWith("trash") ? (
            <TrashList sim={sim} p={G.P[+sheet.who.slice(5) as 0 | 1]} title={sheet.who === "trash0" ? "Your trash" : "Opponent's trash"} />
          ) : (
            <CardDetail code={sheet.code} sim={sim} who={sheet.who} src={sheet.src} land={land}>
              {sheet.acts.map((a, k) => (
                <ActBtn
                  key={k}
                  label={a.label}
                  sub={a.sub}
                  pri={a.pri}
                  onPress={() => {
                    setSheet(null);
                    act(a.go);
                  }}
                />
              ))}
            </CardDetail>
          )}
          <View style={{ marginTop: 8 }}>
            <ActBtn label="Close" onPress={() => setSheet(null)} />
          </View>
        </Panel>
      ) : null}

      {q ? (
        <Panel land={land}>
          <Text style={{ color: C.ink, fontFamily: DISPLAY, fontWeight: "700", fontSize: 18 }}>{q.title}</Text>
          {q.body ? <Text style={{ color: C.mut, fontSize: 13.5, marginTop: 4 }}>{q.body}</Text> : null}
          <View style={{ gap: 6, marginTop: 10 }}>
            {q.opts.map((o, k) => (
              <ActBtn
                key={k}
                label={o.label}
                sub={o.sub}
                pri={o.pri}
                code={o.code}
                onPress={() => {
                  setQ(null);
                  q.res(o.v);
                }}
              />
            ))}
            {q.cancel ? (
              <ActBtn
                label={q.cancel}
                onPress={() => {
                  setQ(null);
                  q.res(null);
                }}
              />
            ) : null}
          </View>
        </Panel>
      ) : null}

      {logOpen ? (
        <Panel land={land} onClose={() => setLogOpen(false)}>
          <Text style={{ color: C.ink, fontFamily: DISPLAY, fontWeight: "700", fontSize: 18, marginBottom: 8 }}>Log</Text>
          {G.log
            .slice()
            .reverse()
            .map((l, k) => (
              <Text key={k} style={{ color: l.c === "a" ? "#ffb4ba" : l.c === "y" ? "#a9e8ff" : l.c === "k" ? C.gold : "#c4cde9", fontWeight: l.c === "k" ? "700" : "400", fontSize: 13, marginBottom: 3 }}>
                {l.t}
              </Text>
            ))}
          <View style={{ marginTop: 8 }}>
            <ActBtn label="Close" onPress={() => setLogOpen(false)} />
          </View>
        </Panel>
      ) : null}

      {menu ? (
        <Panel land={land} onClose={() => setMenu(false)}>
          <Text style={{ color: C.ink, fontFamily: DISPLAY, fontWeight: "700", fontSize: 18 }}>Menu</Text>
          <Seg
            title="Your deck"
            value={deck}
            opts={[
              ["red", "Gaia Red (ST1)"],
              ["blue", "Cocytus Blue (ST2)"],
            ]}
            onChange={(v) => {
              setDeck(v);
              AsyncStorage.setItem("sim-deck", v).catch(() => {});
            }}
          />
          <Seg
            title="Layout"
            value={layout}
            opts={[
              ["auto", "Follow the phone"],
              ["h", "Landscape"],
              ["v", "Portrait"],
            ]}
            onChange={(v) => {
              setLayout(v as any);
              applyLayout(v as any);
              AsyncStorage.setItem("sim-layout", v).catch(() => {});
            }}
          />
          <Seg
            title="Animation speed"
            value={String(speed)}
            opts={[
              ["1", "Normal"],
              ["0.55", "Fast"],
            ]}
            onChange={(v) => {
              setSpeed((SPEED = parseFloat(v)));
              AsyncStorage.setItem("sim-speed", v).catch(() => {});
            }}
          />
          <Text style={{ color: C.mut, fontSize: 12.5, marginTop: 12, lineHeight: 18 }}>
            Test game against the phone with the ST1 and ST2 starter decks: memory, eggs, digivolving with a draw, attacks, Blocker, Security Attack and Security checks, with every effect of these 32 cards. Tap a card to see its actions, or drag it: from your hand onto your Digimon to digivolve or onto your battle area to play it; from your Digimon draw an arrow to a suspended enemy Digimon or to the Security stack to attack. Deck lists are approximate.
          </Text>
          <View style={{ gap: 6, marginTop: 12 }}>
            <ActBtn
              label="New game"
              sub="You play against the phone"
              pri
              onPress={() => {
                setMenu(false);
                demo.current = false;
                newGame(deck);
              }}
            />
            <ActBtn
              label="Watch a game"
              sub="The phone plays both decks by itself"
              onPress={() => {
                setMenu(false);
                demo.current = true;
                newGame(deck);
              }}
            />
            <ActBtn label="Close" onPress={() => setMenu(false)} />
          </View>
        </Panel>
      ) : null}
    </View>
  );
}

function Zone({ children, opp, fill, rk, x }: { children: React.ReactNode; opp?: boolean; fill?: boolean; rk?: string; x?: Ctx }) {
  const hi = !!(x && x.drag && rk && x.drag.keys.includes(rk));
  const hov = !!(x && x.drag && rk && x.drag.hover === rk);
  return (
    <View
      ref={(r: any) => {
        if (rk) REFS.set(rk, r);
      }}
      collapsable={false}
      style={{ flex: fill ? 1 : undefined, minHeight: 0, backgroundColor: hov ? "#38d6f526" : opp ? "#1b13360f" : "#ffffff08", borderWidth: hi ? 2 : 1, borderStyle: hi && !hov ? "dashed" : "solid", borderColor: hov ? "#fff" : hi ? C.gold : "#38d6f533", borderRadius: 14, padding: hi ? 5 : 6, justifyContent: "center" }}
    >
      {children}
    </View>
  );
}
function Dial({ label, off, onPress }: { label: string; off?: boolean; onPress?: () => void }) {
  const r = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.timing(r, { toValue: 1, duration: 6000, easing: Easing.linear, useNativeDriver: true }));
    a.start();
    return () => a.stop();
  }, []);
  return (
    <Pressable disabled={off} onPress={onPress} style={{ width: 66, height: 66, alignItems: "center", justifyContent: "center", opacity: off ? 0.7 : 1 }}>
      <Animated.View style={{ position: "absolute", transform: [{ rotate: r.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }] }}>
        <Svg width={66} height={66} viewBox="0 0 66 66">
          <Circle cx={33} cy={33} r={30} stroke={off ? "#56628a" : C.acc} strokeWidth={3} strokeDasharray="6 5" fill="none" />
        </Svg>
      </Animated.View>
      <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: off ? "#1a2244" : "#1b3a8a", alignItems: "center", justifyContent: "center", padding: 3 }}>
        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 9.5, textAlign: "center", lineHeight: 11 }}>{label}</Text>
      </View>
    </Pressable>
  );
}
function ActBtn({ label, sub, pri, onPress, code }: { label: string; sub?: string; pri?: boolean; onPress: () => void; code?: string }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ minHeight: 46, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: pri ? C.acc : "#0d1328", borderWidth: 1, borderColor: pri ? C.acc : C.line, opacity: pressed ? 0.75 : 1 })}>
      {code ? <Face code={code} w={30} h={42} /> : null}
      <View style={{ flex: 1 }}>
        <Text style={{ color: pri ? "#04212b" : C.ink, fontWeight: "600", fontSize: 14.5 }}>{label}</Text>
        {sub ? <Text style={{ color: pri ? "#04364a" : C.mut, fontSize: 12 }}>{sub}</Text> : null}
      </View>
    </Pressable>
  );
}
function Seg({ title, value, opts, onChange }: { title: string; value: string; opts: [string, string][]; onChange: (v: string) => void }) {
  return (
    <View style={{ marginTop: 12 }}>
      <Text style={{ color: C.mut, fontSize: 12.5, marginBottom: 5 }}>{title}</Text>
      <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
        {opts.map(([v, l]) => (
          <Pressable key={v} onPress={() => onChange(v)} style={{ minHeight: 40, paddingHorizontal: 12, borderRadius: 10, justifyContent: "center", backgroundColor: v === value ? "#38d6f522" : "#0d1328", borderWidth: 1.5, borderColor: v === value ? C.acc : C.line }}>
            <Text style={{ color: v === value ? C.acc : C.ink, fontWeight: "600", fontSize: 13 }}>{l}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
function CardDetail({ code, sim, who, src, land, children }: { code: string; sim: Sim; who: string; src?: string[]; land: boolean; children?: React.ReactNode }) {
  const d = sim.DB[code];
  const w = land ? 150 : 128;
  const txt = (l: string, t: string) =>
    t ? (
      <View style={{ backgroundColor: "#0d1328", borderRadius: 10, padding: 9, marginTop: 6 }}>
        <Text style={{ color: C.mut, fontSize: 11, marginBottom: 2 }}>{l}</Text>
        <Rich text={t} style={{ color: C.ink, fontSize: 13.2, lineHeight: 19 }} />
      </View>
    ) : null;
  return (
    <View>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <Face code={code} w={w} h={Math.round(w * 1.396)} big />
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.mut, fontSize: 12 }}>{who}</Text>
          <Text style={{ color: C.ink, fontFamily: DISPLAY, fontWeight: "700", fontSize: 19 }}>{d.n}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 4 }}>
            {[d.code, d.lv ? "Lv." + d.lv : "", d.t, d.dp ? "DP " + d.dp : "", d.t !== "Digi-Egg" ? "Play cost " + d.pc : "", d.ec != null ? "Digivolve cost " + d.ec : ""]
              .filter(Boolean)
              .map((s) => (
                <View key={s} style={{ backgroundColor: "#0d1328", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderLeftWidth: 3, borderLeftColor: COL[d.col] || C.line }}>
                  <Text style={{ color: C.ink, fontSize: 11.5 }}>{s}</Text>
                </View>
              ))}
          </View>
          {src && src.length ? <Text style={{ color: C.mut, fontSize: 12, marginTop: 6 }}>Under: {src.join(", ")}</Text> : null}
          {land ? <View style={{ gap: 6, marginTop: 8 }}>{children}</View> : null}
        </View>
      </View>
      {!land ? <View style={{ gap: 6, marginTop: 10 }}>{children}</View> : null}
      {txt("Effect", d.e)}
      {txt("Inherited effect", d.i)}
      {txt("Security", d.s)}
    </View>
  );
}
function TrashList({ sim, p, title }: { sim: Sim; p: { trash: CardInst[] }; title: string }) {
  return (
    <View>
      <Text style={{ color: C.ink, fontFamily: DISPLAY, fontWeight: "700", fontSize: 18, marginBottom: 8 }}>
        {title} · {p.trash.length}
      </Text>
      {p.trash.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {p.trash
            .slice()
            .reverse()
            .map((c) => (
              <Face key={c.u} code={c.c} w={56} h={78} />
            ))}
        </View>
      ) : (
        <Text style={{ color: C.mut }}>Empty.</Text>
      )}
    </View>
  );
}
// tappeto: sfumatura blu notte e cerchi dell'arena al centro
function Mat() {
  const { width: W, height: H } = useWindowDimensions();
  const r = Math.min(W, H);
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }}>
      <Svg width={W} height={H}>
        <Defs>
          <RadialGradient id="mat" cx="50%" cy="50%" r="70%">
            <Stop offset="0" stopColor="#2c2f7a" />
            <Stop offset="0.5" stopColor="#141b4c" />
            <Stop offset="1" stopColor="#0a0f24" />
          </RadialGradient>
        </Defs>
        <Rect width={W} height={H} fill="url(#mat)" />
        {[0.16, 0.27, 0.4].map((k) => (
          <Circle key={k} cx={W / 2} cy={H / 2} r={r * k} stroke="#38d6f5" strokeOpacity={0.16} strokeWidth={2} fill="none" />
        ))}
        <Rect x={0} y={H / 2 - 22} width={W} height={44} fill="#38d6f5" fillOpacity={0.05} />
      </Svg>
    </View>
  );
}

// freccia dell'attacco trascinato: si ridisegna da sola (senza ridisegnare il tavolo) a ogni movimento del dito
const ARROW: { set: ((a: { x1: number; y1: number; x2: number; y2: number } | null) => void) | null } = { set: null };
function Arrow() {
  const [a, setA] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  useEffect(() => {
    ARROW.set = setA;
    return () => {
      ARROW.set = null;
    };
  }, []);
  const { width: W, height: H } = useWindowDimensions();
  if (!a) return null;
  const dx = a.x2 - a.x1,
    dy = a.y2 - a.y1,
    len = Math.hypot(dx, dy) || 1;
  // curva leggera verso l'alto e punta orientata come l'ultimo tratto
  const cx = (a.x1 + a.x2) / 2 - (dy / len) * Math.min(60, len * 0.2),
    cy = (a.y1 + a.y2) / 2 + (dx / len) * Math.min(60, len * 0.2);
  const ang = Math.atan2(a.y2 - cy, a.x2 - cx);
  const hx = (r: number, t: number) => a.x2 + Math.cos(ang + t) * r;
  const hy = (r: number, t: number) => a.y2 + Math.sin(ang + t) * r;
  const head = `M${a.x2 + Math.cos(ang) * 6} ${a.y2 + Math.sin(ang) * 6} L${hx(22, 2.6)} ${hy(22, 2.6)} L${hx(10, Math.PI)} ${hy(10, Math.PI)} L${hx(22, -2.6)} ${hy(22, -2.6)} Z`;
  const path = `M${a.x1} ${a.y1} Q${cx} ${cy} ${a.x2} ${a.y2}`;
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, width: W, height: H }}>
      <Svg width={W} height={H}>
        <Path d={path} stroke="#000" strokeOpacity={0.45} strokeWidth={11} fill="none" strokeLinecap="round" />
        <Path d={path} stroke={C.gold} strokeWidth={6} fill="none" strokeLinecap="round" strokeDasharray="14 7" />
        <Path d={head} fill={C.gold} stroke="#000" strokeOpacity={0.5} strokeWidth={1.5} />
        <Circle cx={a.x1} cy={a.y1} r={9} fill={C.gold} stroke="#fff" strokeWidth={2} />
      </Svg>
    </View>
  );
}
// chi inizia: riquadro al centro
function FirstV({ pi }: { pi: 0 | 1 }) {
  const p = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    run(Animated.sequence([sp(p, 1, 6, 70), Animated.delay(1500 * SPEED), tm(p, 0, 250)]));
  }, []);
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: "#05081a99" }}>
      <Animated.View style={{ alignItems: "center", paddingHorizontal: 26, paddingVertical: 18, borderRadius: 20, backgroundColor: C.bg2, borderWidth: 2, borderColor: pi ? "#3d78e8" : C.pink, opacity: p, transform: [{ scale: p.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }}>
        <Text style={{ color: C.mut, fontFamily: DISPLAY, fontWeight: "700", fontSize: 13, letterSpacing: 1.5 }}>COIN TOSS</Text>
        <Text style={{ color: pi ? "#8fb2ff" : C.pink, fontFamily: DISPLAY, fontWeight: "700", fontStyle: "italic", fontSize: 30, marginTop: 4 }}>{pi ? "OPPONENT GOES FIRST" : "YOU GO FIRST"}</Text>
        <Text style={{ color: C.ink, fontSize: 13.5, marginTop: 4 }}>{pi ? "You go second: you draw on your first turn." : "The first player doesn't draw on turn 1."}</Text>
      </Animated.View>
    </View>
  );
}
// mano iniziale: tenerla o mulligan
function MulliganV({ hand, land, W, onPick }: { hand: string[]; land: boolean; W: number; onPick: (mulligan: boolean) => void }) {
  const p = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    sp(p, 1, 8, 70).start();
  }, []);
  const cw = Math.round(Math.min(land ? 92 : 74, (Math.min(W, 620) - 70) / 5)),
    ch = Math.round(cw * 1.396);
  return (
    <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: "#05081acc" }}>
      <Animated.View style={{ maxWidth: "96%", alignItems: "center", padding: 16, borderRadius: 20, backgroundColor: C.bg2, borderWidth: 1, borderColor: C.line, opacity: p, transform: [{ translateY: p.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }] }}>
        <Text style={{ color: C.ink, fontFamily: DISPLAY, fontWeight: "700", fontSize: 20 }}>Keep this hand?</Text>
        <View style={{ flexDirection: "row", gap: 6, marginVertical: 12 }}>
          {hand.map((c, k) => (
            <Face key={k} code={c} w={cw} h={ch} />
          ))}
        </View>
        <Text style={{ color: C.mut, fontSize: 12.5, textAlign: "center", maxWidth: 420, marginBottom: 12 }}>Mulligan: your hand goes back into the deck, the deck is shuffled and you draw 5 new cards. You can do it only once.</Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Btn label="Keep hand" pri onPress={() => onPick(false)} />
          <Btn label="Mulligan" onPress={() => onPick(true)} />
        </View>
      </Animated.View>
    </View>
  );
}
