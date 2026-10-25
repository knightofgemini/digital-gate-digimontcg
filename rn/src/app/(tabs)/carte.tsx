// Ricerca carte: ricerca (Tutto / Nome / Testo), foglio dei filtri, filtri attivi come etichette, carte a elenco o a immagini.
import { useMemo, useState } from "react";
import { CARDS, SETS, normQ, relevance } from "../../data";
import { FilterSheet } from "../../FilterSheet";
import { EMPTY, Filters, anyFlt, cardMatches, srcCards } from "../../filters";
import { CardList } from "../../items";
import { SearchHead } from "../../SearchHead";
import { useTheme } from "../../theme";
import { common } from "../../ui";
import { Screen } from "../../chrome";

// dal prodotto più recente al più vecchio, dentro lo stesso prodotto in ordine di numero
const ORDER: Record<string, number> = {};
SETS.forEach((s, i) => (ORDER[s.id] = i));
const ALL = CARDS.slice().sort((a, b) => (ORDER[a.set] ?? 999) - (ORDER[b.set] ?? 999) || a.code.localeCompare(b.code, "en", { numeric: true }));

export default function Carte() {
  const t = useTheme();
  const s = common(t);
  const [q, setQ] = useState("");
  const [f, setF] = useState<Filters>(EMPTY);
  const [open, setOpen] = useState(false);

  const list = useMemo(() => {
    const nq = normQ(q);
    const l = srcCards(f, ALL).filter((c) => cardMatches(c, nq, f));
    if (!nq || f.qm === "text") return l;
    return l
      .map((c, j) => ({ c, j, r: relevance(c, nq) }))
      .sort((a, b) => a.r - b.r || a.j - b.j)
      .map((o) => o.c);
  }, [q, f]);

  return (
    <Screen>
      <SearchHead title="Ricerca carte" q={q} setQ={setQ} f={f} setF={setF} openF={() => setOpen(true)} n={list.length} />
      <CardList list={list} empty={q || anyFlt(f) ? "Nessuna carta corrisponde ai filtri." : ""} />
      <FilterSheet visible={open} f={f} setF={setF} onClose={() => setOpen(false)} count={list.length} />
    </Screen>
  );
}
