// Home (moduli in src/home.tsx). 6 novembre 2026, scelte dell'utente: titolo senza ricerca; "In evidenza" scorrevole
// (prima il set con gli spoiler più recenti, poi un prodotto per tipo) con "La tua collezione" sotto; ultimi spoiler;
// poi, ognuna a scorrimento: Usciti di recente, All'orizzonte, Set da completare, Riprendi il mazzo.
// Barra in alto, menu Altro e barra in basso sono quelli di sempre.
import { ScrollView, useWindowDimensions } from "react-native";
import { Screen, useBarState } from "../../chrome";
import { useStore } from "../../store";
import { CollectionRow, DeckModule, GoalModule, HeroCarousel, HomeTitle, Horizon, Recent, SpoilerRow, spoilers } from "../../home";

export default function Home() {
  const bar = useBarState();
  // copie, mazzi e carte nuove arrivate ad app aperta ridisegnano la pagina
  useStore();
  const cw = useWindowDimensions().width - 28;
  const sp = spoilers();
  return (
    <Screen bs={bar}>
      <ScrollView onScroll={bar.onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 4 + bar.pad, paddingBottom: 28 }}>
        <HomeTitle />
        <HeroCarousel cw={cw} sp={sp} />
        <CollectionRow />
        <SpoilerRow sp={sp} />
        <Recent cw={cw} />
        <Horizon cw={cw} />
        <GoalModule cw={cw} />
        <DeckModule cw={cw} />
      </ScrollView>
    </Screen>
  );
}
