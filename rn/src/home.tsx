// Moduli della Home (6 novembre 2026, nuova Home dal mockup "home-proposta" dell'utente): titolo con "Cerca una carta",
// banner del prodotto in evidenza con il testo sopra l'illustrazione, riga "La tua collezione", set da completare,
// usciti di recente (due), "All'orizzonte" compatto e mazzo da riprendere.
// Stili solo di questa pagina: i componenti condivisi (Banner, SecHead, Progress…) restano come sono.
// Dati e azioni sono quelli di prima: prodotto in evidenza = il primo delle prossime uscite (upSorted), stessa
// destinazione del banner di prima, avanzamento di setStats, mazzo più recente come DeckResume, regola "Nuovo" (60 giorni).
import { Pressable, View } from "react-native";
import { Image } from "expo-image";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { DISPLAY, Text } from "./Text";
import { CARDS, CardSet, PRODUCTS, SETS, Upcoming, bannerUrl, daysTo, logoUrl, packUrl, recentSets, soonSet, thumbUrl, typeOf, upBadge, upWhen } from "./data";
import { openDeck, openSet, openSoon, openUpcoming } from "./nav";
import { useTheme } from "./theme";
import { Icon } from "./ui";
import { goSearch, goTab } from "./chrome";
import { Btn, Glow, ICO_ARROW, ICO_PLUS, Progress } from "./visual";
import { S, owned, setStats } from "./store";
import { deckCover, deckState, deckStats, newDeck } from "./decks";
import { DBadge } from "./deckui";
import { SearchIcon } from "./BottomBar";
import { dateParts, groupName, pickGoal, upRows } from "./homeLogic";

const FILL = { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 };
// banner in evidenza: stessi colori nei due temi (illustrazione che sfuma nel blu notte, testo chiaro)
const HERO = { bg: "#0b1120", ink: "#e8edf7", title: "#f4f7fd", soft: "#a3b1cb", eyebrow: "#63d5ee", btn: "#ff7a3d", btnInk: "#1a0b03", glass: "rgba(11,17,32,.86)", edge: "rgba(232,237,247,.17)" };
const SEC_TOP = 24;

