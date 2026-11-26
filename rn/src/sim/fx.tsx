// Simulatore: animazioni. Ogni carta (pila o carta in mano) ha i suoi valori animati (`av`), letti da CardView; le
// posizioni sullo schermo si misurano dai riferimenti registrati (`REFS`). Gli effetti di passaggio (esplosioni,
// scintille, numeri che salgono, scudo del Blocker) stanno in un livello sopra il tavolo (`FxLayer`).
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { DISPLAY, Text } from "../Text";

export type AV = { tx: Animated.Value; ty: Animated.Value; sc: Animated.Value; op: Animated.Value; rot: Animated.Value; flash: Animated.Value; glow: Animated.Value };
const AVS = new Map<string, AV>();
export function av(u: string): AV {
  let a = AVS.get(u);
  if (!a) {
    a = { tx: new Animated.Value(0), ty: new Animated.Value(0), sc: new Animated.Value(1), op: new Animated.Value(1), rot: new Animated.Value(0), flash: new Animated.Value(0), glow: new Animated.Value(0) };
    AVS.set(u, a);
  }
  return a;
}
export function resetAV() {
  AVS.clear();
}

type MV = { measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => void };
export const REFS = new Map<string, MV | null>();
export const ROOT: { v: MV | null; x: number; y: number } = { v: null, x: 0, y: 0 };
export type Box = { x: number; y: number; w: number; h: number; cx: number; cy: number };
// posizione di un elemento rispetto al tavolo
export function measure(k: string): Promise<Box | null> {
  return new Promise((res) => {
    const r = REFS.get(k);
    if (!r || !ROOT.v) return res(null);
    ROOT.v.measureInWindow((rx: number, ry: number) => {
      r.measureInWindow((x: number, y: number, w: number, h: number) => {
        if (!w && !h) return res(null);
        const b = { x: x - rx, y: y - ry, w, h, cx: x - rx + w / 2, cy: y - ry + h / 2 };
        res(b);
      });
    });
  });
}

export const run = (a: Animated.CompositeAnimation) => new Promise<void>((r) => a.start(() => r()));
export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const N = true; // animazioni native
export const tm = (v: Animated.Value, toValue: number, duration: number, easing = Easing.out(Easing.cubic)) => Animated.timing(v, { toValue, duration, easing, useNativeDriver: N });
export const sp = (v: Animated.Value, toValue: number, friction = 6, tension = 80) => Animated.spring(v, { toValue, friction, tension, useNativeDriver: N });

// battito comune per i bordi delle carte utilizzabili
export const PULSE = new Animated.Value(0);
Animated.loop(Animated.sequence([Animated.timing(PULSE, { toValue: 1, duration: 750, useNativeDriver: N }), Animated.timing(PULSE, { toValue: 0, duration: 750, useNativeDriver: N })])).start();

// ---- livello degli effetti ----
type Item =
  | { id: number; k: "burst"; x: number; y: number; color: string; big?: boolean }
  | { id: number; k: "float"; x: number; y: number; text: string; color: string }
  | { id: number; k: "shield"; x: number; y: number }
  | { id: number; k: "ring"; x: number; y: number; color: string; size: number }
  | { id: number; k: "slash"; x: number; y: number; color: string };
let push: ((it: Item) => void) | null = null;
let nid = 0;
export const FX = {
  burst: (x: number, y: number, color: string, big?: boolean) => push?.({ id: ++nid, k: "burst", x, y, color, big }),
  float: (x: number, y: number, text: string, color: string) => push?.({ id: ++nid, k: "float", x, y, text, color }),
  shield: (x: number, y: number) => push?.({ id: ++nid, k: "shield", x, y }),
  ring: (x: number, y: number, color: string, size = 120) => push?.({ id: ++nid, k: "ring", x, y, color, size }),
  slash: (x: number, y: number, color: string) => push?.({ id: ++nid, k: "slash", x, y, color }),
};

export function FxLayer() {
  const [items, setItems] = useState<Item[]>([]);
  useEffect(() => {
    push = (it) => setItems((a) => [...a, it]);
    return () => {
      push = null;
    };
  }, []);
  const done = (id: number) => setItems((a) => a.filter((x) => x.id !== id));
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }}>
      {items.map((it) =>
        it.k === "burst" ? (
          <Burst key={it.id} it={it} done={() => done(it.id)} />
        ) : it.k === "float" ? (
          <Float key={it.id} it={it} done={() => done(it.id)} />
        ) : it.k === "shield" ? (
          <Shield key={it.id} it={it} done={() => done(it.id)} />
        ) : it.k === "ring" ? (
          <Ring key={it.id} it={it} done={() => done(it.id)} />
        ) : (
          <Slash key={it.id} it={it} done={() => done(it.id)} />
        ),
      )}
    </View>
  );
}

