// Struttura dell'app: schede principali (gruppo "(tabs)") e, sopra, le pagine di prodotto, carta, mazzo…
// La barra di navigazione in basso è una sola per tutta l'app (come nell'app attuale resta anche nelle pagine di prodotto e mazzo).
// All'avvio si leggono caratteri, tema scelto, collezione, preferite e mazzi salvati nel dispositivo.
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { loadStore } from "../store";
import { ToastHost } from "../toast";
import { FavSheetHost } from "../FavSheet";
import { UpdateCheck } from "../Update";
import { loadThemePref, useTheme } from "../theme";
import { FONTS } from "../Text";
import { KbProbe, MoreSheet, TabBar, useTabPad } from "../chrome";
import { Intro } from "../Intro";
import { loadImages } from "../imgstore";
import { startOffline } from "../offline";
import { Migrate, needMigration } from "../Migrate";
import { loadSavedPrices, refreshPrices } from "../prices";

function Root() {
  const t = useTheme();
  const pad = useTabPad();
  const withBar = { backgroundColor: t.bg, paddingBottom: pad };
  return (
    <>
      <KbProbe />
      <StatusBar style={t.dark ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: withBar, animation: "slide_from_right" }}>
        <Stack.Screen name="(tabs)" options={{ contentStyle: { backgroundColor: t.bg } }} />
        <Stack.Screen name="prodotto/[id]" />
        <Stack.Screen name="carta/[k]" options={{ animation: "slide_from_bottom", contentStyle: { backgroundColor: t.bg } }} />
        <Stack.Screen name="mazzo/[id]" />
        <Stack.Screen name="scansiona" options={{ animation: "fade", presentation: "fullScreenModal", contentStyle: { backgroundColor: "#000" } }} />
        <Stack.Screen name="offline" />
        <Stack.Screen name="info" />
      </Stack>
      <TabBar />
      <MoreSheet />
      <ToastHost />
      <FavSheetHost />
      <UpdateCheck />
      <Intro />
    </>
  );
}

export default function RootLayout() {
  const t = useTheme();
  const [ready, setReady] = useState(false);
  const [fonts, fontErr] = useFonts(FONTS);
  const [migr, setMigr] = useState(false);
  useEffect(() => {
    Promise.all([loadStore(), loadThemePref(), loadImages(), loadSavedPrices()]).finally(async () => {
      // prima volta dopo l'installazione sopra l'app attuale: si recuperano i suoi dati prima di scaricare qualunque cosa
      const m = await needMigration();
      setMigr(m);
      setReady(true);
      if (!m) startOffline();
      refreshPrices();
    });
  }, []);
  if (!ready || (!fonts && !fontErr)) return <View style={{ flex: 1, backgroundColor: t.bg }} />;
  return (
    <SafeAreaProvider>
      <Root />
      {migr && (
        <Migrate
          onDone={() => {
            setMigr(false);
            startOffline();
          }}
        />
      )}
    </SafeAreaProvider>
  );
}
