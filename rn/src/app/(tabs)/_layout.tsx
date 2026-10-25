// Barra di navigazione in basso, come nell'app attuale: Home, Prodotti, Carte, Collezione, Mazzi.
import { Tabs } from "expo-router";
import { useTheme } from "../../theme";
import { Icon } from "../../ui";

const TABS: [string, string, string][] = [
  ["index", "Home", "home"],
  ["prodotti", "Prodotti", "sets"],
  ["carte", "Carte", "cards"],
  ["collezione", "Collezione", "coll"],
  ["mazzi", "Mazzi", "deck"],
];

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.accent,
        tabBarInactiveTintColor: t.ink2,
        tabBarStyle: { backgroundColor: t.surface, borderTopColor: t.line },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        tabBarHideOnKeyboard: true,
        sceneStyle: { backgroundColor: t.bg },
      }}
    >
      {TABS.map(([name, title, icon]) => (
        <Tabs.Screen key={name} name={name} options={{ title, tabBarIcon: ({ color }) => <Icon name={icon} color={String(color)} /> }} />
      ))}
    </Tabs>
  );
}
