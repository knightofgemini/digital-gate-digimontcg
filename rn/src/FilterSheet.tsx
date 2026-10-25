// Foglio "Filtri" dal basso (telefono): tutte le tendine del sito in un'unica pagina, una sezione per filtro.
// Colore, Attributo e Tipo a scelta multipla; gli altri a scelta singola. Le parole delle carte restano in inglese.
import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { Text, TextInput } from "./Text";
import { SafeAreaView } from "react-native-safe-area-context";
import { fold } from "./data";
import { DDN, EMPTY, Filters, Kind, MULTI, anyFlt, ddFix, ddKinds, ddOptions, fl } from "./filters";
import { useTheme } from "./theme";

export function FilterSheet({ visible, f, setF, onClose, count, lockExp }: { visible: boolean; f: Filters; setF: (f: Filters) => void; onClose: () => void; count: number; lockExp?: boolean }) {
  const t = useTheme();
  const [find, setFind] = useState("");
  const kinds = ddKinds(f).filter((k) => k !== "qm" && !(lockExp && k === "exp"));

  function pick(kind: Kind, v: string) {
    let n: Filters = { ...f };
    if (MULTI[kind] && v) {
      const a = fl(f, kind);
      const i = a.indexOf(v);
      if (i >= 0) a.splice(i, 1);
      else a.push(v);
      n[kind] = a.join("|");
    } else n[kind] = f[kind] === v ? "" : v;
    if (kind === "ct") n = ddFix(n);
    setF(n);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,.55)" }} onPress={onClose} />
      <SafeAreaView edges={["bottom"]} style={{ backgroundColor: t.bg, borderTopLeftRadius: 18, borderTopRightRadius: 18, maxHeight: "86%" }}>
        <View style={{ alignItems: "center", paddingTop: 8 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: t.line }} />
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10 }}>
          <Text style={{ color: t.ink, fontSize: 20, fontWeight: "800" }}>Filtri</Text>
          {anyFlt(f) && (
            <Pressable onPress={() => setF({ ...EMPTY, qm: f.qm, exp: lockExp ? f.exp : "" })} hitSlop={8}>
              <Text style={{ color: t.accent, fontWeight: "700" }}>Azzera</Text>
            </Pressable>
          )}
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }} keyboardShouldPersistTaps="handled">
          {kinds.map((kind) => (
            <Section key={kind + f.ct} kind={kind} f={f} pick={pick} find={kind === "sp" ? find : ""} setFind={kind === "sp" ? setFind : undefined} />
          ))}
        </ScrollView>
        <Pressable onPress={onClose} style={{ margin: 16, marginTop: 4, backgroundColor: t.accent, borderRadius: 12, paddingVertical: 14, alignItems: "center" }}>
          <Text style={{ color: t.accentInk, fontWeight: "800", fontSize: 16 }}>Mostra {count + (count === 1 ? " carta" : " carte")}</Text>
        </Pressable>
      </SafeAreaView>
    </Modal>
  );
}

function Section({ kind, f, pick, find, setFind }: { kind: Kind; f: Filters; pick: (k: Kind, v: string) => void; find: string; setFind?: (s: string) => void }) {
  const t = useTheme();
  const opts = useMemo(() => ddOptions(kind, f), [kind, f.ct]);
  const [more, setMore] = useState(false);
  const ff = fold(find);
  let list = opts.filter((o) => o[0] !== "");
  if (kind === "sp") {
    // i tipi sono centinaia: si cercano, oppure si mostrano tutti a richiesta (quelli scelti sempre)
    const chosen = fl(f, "sp");
    list = list.filter((o) => (ff ? fold(o[1]).indexOf(ff) >= 0 : more || chosen.indexOf(o[0]!) >= 0));
  }
  const isOn = (v: string) => (MULTI[kind] ? fl(f, kind).indexOf(v) >= 0 : f[kind] === v);
  return (
    <View style={{ marginTop: 12 }}>
      <Text style={{ color: t.ink2, fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>
        {DDN[kind]}
        {MULTI[kind] ? " · anche più di uno" : ""}
      </Text>
      {setFind && (
        <TextInput value={find} onChangeText={setFind} placeholder="Cerca un tipo, es. Dragonkin" placeholderTextColor={t.ink2} autoCorrect={false} style={{ backgroundColor: t.surface, borderColor: t.line, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, color: t.ink, marginBottom: 8 }} />
      )}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {list.map((o, i) =>
          o[0] === null ? (
            <Text key={"g" + i} style={{ width: "100%", color: t.ink2, fontSize: 12, marginTop: 6 }}>
              {o[1]}
            </Text>
          ) : (
            <Pressable key={o[0]} onPress={() => pick(kind, o[0]!)} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: isOn(o[0]) ? t.accent : t.line, backgroundColor: isOn(o[0]) ? t.accent : t.surface }}>
              {kind === "color" && <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: t.cards[o[0]] }} />}
              <Text style={{ color: isOn(o[0]) ? t.accentInk : t.ink, fontWeight: "600", fontSize: 13 }}>{o[1]}</Text>
            </Pressable>
          )
        )}
      </View>
      {kind === "sp" && !ff && (
        <Pressable onPress={() => setMore(!more)} style={{ marginTop: 8 }}>
          <Text style={{ color: t.accent, fontWeight: "700" }}>{more ? "Mostra meno" : "Mostra tutti i tipi (" + (opts.length - 1) + ")"}</Text>
        </Pressable>
      )}
    </View>
  );
}

// etichette dei filtri attivi sotto la ricerca, ognuna con ✕ per toglierla
export function ActiveChips({ f, setF, lockExp }: { f: Filters; setF: (f: Filters) => void; lockExp?: boolean }) {
  const t = useTheme();
  const chips: [Kind, string, string][] = [];
  (Object.keys(f) as Kind[]).forEach((k) => {
    if (k === "qm" || !f[k] || (lockExp && k === "exp")) return;
    if (MULTI[k]) fl(f, k).forEach((v) => chips.push([k, v, v]));
    else chips.push([k, f[k], k === "exp" ? ddOptions("exp", f).find((o) => o[0] === f.exp)?.[1] || f.exp : (k === "lv" || k === "cost" ? DDN[k] + " " : "") + f[k]]);
  });
  if (!chips.length) return null;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
      {chips.map(([k, v, label]) => (
        <Pressable
          key={k + v}
          onPress={() => {
            const n = { ...f };
            n[k] = MULTI[k]
              ? fl(f, k)
                  .filter((x) => x !== v)
                  .join("|")
              : "";
            setF(k === "ct" ? ddFix(n) : n);
          }}
          style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, backgroundColor: t.surface2 }}
        >
          {k === "color" && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.cards[v] }} />}
          <Text style={{ color: t.ink, fontSize: 13, fontWeight: "600" }}>{label}</Text>
          <Text style={{ color: t.ink2, fontSize: 13 }}>✕</Text>
        </Pressable>
      ))}
    </View>
  );
}
