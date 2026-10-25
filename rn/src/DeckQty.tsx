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

// copie nel mazzo (deckQty dell'app attuale): + arancione finché si può aggiungere, spento quando la carta ha le copie
// massime (o per un altro limite: il tocco mostra il motivo), "MAX" per le limitate già nel mazzo, lucchetti per le bandite
export function DeckQty({ d, c, big, fill, onChange }: { d: Deck; c: Card; big?: boolean; fill?: boolean; onChange?: (before: number, after: number) => void }) {
  useStore();
  const n = inDeck(d, c);
  const mx = maxCopies(c);
  const err = addError(d, c);
  const mode = !mx ? "lock" : mx === 1 && codeTotal(d, c.code) >= 1 ? "max" : err ? "dim" : undefined;
  return (
    <QtyControl
      value={n}
      big={big}
      fill={fill}
      plus={mode}
      numText={!mx ? (n ? "Bandita (" + n + ")" : "Bandita") : undefined}
      onBlocked={() => err && toast(err)}
      onSet={(v) => {
        if (v <= n) deckSet(d, c, v);
        else {
          const r = deckAdd(d, c, v - n);
          if (r.er && r.a < v - n) toast(r.er);
        }
        onChange && onChange(n, inDeck(d, c));
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
