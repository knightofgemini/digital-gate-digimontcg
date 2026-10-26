// Foglio dal basso con il velo scuro separato: il velo compare e sparisce in dissolvenza, mentre il foglio sale e scende
// per conto suo. Prima si usava Modal con animationType="slide", che faceva scorrere giù anche il velo (effetto di
// opacità che scendeva dall'alto in chiusura). Animazioni sul thread nativo (useNativeDriver).
import { ReactNode, useEffect, useRef, useState } from "react";
import { Animated, Easing, Modal, Platform, Pressable, StyleProp, StyleSheet, ViewStyle, useWindowDimensions } from "react-native";
import { useTheme } from "./theme";

const EASE = Easing.bezier(0.32, 0.72, 0, 1);
const NATIVE = Platform.OS !== "web";

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
  const [shown, setShown] = useState(visible);
  const [h, setH] = useState(0);
  const a = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) setShown(true);
    else if (shown) {
      Animated.timing(a, { toValue: 0, duration: 240, easing: Easing.in(Easing.cubic), useNativeDriver: NATIVE }).start(({ finished }) => {
        if (finished) {
          setShown(false);
          setH(0);
        }
      });
    }
  }, [visible]);

  // si apre solo dopo aver misurato il foglio, così sale esattamente della sua altezza
  useEffect(() => {
    if (visible && shown && h > 0) Animated.timing(a, { toValue: 1, duration: 380, easing: EASE, useNativeDriver: NATIVE }).start();
  }, [visible, shown, h > 0]);

  if (!shown) return null;
  const dist = h || winH;
  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onBack || onClose}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: scrim || t.scrim, opacity: a }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Chiudi" />
      </Animated.View>
      <Animated.View
        onLayout={(e) => setH(Math.round(e.nativeEvent.layout.height))}
        style={[
          style,
          {
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            maxHeight: Math.round(winH * maxH),
            transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [dist + 40, 0] }) }],
          },
        ]}
      >
        {children}
      </Animated.View>
      {overlay}
    </Modal>
  );
}
