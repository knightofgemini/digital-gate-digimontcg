// Ricerca carte (come l'app attuale sul telefono): titolo, "N carte" con la vista elenco/immagini, carte nell'ordine
// dei dati (dalle più recenti svelate); ricerca, fotocamera e Filtri nella barra in basso, filtri attivi come etichette.
import { useMemo, useState } from "react";
import { CARDS, normQ, relevance } from "../../data";
import { ActiveChips, FilterSheet, fltCount } from "../../FilterSheet";
import { EMPTY, Filters, anyFlt, cardMatches, qmHolder, srcCards } from "../../filters";
import { CardList, CountRow } from "../../items";
import { PageTitle } from "../../ui";
import { Screen } from "../../chrome";
import { BOTTOM_PAD, BottomBar } from "../../BottomBar";
import { View } from "react-native";

export default function Carte() {
  const [q, setQ] = useState("");
  const [f, setF] = useState<Filters>(EMPTY);
  const [open, setOpen] = useState(false);
  const nf = fltCount(f);

  const list = useMemo(() => {
    const nq = normQ(q);
    const l = srcCards(f, CARDS).filter((c) => cardMatches(c, nq, f));
    if (!nq || f.qm === "text") return l;
    return l
      .map((c, j) => ({ c, j, r: relevance(c, nq) }))
      .sort((a, b) => a.r - b.r || a.j - b.j)
      .map((o) => o.c);
  }, [q, f]);

  return (
    <Screen>
      <CardList
        list={list}
        padBottom={BOTTOM_PAD + (nf ? 42 : 0)}
        header={
          <View style={{ paddingTop: 4 }}>
            <PageTitle>Ricerca carte</PageTitle>
            {list.length ? <CountRow n={list.length} top={8} /> : null}
          </View>
        }
        empty={q || anyFlt(f) || f.qm ? "Nessuna carta corrisponde ai filtri." : ""}
      />
      <BottomBar q={q} setQ={setQ} placeholder={qmHolder(f.qm)} cam filter={{ n: nf, onPress: () => setOpen(true) }} chips={nf ? <ActiveChips f={f} setF={setF} /> : undefined} />
      <FilterSheet visible={open} f={f} setF={setF} onClose={() => setOpen(false)} count={list.length} />
    </Screen>
  );
}
