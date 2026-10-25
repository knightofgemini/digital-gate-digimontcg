// Marchi dei negozi come nell'app attuale: Cardmarket (src/brand/cardmarket-mark.png colorato con --cm-ink:
// blu nel tema chiaro, bianco nello scuro) e CardTrader (simbolo a due triangoli, CTSVG; il secondo triangolo con --ct-ink).
import { Image } from "expo-image";
import Svg, { Path } from "react-native-svg";
import { useTheme } from "./theme";

const CM = require("../assets/cardmarket-mark.png");

export function CmMark({ size = 16 }: { size?: number }) {
  const t = useTheme();
  return <Image source={CM} style={{ width: size, height: size }} contentFit="contain" tintColor={t.dark ? "#ffffff" : "#012169"} accessibilityLabel="Cardmarket" />;
}

export function CtMark({ size = 16 }: { size?: number }) {
  const t = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 39.5 45.1" accessibilityLabel="CardTrader">
      <Path fill="#2aa8f8" d="m12 17.7-1.1 2-1.1 2c-.1.2-.4.4-.6.3h-1.8c-2.2 0-4.4 0-6.6 0-.4.1-.7-.2-.8-.6 0-.2 0-.4.1-.5 1.2-2.1 2.4-4.3 3.6-6.4s2.3-4 3.5-6l3.3-5.9 1.2-2.2s.1-.1.1-.1c.2-.3.3-.3.4 0l.8 1.4 3 5.3 3 5.3 2.9 5.2c.7 1.2 1.4 2.5 2.1 3.7.2.3.1.7-.2.9-.1.1-.3.1-.4.1-2.8 0-5.5 0-8.3 0-.4 0-.8-.2-.9-.5-.7-1.2-1.4-2.5-2.1-3.7z" />
      <Path fill={t.dark ? "#ffffff" : "#132545"} d="m27.4 27.4c.2-.4.4-.7.6-1 .6-1 1.1-2 1.7-3 .1-.3.4-.4.7-.4h8.3c.7 0 1 .5.6 1.1-1.1 1.9-2.1 3.8-3.2 5.7-1.3 2.2-2.5 4.4-3.8 6.7l-3.1 5.5-1.6 2.9c-.1.1-.1.1-.2.2-.1-.1-.1-.1-.2-.2l-3.2-5.8c-1.1-2-2.3-4-3.4-6.1s-2.3-4.1-3.4-6.1c-.5-1-1.1-2-1.6-2.9-.2-.3-.2-.7.1-.9.1-.1.3-.1.5-.1h8.3c.3 0 .6.2.8.5.7 1.2 1.4 2.5 2.1 3.7z" />
    </Svg>
  );
}
