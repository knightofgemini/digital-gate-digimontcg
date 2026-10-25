// Schede principali: Home, Prodotti, Carte, Collezione, Mazzi. La barra in basso è quella comune (TabBar in chrome.tsx),
// disegnata dal layout principale così resta anche nelle pagine aperte sopra (prodotto, mazzo, informazioni…).
import { Tabs } from "expo-router";
import { useTheme } from "../../theme";
import { useTabPad } from "../../chrome";

export default function TabsLayout() {
  const t = useTheme();
  const pad = useTabPad();
  return (
    <Tabs tabBar={() => null} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: t.bg, paddingBottom: pad } }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="prodotti" />
      <Tabs.Screen name="carte" />
      <Tabs.Screen name="collezione" />
      <Tabs.Screen name="mazzi" />
    </Tabs>
  );
}