// scintille che partono dal centro
function Burst({ it, done }: { it: { x: number; y: number; color: string; big?: boolean }; done: () => void }) {
  const p = useRef(new Animated.Value(0)).current;
  const n = it.big ? 16 : 10;
  const parts = useRef(Array.from({ length: n }, (_, i) => ({ a: (i / n) * Math.PI * 2 + Math.random() * 0.4, d: (it.big ? 70 : 45) + Math.random() * 35, s: 4 + Math.random() * 5 }))).current;
  useEffect(() => {
    run(tm(p, 1, it.big ? 750 : 550)).then(done);
  }, []);
  return (
    <>
      <Animated.View style={{ position: "absolute", left: it.x - 30, top: it.y - 30, width: 60, height: 60, borderRadius: 30, backgroundColor: it.color, opacity: p.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.9, 0.6, 0] }), transform: [{ scale: p.interpolate({ inputRange: [0, 1], outputRange: [0.3, it.big ? 2.6 : 1.8] }) }] }} />
      {parts.map((q, i) => (
        <Animated.View
          key={i}
          style={{
            position: "absolute",
            left: it.x - q.s / 2,
            top: it.y - q.s / 2,
            width: q.s,
            height: q.s,
            borderRadius: q.s / 2,
            backgroundColor: i % 3 ? it.color : "#fff",
            opacity: p.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 0.8, 0] }),
            transform: [{ translateX: p.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(q.a) * q.d] }) }, { translateY: p.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(q.a) * q.d] }) }],
          }}
        />
      ))}
    </>
  );
}
function Ring({ it, done }: { it: { x: number; y: number; color: string; size: number }; done: () => void }) {
  const p = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    run(tm(p, 1, 650)).then(done);
  }, []);
  const s = it.size;
  return (
    <Animated.View
      style={{ position: "absolute", left: it.x - s / 2, top: it.y - s / 2, width: s, height: s, borderRadius: s / 2, borderWidth: 4, borderColor: it.color, opacity: p.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }), transform: [{ scale: p.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1.4] }) }] }}
    />
  );
}
function Float({ it, done }: { it: { x: number; y: number; text: string; color: string }; done: () => void }) {
  const p = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    run(tm(p, 1, 1100, Easing.out(Easing.quad))).then(done);
  }, []);
  return (
    <Animated.View style={{ position: "absolute", left: it.x - 60, width: 120, top: it.y - 14, alignItems: "center", opacity: p.interpolate({ inputRange: [0, 0.15, 0.75, 1], outputRange: [0, 1, 1, 0] }), transform: [{ translateY: p.interpolate({ inputRange: [0, 1], outputRange: [0, -46] }) }, { scale: p.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0.6, 1.15, 1] }) }] }}>
      <Text style={{ color: it.color, fontFamily: DISPLAY, fontWeight: "700", fontSize: 22, textShadowColor: "#000", textShadowRadius: 6 }}>{it.text}</Text>
    </Animated.View>
  );
}
function Shield({ it, done }: { it: { x: number; y: number }; done: () => void }) {
  const p = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    run(Animated.sequence([sp(p, 1, 5, 120), Animated.delay(350), tm(p, 2, 250)])).then(done);
  }, []);
  return (
    <Animated.View style={{ position: "absolute", left: it.x - 32, top: it.y - 36, opacity: p.interpolate({ inputRange: [0, 1, 2], outputRange: [0, 1, 0] }), transform: [{ scale: p.interpolate({ inputRange: [0, 1, 2], outputRange: [0.3, 1, 1.4] }) }] }}>
      <Svg width={64} height={72} viewBox="0 0 24 27">
        <Path d="M12 1 22 5v8c0 6-4.5 10.5-10 13C6.5 23.5 2 19 2 13V5z" fill="#2f6fe0" stroke="#cfe0ff" strokeWidth={1.6} />
        <Path d="M8 13l3 3 5-6" stroke="#fff" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </Animated.View>
  );
}
// colpo: tre graffi in diagonale
function Slash({ it, done }: { it: { x: number; y: number; color: string }; done: () => void }) {
  const p = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    run(tm(p, 1, 420)).then(done);
  }, []);
  return (
    <Animated.View style={{ position: "absolute", left: it.x - 50, top: it.y - 50, opacity: p.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 0] }), transform: [{ scale: p.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.25] }) }, { rotate: "-12deg" }] }}>
      <Svg width={100} height={100} viewBox="0 0 100 100">
        {[0, 1, 2].map((i) => (
          <Path key={i} d={`M${18 + i * 18} 88 L${52 + i * 18} 12`} stroke={i === 1 ? "#fff" : it.color} strokeWidth={i === 1 ? 6 : 4} strokeLinecap="round" />
        ))}
      </Svg>
    </Animated.View>
  );
}
