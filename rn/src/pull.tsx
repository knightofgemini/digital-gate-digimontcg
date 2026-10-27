// Tirare giù un foglio (o la scheda carta) partendo dal suo elenco quando è già in cima, come dragDown dell'app attuale.
// Su Android un elenco che scorre si prende il dito da solo: un PanResponder sopra di lui non riceve il gesto.
// Allora è l'elenco stesso a "tirare": sopra il contenuto c'è uno spazio vuoto alto S (che non conta nell'altezza
// dell'elenco) e a riposo l'elenco è scorso di S; tirando giù dalla cima si scorre dentro lo spazio vuoto.
// d = quanto si è tirato: il foglio scende di d e l'elenco sale di d al suo interno, così tutto segue il dito.
// Rilasciando oltre la soglia o con un colpo veloce si chiude (onPull), altrimenti torna su.
import { useMemo, useRef, useState } from "react";
import { Animated } from "react-native";

export const PULL_S = 1600;
export function usePull(S: number, threshold: () => number, onPull: () => void) {
  const y = useRef(new Animated.Value(S)).current;
  const ref = useRef<any>(null);
  const st = useRef({ drag: false, top: false, settle: 0, closing: false, last: S, t: 0, v: 0, seen: false });
  // altezza dell'elenco: il contenuto è alto almeno quanto l'elenco, così la posizione di riposo (S) è sempre raggiungibile
  const [V, setV] = useState(0);
  const pullRef = useRef(onPull);
  pullRef.current = onPull;
  const thRef = useRef(threshold);
  thRef.current = threshold;
  const toTop = (animated: boolean) => ref.current && ref.current.scrollTo({ y: S, animated });
  const fix = () => {
    const s = st.current;
    if (s.drag || s.closing) return;
    if (!s.seen || s.last < S - 0.5) {
      toTop(false);
      setTimeout(() => !st.current.drag && !st.current.closing && (!st.current.seen || st.current.last < S - 0.5) && toTop(false), 60);
    }
  };
  return useMemo(() => {
    const d = y.interpolate({ inputRange: [0, S], outputRange: [S, 0], extrapolate: "clamp" });
    const neg = y.interpolate({ inputRange: [0, S], outputRange: [-S, 0], extrapolate: "clamp" });
    const scroll = {
      ref,
      contentOffset: { x: 0, y: S },
      scrollEventThrottle: 16,
      showsVerticalScrollIndicator: false,
      // a riposo l'elenco è in cima al contenuto vero (anche se contentOffset non venisse applicato)
      onLayout: (e: any) => {
        const h = Math.round(e.nativeEvent.layout.height);
        setV((o) => (Math.abs(o - h) > 1 ? h : o));
        fix();
      },
      onContentSizeChange: () => fix(),
      onScroll: Animated.event([{ nativeEvent: { contentOffset: { y } } }], {
        useNativeDriver: true,
        listener: (e: any) => {
          const s = st.current,
            v = e.nativeEvent.contentOffset.y,
            now = Date.now();
          s.seen = true;
          if (now > s.t) s.v = (v - s.last) / (now - s.t);
          s.last = v;
          s.t = now;
          // uno scorrimento lanciato dal basso si ferma in cima, non entra nello spazio vuoto
          if (!s.drag && !s.closing && now > s.settle && v < S - 0.5) toTop(false);
        },
      }),
      onScrollBeginDrag: (e: any) => {
        const s = st.current;
        s.drag = true;
        s.top = e.nativeEvent.contentOffset.y <= S + 2;
      },
      onScrollEndDrag: (e: any) => {
        const s = st.current;
        s.drag = false;
        const p = S - e.nativeEvent.contentOffset.y;
        if (p <= 0) return;
        if (s.top && (p > thRef.current() || (s.v < -0.8 && p > 16))) {
          s.closing = true;
          pullRef.current();
        } else {
          s.settle = Date.now() + 450;
          toTop(true);
        }
      },
    };
    // contenuto: spazio vuoto sopra che non conta nell'altezza dell'elenco
    const pad = { paddingTop: S, marginBottom: -S, minHeight: V ? S + V : undefined };
    return {
      d,
      neg,
      scroll,
      pad,
      // torna a riposo (es. dopo aver annullato la chiusura) o scorre a una posizione del contenuto vero
      reset: () => {
        st.current.closing = false;
        toTop(false);
      },
      scrollTo: (yy: number, animated: boolean) => {
        st.current.settle = Date.now() + 450;
        ref.current && ref.current.scrollTo({ y: S + yy, animated });
      },
      // posizione nel contenuto vero
      offset: () => st.current.last - S,
    };
  }, [S, V]);
}
