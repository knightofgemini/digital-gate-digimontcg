// Struttura dell'app: barra in basso (gruppo "(tabs)") e, sopra, le pagine di prodotto e carta.
// All'avvio si leggono collezione, preferite e mazzi salvati nel dispositivo.
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { loadStore } from "../store";
import { ToastHost } from "../toast";
import { useTheme } from "../theme";

export default function RootLayout() {
  const t = useTheme();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    loadStore().finally(() => setReady(true));
  }, []);
  if (!ready) return <View style={{ flex: 1, backgroundColor: t.bg }} />;
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg }, animation: "slide_from_right" }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="prodotto/[id]" />
        <Stack.Screen name="carta/[k]" options={{ animation: "slide_from_bottom" }} />
        <Stack.Screen name="mazzo/[id]" />
      </Stack>
      <ToastHost />
    </SafeAreaProvider>
  );
}
