// Home (6 novembre 2026, nuova Home dal mockup dell'utente; moduli in src/home.tsx): titolo con "Cerca una carta",
// prodotto in evidenza (il primo delle prossime uscite) con il testo sopra l'illustrazione, "La tua collezione",
// un set da completare, usciti di recente (due), "All'orizzonte" (al massimo due righe) e il mazzo da riprendere.
// Barra in alto, menu Altro e barra in basso sono quelli di sempre.
import { ScrollView } from "react-native";
import { upSorted } from "../../data";
import { Screen, useBarState } from "../../chrome";
import { useStore } from "../../store";
import { CollectionRow, DeckModule, GoalModule, Hero, HomeTitle, Horizon, Recent } from "../../home";

export default function Home() {
  const bar = useBarState();
  // copie, mazzi e carte nuove arrivate ad app aperta ridisegnano la pagina
  useStore();
  const ups = upSorted();
  const u0 = ups[0];
  return (
    <Screen bs={bar}>
      <ScrollView onScroll={bar.onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 4 + bar.pad, paddingBottom: 28 }}>
        <HomeTitle />
        {u0 ? <Hero u={u0} /> : null}
        <CollectionRow />
        <GoalModule />
        <Recent />
        <Horizon ups={ups.slice(1)} />
        <DeckModule />
      </ScrollView>
    </Screen>
  );
}
