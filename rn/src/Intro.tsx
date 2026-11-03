// Intro di avvio (come #dg-boot dell'app attuale): sfondo blu notte, tre anelli che girano e si allargano, il marchio Digivice,
// pixel che convergono, la scritta DIGITAL GATE e DIGIMON TCG; dopo circa 1,2 s sfuma da sola, un tocco la chiude subito.
// Nell'app a ogni avvio; sul web una volta per sessione. Con "riduci animazioni" niente movimento.
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, View, useWindowDimensions } from "react-native";
import Svg, { Circle, Defs, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { DISPLAY, Text } from "./Text";
import { DgMark } from "./chrome";
import { StatusBar } from "expo-status-bar";

const ND = Platform.OS !== "web";
const PIX: [number, number, number][] = [
  [-100, -114, 0],
  [112, -82, 39],
  [-137, 24, 72],
  [118, 62, 20],
  [21, 128, 84],
  [-65, 113, 58],
  [62, -128, 104],
  [144, -11, 124],
];

function seenOnWeb() {
  if (Platform.OS !== "web") return false;
  try {
    const s = (globalThis as any).sessionStorage;
    if (/[?&]nosplash/.test((globalThis as any).location?.search || "")) return true;
    const v = s.getItem("dg-splash") === "1";
    s.setItem("dg-splash", "1");
    return v;
  } catch {
    return false;
  }
}

// anello: cerchio sottile e un arco spesso (come i bordi colorati del sito)
function Ring({ size, thin, arc, from, to }: { size: number; thin: string; arc: string; from: number; to: number }) {
  const r = size / 2 - 2.5,
    c = size / 2;
  const p = (a: number) => [c + r * Math.cos((a * Math.PI) / 180), c - r * Math.sin((a * Math.PI) / 180)];
  const [x1, y1] = p(from),
    [x2, y2] = p(to);
  const large = (from - to + 360) % 360 > 180 ? 1 : 0;
  return (
    <Svg width={size} height={size}>
      <Circle cx={c} cy={c} r={size / 2 - 0.5} stroke={thin} strokeWidth={1} fill="none" />
      <Path d={`M${x1} ${y1}A${r} ${r} 0 ${large} 1 ${x2} ${y2}`} stroke={arc} strokeWidth={5} fill="none" />
    </Svg>
  );
}

export function Intro() {
  const { width } = useWindowDimensions();
  const [on, setOn] = useState(() => !seenOnWeb());
  const t = useRef(new Animated.Value(0)).current; // tempo 0 → 1235 ms
  const timer = useRef<any>(null);
  const small = width <= 380;
  const P = small ? 214 : 240,
    M = small ? 184 : 204;
  const finish = () => {
    clearTimeout(timer.current);
    setOn(false);
  };
  useEffect(() => {
    if (!on) return;
    let stop = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((rm) => {
        if (stop) return;
        if (rm) {
          t.setValue(800);
          timer.current = setTimeout(finish, 900);
          return;
        }
        Animated.timing(t, { toValue: 1235, duration: 1235, easing: Easing.linear, useNativeDriver: ND }).start();
        timer.current = setTimeout(finish, 1240);
      });
    return () => {
      stop = true;
      clearTimeout(timer.current);
    };
  }, []);
  if (!on) return null;
  // valore animato tra due istanti (ms) con i fotogrammi indicati
  const k = (ins: number[], outs: number[]) => t.interpolate({ inputRange: ins, outputRange: outs, extrapolate: "clamp" });
  const ring = (d: number, dur: number) => ({
    opacity: k([d, d + dur * 0.2, d + dur * 0.7, d + dur], [0, 0.8, 0.72, 0]),
    transform: [{ rotate: k([d, d + dur * 0.7, d + dur], [-38, 26, 43]).interpolate({ inputRange: [-38, 43], outputRange: ["-38deg", "43deg"] }) }, { scale: k([d, d + dur * 0.7, d + dur], [0.76, 1, 1.32]) }],
  });
  return (
    <Pressable onPress={finish} accessibilityLabel="Avvio di Digital Gate. Tocca per entrare." style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000 }}>
      {/* sfondo blu notte anche nel tema chiaro: ora e batteria chiare finché l'intro è visibile */}
      <StatusBar style="light" />
      <Animated.View style={{ flex: 1, backgroundColor: "#0b1120", alignItems: "center", justifyContent: "center", opacity: k([1066, 1235], [1, 0]) }}>
        <Svg style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100">
          <Defs>
            <RadialGradient id="bootamb" cx="50" cy="46" rx="54" ry="54" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor="#17314b" stopOpacity={0.88} />
              <Stop offset="1" stopColor="#0b1120" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect width="100" height="100" fill="url(#bootamb)" />
        </Svg>
        <View style={{ alignItems: "center", transform: [{ translateY: -10 }] }}>
          <View style={{ width: P, height: P, marginBottom: small ? 22 : 25, alignItems: "center", justifyContent: "center" }}>
            <Animated.View style={[{ position: "absolute" }, ring(26, 1138)]}>
              <Ring size={P + (small ? 28 : 38)} thin="#ff7a3d35" arc="#ff7a3d" from={270} to={90} />
            </Animated.View>
            <Animated.View style={[{ position: "absolute" }, ring(0, 1072)]}>
              <Ring size={P} thin="#63d5ee36" arc="#63d5ee" from={180} to={0} />
            </Animated.View>
            <Animated.View style={[{ position: "absolute" }, ring(72, 1027)]}>
              <Ring size={P - 30} thin="#63d5ee1f" arc="#63d5ee" from={180} to={90} />
            </Animated.View>
            <Animated.View style={{ opacity: k([104, 104 + 942 * 0.22], [0, 1]), transform: [{ scale: k([104, 104 + 942 * 0.22, 104 + 942 * 0.84, 1046], [0.88, 1, 1, 1.04]) }] }}>
              <DgMark size={Math.round(M * 0.75)} />
            </Animated.View>
            {PIX.map(([x, y, d], i) => (
              <Animated.View
                key={i}
                style={{
                  position: "absolute",
                  width: 4,
                  height: 4,
                  backgroundColor: (i + 1) % 3 === 0 ? "#ff7a3d" : "#63d5ee",
                  opacity: k([d, d + 79, d + 494], [0, 0.75, 0]),
                  transform: [{ translateX: k([d, d + 494], [x, 0]) }, { translateY: k([d, d + 494], [y, 0]) }, { scale: k([d, d + 494], [1, 0.2]) }],
                }}
              />
            ))}
          </View>
          <Animated.View style={{ opacity: k([494, 741], [0, 1]), transform: [{ translateY: k([494, 741], [8, 0]) }] }}>
            <Text style={{ color: "#f1f4f9", fontFamily: DISPLAY, fontWeight: "700", fontStyle: "italic", fontSize: Math.max(27, Math.min(40, width * 0.07)), letterSpacing: 0.6, textAlign: "center" }}>DIGITAL GATE</Text>
          </Animated.View>
          <Animated.View style={{ opacity: k([611, 806], [0, 1]) }}>
            <Text style={{ color: "#63d5ee", fontFamily: DISPLAY, fontWeight: "600", fontSize: 11, lineHeight: 16, letterSpacing: 3.3, textAlign: "center", marginTop: 10 }}>DIGIMON TCG</Text>
          </Animated.View>
        </View>
      </Animated.View>
    </Pressable>
  );
}