function Arrow({ color, size = 17 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={ICO_ARROW} stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}
function ChevronRight({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M9 6l6 6-6 6" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

// titoletto di sezione (come SecHead, lettere un po' più strette come nel mockup): con il testo ingrandito il titolo va a capo
// e il collegamento resta in vista (con SecHead finiva fuori dallo schermo)
function Sec({ title, link, onLink }: { title: string; link?: string; onLink?: () => void }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: SEC_TOP, marginBottom: 11 }}>
      <Text accessibilityRole="header" style={{ flex: 1, color: t.ink2, fontFamily: DISPLAY, fontWeight: "600", fontSize: 12.5, lineHeight: 18, letterSpacing: 2, textTransform: "uppercase" }}>
        {title}
      </Text>
      {link ? (
        <Pressable onPress={onLink} hitSlop={8} accessibilityRole="link" style={{ minHeight: 30, justifyContent: "center", paddingVertical: 4 }}>
          <Text style={{ color: t.cyan, fontWeight: "600", fontSize: 13.6 }}>{link}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// ---- titolo "Home" e accesso alla ricerca vera (scheda Carte con la tastiera aperta)
export function HomeTitle() {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 8, marginBottom: 14 }}>
      <Text accessibilityRole="header" style={{ color: t.ink, fontFamily: DISPLAY, fontWeight: "700", fontSize: 25, lineHeight: 29, letterSpacing: -0.6 }}>
        Home
      </Text>
      <Pressable onPress={goSearch} accessibilityRole="button" accessibilityLabel="Cerca una carta" style={{ minHeight: 44, flexShrink: 1, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: t.line, backgroundColor: t.surface }}>
        <SearchIcon color={t.ink2} size={16} />
        <Text style={{ flexShrink: 1, color: t.ink2, fontSize: 13.4 }} numberOfLines={1}>
          Cerca una carta
        </Text>
      </Pressable>
    </View>
  );
}

// ---- banner del prodotto in evidenza
// conto alla rovescia di upBadge ("35 gg" → "tra 35 gg"; "Questo mese", "Oggi", "Data da definire" restano così)
const upStatus = (u: Upcoming) => {
  const b = upBadge(u);
  return /^\d/.test(b) ? "tra " + b : b;
};

// senza illustrazione: il ripiego del progetto (confezione, logo o codice su sfondo sfumato)
function HeroFallback({ code }: { code: string }) {
  const pk = packUrl(code);
  const lg = !pk ? logoUrl(code) : null;
  return (
    <View style={FILL}>
      <Glow id={"hero" + code} kind="bn" />
      {pk ? (
        <Image source={pk} style={{ position: "absolute", top: 44, bottom: 130, left: 0, right: 0 }} contentFit="contain" cachePolicy="disk" />
      ) : lg ? (
        <Image source={lg} style={{ position: "absolute", top: 54, height: 76, left: "12%", right: "12%" }} contentFit="contain" cachePolicy="disk" />
      ) : (
        <View style={{ position: "absolute", top: 54, left: 0, right: 0, alignItems: "center" }}>
          <Text style={{ color: "rgba(255,255,255,.9)", fontFamily: DISPLAY, fontWeight: "700", fontStyle: "italic", fontSize: 44, letterSpacing: 1.5 }}>{code}</Text>
        </View>
      )}
    </View>
  );
}

export function Hero({ u }: { u: Upcoming }) {
  const has = !!PRODUCTS[u.code];
  // stessa destinazione del banner di prima: scheda del prodotto (o pagina degli spoiler), altrimenti il calendario
  const go = () => (has ? openUpcoming(u.code, "home") : openSoon());
  const b = bannerUrl(u.code);
  const dp = dateParts(u);
  const ty = typeOf(u.code);
  const cta = !has ? "Vedi il calendario" : ty === "BT" || ty === "EX" ? "Scopri il set" : "Scopri il prodotto";
  const eyebrow = [u.code, u.kind, upStatus(u)].filter(Boolean).join(" · ");
  return (
    <Pressable onPress={go} accessibilityRole="button" accessibilityLabel={"In evidenza: " + u.code + " " + u.name + ", " + upWhen(u) + ". " + cta} style={{ minHeight: 276, borderRadius: 16, overflow: "hidden", backgroundColor: HERO.bg, padding: 15, justifyContent: "space-between" }}>
      {b ? <Image source={b} style={FILL} contentFit="cover" contentPosition={{ left: "42%", top: "27%" }} cachePolicy="disk" transition={120} /> : <HeroFallback code={u.code} />}
      {/* sfumatura in una vista a tutta superficie: con width/height "100%" sull'Svg la misura sarebbe quella
          interna (meno il margine di 15) e la sfumatura non arriverebbe al bordo destro e in fondo */}
      <View pointerEvents="none" style={FILL}>
        <Svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 10 100">
          <Defs>
            <LinearGradient id="heroFade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={HERO.bg} stopOpacity={0.15} />
              <Stop offset="0.18" stopColor={HERO.bg} stopOpacity={0.15} />
              <Stop offset="0.35" stopColor={HERO.bg} stopOpacity={0.25} />
              <Stop offset="0.72" stopColor={HERO.bg} stopOpacity={0.91} />
              <Stop offset="1" stopColor={HERO.bg} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect width="10" height="100" fill="url(#heroFade)" />
        </Svg>
      </View>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <View style={{ borderRadius: 6, borderWidth: 1, borderColor: HERO.edge, backgroundColor: HERO.glass, paddingVertical: 5, paddingHorizontal: 8 }}>
          <Text style={{ color: HERO.ink, fontFamily: DISPLAY, fontWeight: "600", fontSize: 10.5, lineHeight: 14, letterSpacing: 1.4 }}>IN EVIDENZA</Text>
        </View>
        {dp ? (
          <View accessible accessibilityLabel={dp.label} style={{ minWidth: 46, alignItems: "center", borderRadius: 9, borderWidth: 1, borderColor: HERO.edge, backgroundColor: HERO.glass, paddingVertical: 6, paddingHorizontal: 8 }}>
            <Text style={{ color: HERO.ink, fontFamily: DISPLAY, fontWeight: "700", fontSize: 22, lineHeight: 24 }}>{dp.big}</Text>
            <Text style={{ color: HERO.soft, fontFamily: DISPLAY, fontWeight: "600", fontSize: 10, lineHeight: 14, letterSpacing: 1.3 }}>{dp.small}</Text>
          </View>
        ) : null}
      </View>
      <View style={{ paddingTop: 36 }}>
        <Text style={{ color: HERO.eyebrow, fontFamily: DISPLAY, fontWeight: "600", fontSize: 10.5, lineHeight: 14, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 3 }}>{eyebrow}</Text>
        <Text style={{ color: HERO.title, fontFamily: DISPLAY, fontWeight: "700", fontSize: 29, lineHeight: 32, letterSpacing: -0.4, marginBottom: 12 }}>{u.name}</Text>
        <Pressable onPress={go} accessibilityRole="button" accessibilityLabel={cta + ": " + u.name} style={{ minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, paddingHorizontal: 15, borderRadius: 10, backgroundColor: HERO.btn }}>
          <Text style={{ color: HERO.btnInk, fontWeight: "600", fontSize: 14 }}>{cta}</Text>
          <Arrow color={HERO.btnInk} />
        </Pressable>
      </View>
    </Pressable>
  );
}

// ---- accesso alla collezione: "carte diverse" come nel riepilogo della Collezione e nel menu Altro
// (una voce per ogni carta posseduta, le copie non contano)
export function CollectionRow() {
  const t = useTheme();
  let n = 0;
  CARDS.forEach((c) => owned(c) && n++);
  const word = n === 1 ? "carta" : "carte";
  return (
    <Pressable onPress={() => goTab("coll")} accessibilityRole="button" accessibilityLabel={"La tua collezione: " + n + " " + word} style={{ marginTop: 14, minHeight: 50, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: t.line, backgroundColor: t.surface }}>
      <Icon name="coll" color={t.cyan} size={19} />
      <Text style={{ flex: 1, color: t.ink2, fontSize: 13.4 }} numberOfLines={1}>
        La tua collezione
      </Text>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
        <Text style={{ color: t.ink, fontFamily: DISPLAY, fontWeight: "700", fontSize: 18, fontVariant: ["tabular-nums"] }}>{n.toLocaleString("it-IT")}</Text>
        <Text style={{ color: t.ink2, fontSize: 12 }}>{word}</Text>
      </View>
      <ChevronRight color={t.cyan} />
    </Pressable>
  );
}

// ---- un set da completare
// ritaglio dell'illustrazione del prodotto; senza: confezione, logo o codice
function SetArt({ code, w, h }: { code: string; w: number; h: number }) {
  const t = useTheme();
  const b = bannerUrl(code);
  const pk = !b ? packUrl(code) : null;
  const lg = !b && !pk ? logoUrl(code) : null;
  return (
    <View style={{ width: w, height: h, borderRadius: 9, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: b ? "#1a2540" : t.surface2 }}>
      {b ? (
        <Image source={b} style={FILL} contentFit="cover" contentPosition={{ left: "58%", top: "50%" }} cachePolicy="disk" transition={120} />
      ) : pk ? (
        <Image source={pk} style={{ width: "92%", height: "92%" }} contentFit="contain" cachePolicy="disk" />
      ) : lg ? (
        <Image source={lg} style={{ width: "90%", height: "60%" }} contentFit="contain" cachePolicy="disk" />
      ) : (
        <Text style={{ color: t.ink2, fontFamily: DISPLAY, fontWeight: "700", fontStyle: "italic", fontSize: 14 }}>{code}</Text>
      )}
    </View>
  );
}

// nessuna carta nella collezione: invito a cominciare (stesso testo della Collezione vuota)
function StartCollection() {
  const t = useTheme();
  return (
    <>
      <Sec title="Inizia la collezione" />
      <View style={{ gap: 12, padding: 13, borderRadius: 14, borderWidth: 1, borderColor: t.line, backgroundColor: t.surface }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: t.cyanSoft }}>
            <Icon name="coll" color={t.cyan} size={22} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: t.ink, fontFamily: DISPLAY, fontWeight: "700", fontSize: 16, lineHeight: 20 }}>La prima carta inizia da qui</Text>
            <Text style={{ color: t.ink2, fontSize: 12.8, lineHeight: 18, marginTop: 2 }}>Cerca una carta o apri un prodotto e tocca + per segnare le copie che hai.</Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Btn label="Cerca carte" pri height={44} fs={13.6} onPress={goSearch} style={{ flex: 1, paddingHorizontal: 10 }} />
          <Btn label="Prodotti" height={44} fs={13.6} onPress={() => goTab("sets")} style={{ flex: 1, paddingHorizontal: 10 }} />
        </View>
      </View>
    </>
  );
}

