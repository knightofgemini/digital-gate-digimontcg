// Copie nel mazzo: − numero + con le regole (bandita con lucchetto, limitata con MAX, + spento quando non si può aggiungere).
import { View } from "react-native";
import { Text } from "./Text";
import Svg, { Path, Rect } from "react-native-svg";
import { Card, PAIRS, maxCopies } from "./data";
import { addError, codeTotal, deckAdd, deckSet, inDeck } from "./decks";
import { QtyControl } from "./items";
import { Deck, useStore } from "./store";
import { useTheme } from "./theme";
import { toast } from "./toast";

export function Lock({ color, size = 15 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={5} y={11} width={14} height={10} rx={2} stroke={color} strokeWidth={2.2} fill="none" />
      <Path d="M8 11V8a4 4 0 0 1 8 0v3" stroke={color} strokeWidth={2.2} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

export function DeckQty({ d, c, big }: { d: Deck; c: Card; big?: boolean }) {
  const t = useTheme();
  useStore();
  const n = inDeck(d, c);
  const mx = maxCopies(c);
  if (!mx)
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#c0261e22", borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6 }}>
        <Lock color="#e5484d" />
        <Text style={{ color: "#e5484d", fontWeight: "800" }}>{n ? "Bandita (" + n + ")" : "Bandita"}</Text>
      </View>
    );
  if (mx === 1 && codeTotal(d, c.code) >= 1 && !n)
    return (
      <View style={{ backgroundColor: t.surface2, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 }}>
        <Text style={{ color: t.ink2, fontWeight: "800" }}>MAX</Text>
      </View>
    );
  const err = addError(d, c);
  return (
    <QtyControl
      value={n}
      big={big}
      plusOff={!!err}
      onSet={(v) => {
        if (v <= n) deckSet(d, c, v);
        else {
          const r = deckAdd(d, c, v - n);
          if (r.er && r.a < v - n) toast(r.er);
        }
      }}
    />
  );
}

// etichetta della lista ban accanto alle copie (Bandita, Limitata, Coppia vietata, Fino a 50)
export function BanBadge({ c, d }: { c: Card; d?: Deck | null }) {
  const mx = maxCopies(c);
  let label = "",
    bg = "";
  if (!mx) [label, bg] = ["Bandita", "#c0261e"];
  else if (mx === 1) [label, bg] = ["Limitata", "#c77a0a"];
  else if (PAIRS[c.code] && (!d || (PAIRS[c.code].some((o) => codeTotal(d, o)) && codeTotal(d, c.code)))) [label, bg] = ["Coppia vietata", "#7a3fb0"];
  else if (mx === 50) [label, bg] = ["Fino a 50", "#2e7d5b"];
  if (!label) return null;
  return (
    <View style={{ backgroundColor: bg, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, alignSelf: "flex-start" }}>
      <Text style={{ color: "#fff", fontWeight: "800", fontSize: 11 }}>{label}</Text>
    </View>
  );
}
