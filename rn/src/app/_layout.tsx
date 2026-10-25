// Struttura dell'app: barra in basso (gruppo "(tabs)") e, sopra, le pagine di prodotto e carta.
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useTheme } from "../theme";

export default function RootLayout() {
  const t = useTheme();
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg }, animation: "slide_from_right" }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="prodotto/[id]" />
        <Stack.Screen name="carta/[k]" options={{ animation: "slide_from_bottom" }} />
      </Stack>
    </SafeAreaProvider>
  );
}