export function GoalModule() {
  const t = useTheme();
  if (!Object.keys(S.qty).length) return <StartCollection />;
  const stats = setStats();
  const g = pickGoal(SETS, stats, (s) => !soonSet(s));
  // nessun set iniziato e incompleto: niente modulo (e niente titolo)
  if (!g) return null;
  const st = stats[g.id];
  const miss = st.n - st.h;
  const missTxt = miss === 1 ? "Ti manca 1 carta" : "Ti mancano " + miss + " carte";
  // pagina del prodotto con le sole carte mancanti
  const go = () => openSet(g.id, "home", true);
  return (
    <>
      <Sec title="Un set da completare" link="Mancanti →" onLink={go} />
      <Pressable onPress={go} accessibilityRole="button" accessibilityLabel={g.code + " " + g.name + ": " + st.h + " su " + st.n + ". " + missTxt} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 13, borderRadius: 14, borderWidth: 1, borderColor: t.line, backgroundColor: t.surface }}>
        <View style={{ position: "absolute", left: -1, top: 18, bottom: 18, width: 3, borderRadius: 2, backgroundColor: t.cyan }} />
        <SetArt code={g.code} w={65} h={91} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6, marginBottom: 2 }}>
            <View style={{ borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, backgroundColor: t.cyanSoft }}>
              <Text style={{ color: t.cyan, fontFamily: DISPLAY, fontWeight: "600", fontSize: 10.5, lineHeight: 15, letterSpacing: 0.6 }}>{g.code}</Text>
            </View>
            <Text style={{ color: t.ink2, fontFamily: DISPLAY, fontWeight: "600", fontSize: 11.5, fontVariant: ["tabular-nums"] }}>
              {st.h} / {st.n}
            </Text>
          </View>
          <Text style={{ color: t.ink, fontFamily: DISPLAY, fontWeight: "700", fontSize: 16, lineHeight: 20, marginTop: 1, marginBottom: 8 }}>{g.name}</Text>
          <Progress h={st.h} n={st.n} height={5} color={t.cyan} />
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, minHeight: 31, paddingTop: 9 }}>
            <Text style={{ flex: 1, color: t.cyan, fontWeight: "600", fontSize: 12.8 }}>{missTxt}</Text>
            <Arrow color={t.cyan} size={16} />
          </View>
        </View>
      </Pressable>
    </>
  );
}

