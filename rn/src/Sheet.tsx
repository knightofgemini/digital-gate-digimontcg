// Foglio dal basso con il velo scuro separato: il velo compare e sparisce in dissolvenza, mentre il foglio sale e scende
// per conto suo. Prima si usava Modal con animationType="slide", che faceva scorrere giù anche il velo (effetto di
// opacità che scendeva dall'alto in chiusura). Animazioni sul thread nativo (useNativeDriver).
import { ReactNode, createContext, useContext, useEffect, useRef, useState } from "react";
import { Animated, Easing, Modal, PanResponder, Platform, Pressable, ScrollViewProps, StyleProp, StyleSheet, ViewStyle, useWindowDimensions } from "react-native";
import { useTheme } from "./theme";
import { useKbH } from "./chrome";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PULL_S, usePull } from "./pull";

const EASE = Easing.bezier(0.32, 0.72, 0, 1);

// elenco dentro il foglio: tirandolo giù quando è in cima il foglio segue il dito e si chiude (vedi pull.tsx)
type Ctx = { setD: (d: Animated.AnimatedInterpolation<number> | null) => void; close: () => void; h: { current: number } };
const SheetCtx = createContext<Ctx | null>(null);
// elenco che scorre dentro un foglio (al posto di ScrollView): deve arrivare fino al fondo del foglio
export function SheetScrollView({ style, contentContainerStyle, ...p }: ScrollViewProps & { children?: ReactNode }) {
  const ctx = useContext(SheetCtx);
  const pull = usePull(
    PULL_S,
    () => (ctx ? ctx.h.current : 400) * 0.25,
    () => ctx && ctx.close()
  );
  useEffect(() => {
    if (!ctx) return;
    ctx.setD(pull.d);
    return () => ctx.setD(null);
  }, []);
  return <Animated.ScrollView {...p} {...pull.scroll} style={[style, { transform: [{ translateY: pull.neg }] }]} contentContainerStyle={[pull.pad, contentContainerStyle]} />;
}
const NATIVE = Platform.OS !== "web";
const ZERO = new Animated.Value(0);

export function Sheet({
  visible,
  onClose,
  onBack,
  maxH = 0.88,
  scrim,
  style,
  overlay,
  children,
}: {
  // elementi da mettere sopra a tutto, in coordinate dello schermo (es. le tendine dei Filtri)
  overlay?: ReactNode;
  visible: boolean;
  onClose: () => void;
  // tasto indietro di Android (es. Filtri: prima chiude la tendina aperta); se manca chiude il foglio
  onBack?: () => void;
  // altezza massima come frazione dello schermo
  maxH?: number;
  scrim?: string;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const t = useTheme();
  const { height: winH } = useWindowDimensions();
  // con la tastiera aperta il foglio sale sopra la tastiera e si accorcia per restare nello schermo
  const kb = useKbH();
  const top = useSafeAreaInsets().top;
  const [shown, setShown] = useState(visible);
  const [h, setH] = useState(0);
  const a = useRef(new Animated.Value(0)).current;
  // trascinamento verso il basso dalla parte alta del foglio (maniglia/intestazione): il foglio segue il dito, il velo
  // si schiarisce; rilasciando oltre 1/4 dell'altezza o con un colpo veloce si chiude, altrimenti torna su (come dragDown)
  const drag = useRef(new Animated.Value(0)).current;
  const topY = useRef(0);
  const hRef = useRef(0);
  hRef.current = h;
  const startIn = useRef(false);
  const [pd, setPd] = useState<Animated.AnimatedInterpolation<number> | null>(null);
  // con un elenco che tira il foglio, il dito trascina da sé solo dalla parte alta (maniglia/intestazione)
  const hasPull = useRef(false);
  hasPull.current = !!pd;
  const ctx = useRef<Ctx>({ setD: setPd, close: () => closeRef.current(), h: hRef }).current;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: (e) => {
        startIn.current = e.nativeEvent.pageY - topY.current < 64;
        return false;
      },
      onMoveShouldSetPanResponderCapture: (_, g) => (!hasPull.current || startIn.current) && g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx) * 1.3,
      onPanResponderMove: (_, g) => drag.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_, g) => {
        if (g.dy > (hRef.current || 400) * 0.25 || g.vy > 0.8) closeRef.current();
        else Animated.spring(drag, { toValue: 0, useNativeDriver: NATIVE, bounciness: 0 }).start();
      },
      onPanResponderTerminate: () => Animated.spring(drag, { toValue: 0, useNativeDriver: NATIVE, bounciness: 0 }).start(),
    })
  ).current;

  useEffect(() => {
    if (visible) setShown(true);
    else if (shown) {
      Animated.timing(a, { toValue: 0, duration: 240, easing: Easing.in(Easing.cubic), useNativeDriver: NATIVE }).start(({ finished }) => {
        if (finished) {
          setShown(false);
          setH(0);
          drag.setValue(0);
        }
      });
    }
  }, [visible]);

  // si apre solo dopo aver misurato il foglio, così sale esattamente della sua altezza
  useEffect(() => {
    if (visible && shown && h > 0) drag.setValue(0);
    if (visible && shown && h > 0) Animated.timing(a, { toValue: 1, duration: 380, easing: EASE, useNativeDriver: NATIVE }).start();
  }, [visible, shown, h > 0]);

  if (!shown) return null;
  const dist = h || winH;
  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onBack || onClose}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: scrim || t.scrim, opacity: Animated.multiply(a, ((pd ? Animated.add(drag, pd) : drag) as any).interpolate({ inputRange: [0, dist], outputRange: [1, 0.15], extrapolate: "clamp" })) }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Chiudi" />
      </Animated.View>
      <Animated.View
        {...pan.panHandlers}
        onLayout={(e) => {
          topY.current = e.nativeEvent.layout.y;
          setH(Math.round(e.nativeEvent.layout.height));
        }}
        style={[
          style,
          {
            position: "absolute",
            left: 0,
            right: 0,
            bottom: kb,
            maxHeight: Math.round(Math.min(winH * maxH, winH - kb - top - 8)),
            transform: [{ translateY: Animated.add(Animated.add(a.interpolate({ inputRange: [0, 1], outputRange: [dist + 40, 0] }), drag), pd || ZERO) }],
          },
        ]}
      >
        <SheetCtx.Provider value={ctx}>{children}</SheetCtx.Provider>
      </Animated.View>
      {overlay}
    </Modal>
  );
}
