// Home (moduli in src/home.tsx). 6 novembre 2026, scelte dell'utente: titolo senza ricerca; "In evidenza" scorrevole
// (prima il set con gli spoiler più recenti, poi un prodotto per tipo) con "La tua collezione" sotto; ultimi spoiler;
// poi, ognuna a scorrimento: Usciti di recente, All'orizzonte, Set da completare, Riprendi il mazzo.
// Barra in alto, menu Altro e barra in basso sono quelli di sempre.
import { useState } from "react";
import { ScrollView, View, useWindowDimensions } from "react-native";
import { Screen, useBarState } from "../../chrome";
import { useStore } from "../../store";
import { CollectionRow, DeckModule, GoalModule, HERO_H, HeroCarousel, Horizon, Recent, SpoilerRow, heroScroll, spoilers, useAfterIntro } from "../../home";

export default function Home() {
  const bar = useBarState();
  // copie, mazzi e carte nuove arrivate ad app aperta ridisegnano la pagina
  useStore();
  const cw = useWindowDimensions().width - 28;
  const sp = spoilers();
  // sezioni sotto lo schermo: dopo l'intro (non si vedono prima, e così l'intro finisce fluida)
  const later = useAfterIntro(200);
  // 28 novembre 2026 (direzione "Galleria" scelta dall'utente): In evidenza a tutta larghezza sotto la barra in alto, che
  // resta trasparente sopra l'illustrazione e diventa piena quando l'illustrazione esce dallo schermo
  const [solid, setSolid] = useState(false);
  return (
    <Screen bs={bar} overlay solid={solid}>
      <ScrollView
        onScroll={(e) => {
          const y = e.nativeEvent.contentOffset.y;
          bar.onScroll(e);
          // In evidenza fuori dallo schermo: la sua capsula si ferma (niente animazione mentre si scorre il resto)
          heroScroll(y);
          const sd = y > HERO_H - 120;
          if (sd !== solid) setSolid(sd);
        }}
        scrollEventThrottle={16} contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 0, paddingBottom: 28 }}>
        <View style={{ marginHorizontal: -14 }}>
          <HeroCarousel cw={cw} sp={sp} />
        </View>
        <CollectionRow />
        <SpoilerRow sp={sp} />
        {later ? (
          <>
            <Recent cw={cw} />
            <Horizon cw={cw} />
            <GoalModule cw={cw} />
            <DeckModule cw={cw} />
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