// ---- usciti di recente: i primi due di recentSets (stessa scelta e stesso ordine di prima)
function RecentCard({ x, st }: { x: CardSet; st?: { n: number; h: number } }) {
  const t = useTheme();
  const isNew = daysTo(x.date) >= -60;
  const has = !!st && st.n > 0;
  const done = has && st!.h === st!.n;
  const b = bannerUrl(x.code);
  return (
    <Pressable onPress={() => openSet(x.id, "home")} accessibilityRole="button" accessibilityLabel={x.code + " " + x.name + (isNew ? ", nuovo" : "") + (has ? ": " + st!.h + " su " + st!.n + " carte" : "")} style={{ flex: 1, minWidth: 0, borderRadius: 12, borderWidth: 1, borderColor: t.line, backgroundColor: t.surface, overflow: "hidden" }}>
      <View style={{ width: "100%", aspectRatio: 1.6, alignItems: "center", justifyContent: "center", backgroundColor: "#1a2540" }}>
        {b ? (
          <Image source={b} style={FILL} contentFit="cover" contentPosition={{ left: "50%", top: "40%" }} cachePolicy="disk" transition={120} />
        ) : (
          <Text style={{ color: "#c7d2e8", fontFamily: DISPLAY, fontWeight: "700", fontStyle: "italic", fontSize: 22 }}>{x.code}</Text>
        )}
      </View>
      <View style={{ flex: 1, paddingHorizontal: 10, paddingTop: 10, paddingBottom: 11 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 5 }}>
          <Text style={{ color: t.cyan, fontFamily: DISPLAY, fontWeight: "600", fontSize: 10.5, lineHeight: 15, letterSpacing: 0.6 }}>{x.code}</Text>
          {isNew ? (
            <View style={{ borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1, backgroundColor: t.dark ? "#163329" : "#eaf6ed" }}>
              <Text style={{ color: t.ok, fontFamily: DISPLAY, fontWeight: "600", fontSize: 9.5, lineHeight: 13 }}>NUOVO</Text>
            </View>
          ) : null}
        </View>
        <Text style={{ minHeight: 36, color: t.ink, fontFamily: DISPLAY, fontWeight: "700", fontSize: 14, lineHeight: 18, letterSpacing: 0.05, textTransform: "uppercase", marginTop: 5, marginBottom: 8 }}>{x.name}</Text>
        {has ? (
          <View style={{ marginTop: "auto" }}>
            <Progress h={st!.h} n={st!.n} height={5} color={done ? t.ok : t.cyan} />
            <Text style={{ color: done ? t.ok : t.ink2, fontFamily: DISPLAY, fontWeight: "600", fontSize: 10.5, marginTop: 5, fontVariant: ["tabular-nums"] }}>
              {st!.h} / {st!.n} carte
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

export function Recent() {
  const stats = setStats();
  const list = recentSets(2);
  if (!list.length) return null;
  return (
    <>
      <Sec title="Usciti di recente" link="Tutti →" onLink={() => goTab("sets")} />
      <View style={{ flexDirection: "row", gap: 12 }}>
        {list.map((x) => (
          <RecentCard key={x.id} x={x} st={stats[x.id]} />
        ))}
        {list.length < 2 ? <View style={{ flex: 1 }} /> : null}
      </View>
    </>
  );
}

// ---- All'orizzonte: al massimo due righe; i prodotti dello stesso giorno (data esatta, stesso tipo, stesse uscite per
// regione) stanno in una riga sola, che apre il calendario dove ognuno ha la sua voce
const relKey = (u: { code: string }) => {
  const p = PRODUCTS[u.code];
  return JSON.stringify((p && p.rel) || []);
};

function PackThumb({ code }: { code: string }) {
  const t = useTheme();
  const pk = packUrl(code);
  if (pk) return <Image source={pk} style={{ width: 29, height: 46 }} contentFit="contain" cachePolicy="disk" />;
  const b = bannerUrl(code);
  const lg = !b ? logoUrl(code) : null;
  return (
    <View style={{ width: 29, height: 46, borderRadius: 5, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: b ? "#1a2540" : t.surface2 }}>
      {b ? (
        <Image source={b} style={FILL} contentFit="cover" cachePolicy="disk" />
      ) : lg ? (
        <Image source={lg} style={{ width: 27, height: 27 }} contentFit="contain" cachePolicy="disk" />
      ) : (
        <Text style={{ color: t.ink2, fontFamily: DISPLAY, fontWeight: "700", fontSize: 8.5 }} numberOfLines={1} adjustsFontSizeToFit>
          {code}
        </Text>
      )}
    </View>
  );
}

function HorizonRow({ r, first }: { r: Upcoming[]; first: boolean }) {
  const t = useTheme();
  const u = r[0];
  const one = r.length === 1;
  const dp = dateParts(u);
  // un prodotto: la sua scheda (o il calendario se non c'è, come prima); più prodotti: il calendario
  const go = () => (one && PRODUCTS[u.code] ? openUpcoming(u.code, "home") : openSoon());
  const name = groupName(r.map((x) => x.name));
  const codes = r.map((x) => x.code).join(" + ");
  return (
    <Pressable onPress={go} accessibilityRole="button" accessibilityLabel={(dp ? dp.label : "Data da definire") + ": " + codes + ", " + name} style={{ flexDirection: "row", alignItems: "center", gap: 11, padding: 12, borderTopWidth: first ? 0 : 1, borderTopColor: t.line }}>
      <View style={{ minWidth: 44, alignItems: "center", paddingRight: 11, borderRightWidth: 1, borderRightColor: t.line }}>
        {dp ? (
          <>
            <Text style={{ color: t.cyan, fontFamily: DISPLAY, fontWeight: "700", fontSize: 21, lineHeight: 23 }}>{dp.big}</Text>
            <Text style={{ color: t.cyan, fontFamily: DISPLAY, fontWeight: "600", fontSize: 10, lineHeight: 14, letterSpacing: 1 }}>{dp.small}</Text>
          </>
        ) : (
          <Text style={{ color: t.cyan, fontFamily: DISPLAY, fontWeight: "600", fontSize: 10, lineHeight: 13, letterSpacing: 0.8, textAlign: "center" }}>{"DA\nDEFINIRE"}</Text>
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: t.ink, fontFamily: DISPLAY, fontWeight: "600", fontSize: 14.5, lineHeight: 20 }} numberOfLines={2}>
          {name}
        </Text>
        <Text style={{ color: t.ink2, fontSize: 11.8, lineHeight: 17 }}>
          {codes}
          {u.kind ? " · " + u.kind : ""}
        </Text>
      </View>
      <View style={{ flexDirection: "row", gap: 4 }}>
        {r.map((x) => (
          <PackThumb key={x.code} code={x.code} />
        ))}
      </View>
    </Pressable>
  );
}

export function Horizon({ ups }: { ups: Upcoming[] }) {
  const t = useTheme();
  const rows = upRows(ups, 2, relKey);
  if (!rows.length) return null;
  return (
    <>
      <Sec title="All’orizzonte" link="Calendario →" onLink={openSoon} />
      <View style={{ borderRadius: 12, borderWidth: 1, borderColor: t.line, backgroundColor: t.surface, overflow: "hidden" }}>
        {rows.map((r, i) => (
          <HorizonRow key={r[0].code} r={r} first={i === 0} />
        ))}
      </View>
    </>
  );
}

// ---- mazzo da riprendere (il più recente, come DeckResume) o invito a creare il primo
export function DeckModule() {
  const t = useTheme();
  const last = S.decks.slice().sort((a, b) => (b.upd || 0) - (a.upd || 0))[0];
  const box = { flexDirection: "row" as const, alignItems: "center" as const, gap: 12, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: t.line, backgroundColor: t.surface };
  if (!last)
    return (
      <>
        <Sec title="Deckbuilding" link="I tuoi mazzi →" onLink={() => goTab("deck")} />
        <Pressable onPress={() => openDeck(newDeck("Nuovo mazzo 1").id)} accessibilityRole="button" accessibilityLabel="Crea il tuo primo mazzo" style={box}>
          <View style={{ width: 46, height: 64, alignItems: "center", justifyContent: "center", borderRadius: 6, borderWidth: 1.5, borderStyle: "dashed", borderColor: t.line }}>
            <Svg width={22} height={22} viewBox="0 0 24 24">
              <Path d={ICO_PLUS} stroke={t.accent} strokeWidth={2.2} strokeLinecap="round" fill="none" />
            </Svg>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: t.ink, fontFamily: DISPLAY, fontWeight: "700", fontSize: 16, lineHeight: 21 }}>Il tuo primo mazzo</Text>
            <Text style={{ color: t.ink2, fontSize: 12.5, lineHeight: 17, marginTop: 2 }}>Regole e lista ban vengono controllate mentre lo componi.</Text>
          </View>
          <Arrow color={t.accent} size={18} />
        </Pressable>
      </>
    );
  const s = deckStats(last);
  const [k, label] = deckState(s);
  const cv = deckCover(last);
  return (
    <>
      <Sec title="Riprendi il mazzo" link="I tuoi mazzi →" onLink={() => goTab("deck")} />
      <Pressable onPress={() => openDeck(last.id)} accessibilityRole="button" accessibilityLabel={"Riprendi il mazzo " + last.name + ": principale " + s.main + " su 50, Digi-Egg " + s.egg + " su 5, " + label} style={box}>
        <View style={{ width: 46, height: 64, marginLeft: 2, borderRadius: 5, transform: [{ rotate: "-7deg" }], boxShadow: `4px 2px 0 ${t.surface2}` }}>
          <View style={{ flex: 1, borderRadius: 5, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: t.surface2 }}>
            {cv ? <Image source={thumbUrl(cv)} style={FILL} contentFit="cover" cachePolicy="disk" recyclingKey={cv.k} /> : <Icon name="deck" color={t.ink2} size={20} />}
          </View>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          {/* nome lungo o testo ingrandito: l'etichetta dello stato va sotto e il nome va a capo (non tagliato) */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 8, rowGap: 3, marginBottom: 3 }}>
            <Text style={{ flexShrink: 1, color: t.ink, fontFamily: DISPLAY, fontWeight: "700", fontSize: 16, lineHeight: 21 }} numberOfLines={2}>
              {last.name}
            </Text>
            <DBadge k={k} label={label} />
          </View>
          <Text style={{ color: t.ink2, fontSize: 11.8, lineHeight: 16, marginBottom: 8 }}>
            {s.main}/50 carte · {s.egg}/5 Digi-Egg
          </Text>
          <Progress h={Math.min(s.main, 50)} n={50} height={5} color={t.accent} />
        </View>
        <Arrow color={t.accent} size={18} />
      </Pressable>
    </>
  );
}
