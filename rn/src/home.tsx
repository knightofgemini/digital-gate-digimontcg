// Moduli della Home. 6 novembre 2026: nuova Home dal mockup "home-proposta" dell'utente; poi (stesso giorno, richieste
// dell'utente) niente ricerca nel titolo, file scorrevoli in ogni sezione e ordine: In evidenza (con "La tua
// collezione" sotto), Ultimi spoiler, Usciti di recente, All'orizzonte, Set da completare, Riprendi il mazzo.
// Ultimi spoiler: sezione a sé (SpoilerRow, scelta dell'utente tra due proposte; scartate le miniature nel banner).
// Stili solo di questa pagina: i componenti condivisi (Banner, SecHead, Progress…) restano come sono.
import { ReactNode, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Image } from "expo-image";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { DISPLAY, Text } from "./Text";
import { CARDS, Card, CardSet, PRODUCTS, SETS, SETBY, TYPES, Upcoming, bannerUrl, cardsOfSet, daysTo, logoUrl, markText, packUrl, recentSets, soonSet, spoilDate, spoilerSet, thumbUrl, typeOf, upBadge, upSorted, upWhen } from "./data";
import { openCard, openDeck, openSet, openSoon, openUpcoming } from "./nav";
import { useTheme } from "./theme";
import { Icon } from "./ui";
import { goSearch, goTab } from "./chrome";
import { Btn, Glow, ICO_ARROW, ICO_PLUS, Progress } from "./visual";
import { Deck, S, owned, setStats } from "./store";
import { deckCover, deckState, deckStats, newDeck } from "./decks";
import { DBadge } from "./deckui";
import { dateParts, goals, groupName, heroSlides, upRows } from "./homeLogic";

const FILL = { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 };
// banner in evidenza: stessi colori nei due temi (illustrazione che sfuma nel blu notte, testo chiaro)
const HERO = { bg: "#0b1120", ink: "#e8edf7", title: "#f4f7fd", soft: "#a3b1cb", eyebrow: "#63d5ee", btn: "#ff7a3d", btnInk: "#1a0b03", glass: "rgba(11,17,32,.86)", edge: "rgba(232,237,247,.17)" };
const SEC_TOP = 24;
const GAP = 12;
// tipi di prodotto del banner scorrevole, in quest'ordine (uno per tipo)
const HERO_TYPES = ["BT", "EX", "ST", "LM", "PB"];

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

// fila scorrevole: schede larghe w una accanto all'altra, si fermano sempre all'inizio di una scheda; la scheda dopo
// si vede appena sul bordo, così si capisce che si può scorrere. Le schede di una fila hanno tutte la stessa altezza.
// dots: puntini sotto la fila con la scheda in vista
function Carousel({ w, children, dots }: { w: number; children: ReactNode[]; dots?: boolean }) {
  const t = useTheme();
  const [i, setI] = useState(0);
  const n = children.length;
  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={w + GAP}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        nestedScrollEnabled
        style={{ marginHorizontal: -14 }}
        contentContainerStyle={{ paddingHorizontal: 14, gap: GAP }}
        onScroll={dots ? (e) => setI(Math.max(0, Math.min(n - 1, Math.round(e.nativeEvent.contentOffset.x / (w + GAP))))) : undefined}
        scrollEventThrottle={32}
      >
        {children}
      </ScrollView>
      {dots && n > 1 ? (
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 10 }} accessibilityLabel={"Scheda " + (i + 1) + " di " + n}>
          {children.map((_, k) => (
            <View key={k} style={{ width: k === i ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: k === i ? t.accent : t.line }} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

// ---- titolo "Home"
export function HomeTitle() {
  const t = useTheme();
  return (
    <Text accessibilityRole="header" style={{ color: t.ink, fontFamily: DISPLAY, fontWeight: "700", fontSize: 25, lineHeight: 29, letterSpacing: -0.6, marginTop: 10, marginBottom: 14 }}>
      Home
    </Text>
  );
}

// ---- carte spoiler: quelle dei prodotti in arrivo, nell'ordine in cui sono arrivate nel catalogo (dalla più recente;
// la data non si mostra, scelta dell'utente); le carte senza data di arrivo vengono dopo, in ordine di numero
type Spoil = { c: Card; d: string; u: Upcoming };
function spoilers(): Spoil[] {
  const out: Spoil[] = [];
  upSorted().forEach((u) => {
    const sp = spoilerSet(u.code);
    if (sp) cardsOfSet(sp.id).forEach((c) => {
      out.push({ c, d: spoilDate(c), u });
    });
  });
  // stabile: a parità di data resta l'ordine del prodotto (numero)
  return out.map((x, i) => [x, i] as [Spoil, number]).sort((a, b) => (b[0].d > a[0].d ? 1 : b[0].d < a[0].d ? -1 : a[1] - b[1])).map((x) => x[0]);
}

// ---- banner "In evidenza" scorrevole
// conto alla rovescia di upBadge ("35 gg" → "tra 35 gg"; "Questo mese", "Oggi", "Data da definire" restano così)
const upStatus = (u: Upcoming) => {
  const b = upBadge(u);
  return /^\d/.test(b) ? "tra " + b : b;
};
type HeroData = { key: string; code: string; name: string; badge: string; eyebrow: string; dp: ReturnType<typeof dateParts>; when: string; cta: string; go: () => void; spoil?: boolean };

function heroData(sp: Spoil[]): HeroData[] {
  const ups = upSorted();
  const cardsOf = (code: string) => {
    const s = spoilerSet(code);
    return s ? cardsOfSet(s.id).filter((c) => !c.suf).length : 0;
  };
  const lastOf = (code: string) => (sp.find((x) => x.u.code === code) || { d: "" }).d;
  const released = SETS.filter((s) => s.date && s.date.charAt(0) !== "0" && !soonSet(s));
  const slides = heroSlides(
    ups.map((u) => ({ code: u.code, type: typeOf(u.code), cards: cardsOf(u.code), last: lastOf(u.code) })),
    released.map((s) => ({ id: s.id, code: s.code, type: s.type, date: s.date })),
    HERO_TYPES
  );
  return slides.map((sl) => {
    if (sl.kind === "set") {
      const s = SETBY[sl.id];
      const exp = s.type === "BT" || s.type === "EX";
      return {
        key: s.id,
        code: s.code,
        name: s.name,
        badge: "USCITO DI RECENTE",
        eyebrow: [s.code, TYPES[s.type], "Uscito"].join(" · "),
        dp: dateParts({ from: s.date, prec: "day" }),
        when: upWhen({ code: s.code, name: s.name, from: s.date, prec: "day" }),
        cta: exp ? "Scopri il set" : "Scopri il prodotto",
        go: () => openSet(s.id, "home"),
      };
    }
    const u = ups.find((x) => x.code === sl.code)!;
    const n = cardsOf(u.code);
    return {
      key: u.code,
      code: u.code,
      name: u.name,
      badge: sl.kind === "spoiler" ? "NUOVI SPOILER" : "IN ARRIVO",
      eyebrow: [u.code, u.kind, upStatus(u)].filter(Boolean).join(" · "),
      dp: dateParts(u),
      when: upWhen(u),
      cta: "Vedi le " + n + (n === 1 ? " carta svelata" : " carte svelate"),
      // pagina del prodotto con le carte svelate
      go: () => openUpcoming(u.code, "home"),
      // etichetta arancione per il set con gli spoiler più recenti
      spoil: sl.kind === "spoiler",
    };
  });
}

// senza illustrazione: il ripiego del progetto (confezione, logo o codice su sfondo sfumato)
function HeroFallback({ code }: { code: string }) {
  const pk = packUrl(code);
  const lg = !pk ? logoUrl(code) : null;
  return (
    <View style={FILL}>
      <Glow id={"hero" + code} kind="bn" />
      {pk ? (
        <Image source={pk} style={{ position: "absolute", top: 44, bottom: 150, left: 0, right: 0 }} contentFit="contain" cachePolicy="disk" />
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

function HeroSlide({ h, w }: { h: HeroData; w: number }) {
  const b = bannerUrl(h.code);
  return (
    <Pressable onPress={h.go} accessibilityRole="button" accessibilityLabel={h.badge.toLowerCase() + ": " + h.code + " " + h.name + ", " + h.when + ". " + h.cta} style={{ width: w, minHeight: 276, borderRadius: 16, overflow: "hidden", backgroundColor: HERO.bg, padding: 15, justifyContent: "space-between" }}>
      {b ? <Image source={b} style={FILL} contentFit="cover" contentPosition={{ left: "42%", top: "27%" }} cachePolicy="disk" transition={120} /> : <HeroFallback code={h.code} />}
      {/* sfumatura in una vista a tutta superficie: con width/height "100%" sull'Svg la misura sarebbe quella
          interna (meno il margine di 15) e la sfumatura non arriverebbe al bordo destro e in fondo */}
      <View pointerEvents="none" style={FILL}>
        <Svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 10 100">
          <Defs>
            <LinearGradient id={"heroFade" + h.key} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={HERO.bg} stopOpacity={0.15} />
              <Stop offset="0.18" stopColor={HERO.bg} stopOpacity={0.15} />
              <Stop offset="0.35" stopColor={HERO.bg} stopOpacity={0.25} />
              <Stop offset="0.66" stopColor={HERO.bg} stopOpacity={0.91} />
              <Stop offset="1" stopColor={HERO.bg} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect width="10" height="100" fill={`url(#heroFade${h.key})`} />
        </Svg>
      </View>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <View style={{ flexShrink: 1, borderRadius: 6, borderWidth: 1, borderColor: h.spoil ? HERO.btn : HERO.edge, backgroundColor: HERO.glass, paddingVertical: 5, paddingHorizontal: 8 }}>
          <Text style={{ color: h.spoil ? HERO.btn : HERO.ink, fontFamily: DISPLAY, fontWeight: "600", fontSize: 10.5, lineHeight: 14, letterSpacing: 1.4 }}>{h.badge}</Text>
        </View>
        {h.dp ? (
          <View accessible accessibilityLabel={h.dp.label} style={{ minWidth: 46, alignItems: "center", borderRadius: 9, borderWidth: 1, borderColor: HERO.edge, backgroundColor: HERO.glass, paddingVertical: 6, paddingHorizontal: 8 }}>
            <Text style={{ color: HERO.ink, fontFamily: DISPLAY, fontWeight: "700", fontSize: 22, lineHeight: 24 }}>{h.dp.big}</Text>
            <Text style={{ color: HERO.soft, fontFamily: DISPLAY, fontWeight: "600", fontSize: 10, lineHeight: 14, letterSpacing: 1.3 }}>{h.dp.small}</Text>
          </View>
        ) : null}
      </View>
      <View style={{ paddingTop: 36 }}>
        <Text style={{ color: HERO.eyebrow, fontFamily: DISPLAY, fontWeight: "600", fontSize: 10.5, lineHeight: 14, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 3 }}>{h.eyebrow}</Text>
        <Text style={{ color: HERO.title, fontFamily: DISPLAY, fontWeight: "700", fontSize: 29, lineHeight: 32, letterSpacing: -0.4, marginBottom: 12 }}>{h.name}</Text>
        <Pressable onPress={h.go} accessibilityRole="button" accessibilityLabel={h.cta + ": " + h.name} style={{ minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, paddingHorizontal: 15, borderRadius: 10, backgroundColor: HERO.btn }}>
          <Text style={{ color: HERO.btnInk, fontWeight: "600", fontSize: 14 }}>{h.cta}</Text>
          <Arrow color={HERO.btnInk} />
        </Pressable>
      </View>
    </Pressable>
  );
}

export function HeroCarousel({ cw, sp }: { cw: number; sp: Spoil[] }) {
  const list = heroData(sp);
  if (!list.length) return null;
  const w = list.length > 1 ? cw - 22 : cw;
  return (
    <Carousel w={w} dots>
      {list.map((h) => (
        <HeroSlide key={h.key} h={h} w={w} />
      ))}
    </Carousel>
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

// ---- sezione "Ultimi spoiler", carte dalla più recente (tocco = scheda della carta)
export function SpoilerRow({ sp }: { sp: Spoil[] }) {
  const t = useTheme();
  if (!sp.length) return null;
  const list = sp.slice(0, 16);
  const cards = list.map((x) => x.c);
  const W = 104;
  return (
    <>
      <Sec title="Ultimi spoiler" link={list[0].u.code + " →"} onLink={() => openUpcoming(list[0].u.code, "home")} />
      <Carousel w={W}>
        {list.map((x) => {
          const mk = markText(x.c);
          return (
            <Pressable key={x.c.k} onPress={() => openCard(x.c, cards)} accessibilityLabel={x.c.name + " " + x.c.code} style={{ width: W }}>
              <View style={{ width: W, height: Math.round(W / 0.716), borderRadius: 7, overflow: "hidden", backgroundColor: t.surface2, }}>
                <Image source={thumbUrl(x.c)} style={FILL} contentFit="cover" cachePolicy="disk" transition={120} recyclingKey={x.c.k} />
              </View>
              <Text style={{ color: t.ink, fontFamily: DISPLAY, fontWeight: "600", fontSize: 11.5, marginTop: 6 }} numberOfLines={1}>
                {x.c.code}
                {mk ? " " + mk : ""}
              </Text>
              <Text style={{ color: t.ink2, fontSize: 11.5, lineHeight: 15 }} numberOfLines={1}>
                {x.c.name}
              </Text>
            </Pressable>
          );
        })}
      </Carousel>
    </>
  );
}

// ---- usciti di recente: recentSets (stessa scelta e stesso ordine di prima), a scorrimento
function RecentCard({ x, st, w }: { x: CardSet; st?: { n: number; h: number }; w: number }) {
  const t = useTheme();
  const isNew = daysTo(x.date) >= -60;
  const has = !!st && st.n > 0;
  const done = has && st!.h === st!.n;
  const b = bannerUrl(x.code);
  return (
    <Pressable onPress={() => openSet(x.id, "home")} accessibilityRole="button" accessibilityLabel={x.code + " " + x.name + (isNew ? ", nuovo" : "") + (has ? ": " + st!.h + " su " + st!.n + " carte" : "")} style={{ width: w, borderRadius: 12, borderWidth: 1, borderColor: t.line, backgroundColor: t.surface, overflow: "hidden" }}>
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

export function Recent({ cw }: { cw: number }) {
  const stats = setStats();
  const list = recentSets(10);
  if (!list.length) return null;
  // due schede intere e l'inizio della terza
  const w = Math.floor((cw - GAP) / 2) - 18;
  return (
    <>
      <Sec title="Usciti di recente" link="Tutti →" onLink={() => goTab("sets")} />
      <Carousel w={w}>
        {list.map((x) => (
          <RecentCard key={x.id} x={x} st={stats[x.id]} w={w} />
        ))}
      </Carousel>
    </>
  );
}

// ---- All'orizzonte: una scheda per data; i prodotti dello stesso giorno (data esatta, stesso tipo, stesse uscite
// per regione) stanno nella stessa scheda, che apre il calendario dove ognuno ha la sua voce
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

function HorizonCard({ r, w }: { r: Upcoming[]; w: number }) {
  const t = useTheme();
  const u = r[0];
  const one = r.length === 1;
  const dp = dateParts(u);
  // un prodotto: la sua scheda (o gli spoiler; il calendario se non c'è, come prima); più prodotti: il calendario
  const go = () => (one && (PRODUCTS[u.code] || spoilerSet(u.code)) ? openUpcoming(u.code, "home") : openSoon());
  const name = groupName(r.map((x) => x.name));
  const codes = r.map((x) => x.code).join(" + ");
  const day = u.prec === "day";
  return (
    <Pressable onPress={go} accessibilityRole="button" accessibilityLabel={(dp ? dp.label : "Data da definire") + ": " + codes + ", " + name} style={{ width: w, padding: 12, gap: 8, borderRadius: 12, borderWidth: 1, borderColor: t.line, backgroundColor: t.surface }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ flex: 1 }}>
          {dp ? (
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
              <Text style={{ color: t.cyan, fontFamily: DISPLAY, fontWeight: "700", fontSize: 24, lineHeight: 27 }}>{dp.big}</Text>
              <Text style={{ color: t.cyan, fontFamily: DISPLAY, fontWeight: "600", fontSize: 11, letterSpacing: 1 }}>{dp.small}</Text>
            </View>
          ) : (
            <Text style={{ color: t.cyan, fontFamily: DISPLAY, fontWeight: "600", fontSize: 11, lineHeight: 27, letterSpacing: 0.8 }}>DA DEFINIRE</Text>
          )}
          <View style={{ alignSelf: "flex-start", marginTop: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 7, backgroundColor: day ? t.accentSoft : t.cyanSoft }}>
            <Text style={{ color: day ? t.accent : t.cyan, fontWeight: "600", fontSize: 11.5, lineHeight: 16 }}>{upBadge(u)}</Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 4 }}>
          {r.map((x) => (
            <PackThumb key={x.code} code={x.code} />
          ))}
        </View>
      </View>
      <View style={{ marginTop: "auto" }}>
        <Text style={{ color: t.ink, fontFamily: DISPLAY, fontWeight: "600", fontSize: 14.5, lineHeight: 19 }} numberOfLines={2}>
          {name}
        </Text>
        <Text style={{ color: t.ink2, fontSize: 11.8, lineHeight: 17 }}>
          {codes}
          {u.kind ? " · " + u.kind : ""}
        </Text>
      </View>
    </Pressable>
  );
}

export function Horizon({ cw }: { cw: number }) {
  const rows = upRows(upSorted(), 20, relKey);
  if (!rows.length) return null;
  return (
    <>
      <HorizonP1 cw={cw} rows={rows} />
      <HorizonP2 cw={cw} rows={rows} />
      <HorizonP3 cw={cw} rows={rows} />
      <HorizonP4 cw={cw} rows={rows} />
    </>
  );
}

// ---- PROPOSTE per "All'orizzonte" (7 novembre 2026, da scegliere: l'utente vuole vedere l'immagine del prodotto)
type HzInfo = { u: Upcoming; dp: ReturnType<typeof dateParts>; name: string; codes: string; badge: string; day: boolean; go: () => void; label: string };
function hz(r: Upcoming[]): HzInfo {
  const u = r[0];
  const one = r.length === 1;
  const dp = dateParts(u);
  const name = groupName(r.map((x) => x.name));
  const codes = r.map((x) => x.code).join(" + ");
  const go = () => (one && (PRODUCTS[u.code] || spoilerSet(u.code)) ? openUpcoming(u.code, "home") : openSoon());
  return { u, dp, name, codes, badge: upBadge(u), day: u.prec === "day", go, label: (dp ? dp.label : "Data da definire") + ": " + codes + ", " + name };
}
// immagine del prodotto: illustrazione (banner) o confezione, nell'ordine chiesto; poi logo; poi il codice
function ProdImg({ code, prefer, fit = "cover", pos }: { code: string; prefer: "banner" | "pack"; fit?: "cover" | "contain"; pos?: { left: string; top: string } }) {
  const b = bannerUrl(code);
  const pk = packUrl(code);
  const first = prefer === "banner" ? (b ? { src: b, kind: "b" } : pk ? { src: pk, kind: "p" } : null) : pk ? { src: pk, kind: "p" } : b ? { src: b, kind: "b" } : null;
  const lg = !first ? logoUrl(code) : null;
  return (
    <View style={[FILL, { alignItems: "center", justifyContent: "center", backgroundColor: "#1a2540" }]}>
      {first ? (
        first.kind === "b" ? (
          <Image source={first.src} style={FILL} contentFit={fit} contentPosition={(pos as any) || { left: "50%", top: "40%" }} cachePolicy="disk" transition={120} />
        ) : (
          <>
            <Glow id={"pk" + code + prefer} kind="bn" />
            <Image source={first.src} style={{ position: "absolute", top: "8%", bottom: "8%", left: "8%", right: "8%" }} contentFit="contain" cachePolicy="disk" transition={120} />
          </>
        )
      ) : lg ? (
        <>
          <Glow id={"lg" + code + prefer} kind="bn" />
          <Image source={lg} style={{ width: "70%", height: "50%" }} contentFit="contain" cachePolicy="disk" />
        </>
      ) : (
        <Text style={{ color: "#c7d2e8", fontFamily: DISPLAY, fontWeight: "700", fontStyle: "italic", fontSize: 22 }}>{code}</Text>
      )}
    </View>
  );
}
function PropLabel({ n, text }: { n: number; text: string }) {
  const t = useTheme();
  return (
    <View style={{ marginTop: SEC_TOP, marginBottom: -14, alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: t.accent }}>
      <Text style={{ color: "#1a0b03", fontFamily: DISPLAY, fontWeight: "700", fontSize: 11, letterSpacing: 1 }}>
        PROPOSTA {n} · {text}
      </Text>
    </View>
  );
}
function DateChip({ i, glass }: { i: HzInfo; glass?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 7, backgroundColor: glass ? "rgba(11,17,32,.82)" : i.day ? t.accentSoft : t.cyanSoft }}>
      <Text style={{ color: glass ? "#ffb08a" : i.day ? t.accent : t.cyan, fontWeight: "600", fontSize: 11.5, lineHeight: 16 }}>{i.badge}</Text>
    </View>
  );
}

// 1 · Copertina: come "Usciti di recente", immagine in alto con la data sopra, nome sotto
function HorizonP1({ cw, rows }: { cw: number; rows: Upcoming[][] }) {
  const t = useTheme();
  const w = Math.floor((cw - GAP) / 2) - 18;
  return (
    <>
      <PropLabel n={1} text="COPERTINA" />
      <Sec title="All’orizzonte" link="Calendario →" onLink={openSoon} />
      <Carousel w={w}>
        {rows.map((r) => {
          const i = hz(r);
          return (
            <Pressable key={i.u.code} onPress={i.go} accessibilityRole="button" accessibilityLabel={i.label} style={{ width: w, borderRadius: 12, borderWidth: 1, borderColor: t.line, backgroundColor: t.surface, overflow: "hidden" }}>
              <View style={{ width: "100%", aspectRatio: 1.6 }}>
                <ProdImg code={i.u.code} prefer="banner" />
                {i.dp ? (
                  <View style={{ position: "absolute", top: 7, right: 7, minWidth: 40, alignItems: "center", borderRadius: 8, backgroundColor: "rgba(11,17,32,.86)", paddingVertical: 4, paddingHorizontal: 6 }}>
                    <Text style={{ color: "#e8edf7", fontFamily: DISPLAY, fontWeight: "700", fontSize: 17, lineHeight: 19 }}>{i.dp.big}</Text>
                    <Text style={{ color: "#a3b1cb", fontFamily: DISPLAY, fontWeight: "600", fontSize: 9, lineHeight: 12, letterSpacing: 1 }}>{i.dp.small}</Text>
                  </View>
                ) : null}
              </View>
              <View style={{ flex: 1, paddingHorizontal: 10, paddingTop: 9, paddingBottom: 11, gap: 6 }}>
                <Text style={{ color: t.cyan, fontFamily: DISPLAY, fontWeight: "600", fontSize: 10.5, lineHeight: 15, letterSpacing: 0.6 }} numberOfLines={1}>
                  {i.codes}
                </Text>
                <Text style={{ minHeight: 36, color: t.ink, fontFamily: DISPLAY, fontWeight: "700", fontSize: 14, lineHeight: 18, textTransform: "uppercase" }} numberOfLines={2}>
                  {i.name}
                </Text>
                <View style={{ marginTop: "auto" }}>
                  <DateChip i={i} />
                </View>
              </View>
            </Pressable>
          );
        })}
      </Carousel>
    </>
  );
}

// 2 · Confezione: la scatola del prodotto grande a sinistra, data e nome a destra
function HorizonP2({ cw, rows }: { cw: number; rows: Upcoming[][] }) {
  const t = useTheme();
  const w = Math.min(300, cw - 40);
  return (
    <>
      <PropLabel n={2} text="CONFEZIONE" />
      <Sec title="All’orizzonte" link="Calendario →" onLink={openSoon} />
      <Carousel w={w}>
        {rows.map((r) => {
          const i = hz(r);
          return (
            <Pressable key={i.u.code} onPress={i.go} accessibilityRole="button" accessibilityLabel={i.label} style={{ width: w, flexDirection: "row", gap: 12, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: t.line, backgroundColor: t.surface }}>
              <View style={{ width: 92, height: 128, borderRadius: 9, overflow: "hidden" }}>
                <ProdImg code={i.u.code} prefer="pack" pos={{ left: "60%", top: "40%" }} />
              </View>
              <View style={{ flex: 1, paddingVertical: 2 }}>
                {i.dp ? (
                  <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
                    <Text style={{ color: t.cyan, fontFamily: DISPLAY, fontWeight: "700", fontSize: 24, lineHeight: 27 }}>{i.dp.big}</Text>
                    <Text style={{ color: t.cyan, fontFamily: DISPLAY, fontWeight: "600", fontSize: 11, letterSpacing: 1 }}>{i.dp.small}</Text>
                  </View>
                ) : (
                  <Text style={{ color: t.cyan, fontFamily: DISPLAY, fontWeight: "600", fontSize: 11, lineHeight: 27, letterSpacing: 0.8 }}>DA DEFINIRE</Text>
                )}
                <View style={{ marginTop: 4 }}>
                  <DateChip i={i} />
                </View>
                <View style={{ marginTop: "auto" }}>
                  <Text style={{ color: t.ink, fontFamily: DISPLAY, fontWeight: "600", fontSize: 14.5, lineHeight: 19 }} numberOfLines={2}>
                    {i.name}
                  </Text>
                  <Text style={{ color: t.ink2, fontSize: 11.8, lineHeight: 17 }} numberOfLines={1}>
                    {i.codes}
                    {i.u.kind ? " · " + i.u.kind : ""}
                  </Text>
                </View>
              </View>
            </Pressable>
          );
        })}
      </Carousel>
    </>
  );
}

// 3 · Locandina: scheda verticale tutta immagine, sfumatura in basso con nome e data (un piccolo "In evidenza")
function HorizonP3({ cw, rows }: { cw: number; rows: Upcoming[][] }) {
  const w = Math.floor((cw - GAP) / 2) - 18;
  return (
    <>
      <PropLabel n={3} text="LOCANDINA" />
      <Sec title="All’orizzonte" link="Calendario →" onLink={openSoon} />
      <Carousel w={w}>
        {rows.map((r) => {
          const i = hz(r);
          return (
            <Pressable key={i.u.code} onPress={i.go} accessibilityRole="button" accessibilityLabel={i.label} style={{ width: w, height: Math.round(w * 1.42), borderRadius: 14, overflow: "hidden", backgroundColor: HERO.bg, padding: 10, justifyContent: "space-between" }}>
              <ProdImg code={i.u.code} prefer="banner" pos={{ left: "45%", top: "30%" }} />
              <View pointerEvents="none" style={FILL}>
                <Svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 10 100">
                  <Defs>
                    <LinearGradient id={"hz3" + i.u.code} x1="0" y1="0" x2="0" y2="1">
                      <Stop offset="0" stopColor={HERO.bg} stopOpacity={0.1} />
                      <Stop offset="0.45" stopColor={HERO.bg} stopOpacity={0.2} />
                      <Stop offset="0.75" stopColor={HERO.bg} stopOpacity={0.92} />
                      <Stop offset="1" stopColor={HERO.bg} stopOpacity={1} />
                    </LinearGradient>
                  </Defs>
                  <Rect width="10" height="100" fill={`url(#hz3${i.u.code})`} />
                </Svg>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
                {i.dp ? (
                  <View style={{ minWidth: 42, alignItems: "center", borderRadius: 8, borderWidth: 1, borderColor: HERO.edge, backgroundColor: HERO.glass, paddingVertical: 4, paddingHorizontal: 6 }}>
                    <Text style={{ color: HERO.ink, fontFamily: DISPLAY, fontWeight: "700", fontSize: 18, lineHeight: 20 }}>{i.dp.big}</Text>
                    <Text style={{ color: HERO.soft, fontFamily: DISPLAY, fontWeight: "600", fontSize: 9, lineHeight: 12, letterSpacing: 1 }}>{i.dp.small}</Text>
                  </View>
                ) : null}
              </View>
              <View style={{ gap: 4 }}>
                <Text style={{ color: HERO.eyebrow, fontFamily: DISPLAY, fontWeight: "600", fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }} numberOfLines={1}>
                  {i.codes}
                </Text>
                <Text style={{ color: HERO.title, fontFamily: DISPLAY, fontWeight: "700", fontSize: 15, lineHeight: 18 }} numberOfLines={3}>
                  {i.name}
                </Text>
                <View style={{ marginTop: 3 }}>
                  <DateChip i={i} glass />
                </View>
              </View>
            </Pressable>
          );
        })}
      </Carousel>
    </>
  );
}

// 4 · Linea del tempo: in alto una linea con un punto per ogni data, sotto la scheda con immagine quadrata e nome
function HorizonP4({ cw, rows }: { cw: number; rows: Upcoming[][] }) {
  const t = useTheme();
  const w = Math.floor((cw - GAP) / 2.3);
  return (
    <>
      <PropLabel n={4} text="LINEA DEL TEMPO" />
      <Sec title="All’orizzonte" link="Calendario →" onLink={openSoon} />
      <Carousel w={w}>
        {rows.map((r, k) => {
          const i = hz(r);
          return (
            <Pressable key={i.u.code} onPress={i.go} accessibilityRole="button" accessibilityLabel={i.label} style={{ width: w }}>
              <View style={{ height: 22, justifyContent: "center", marginBottom: 6 }}>
                <View style={{ position: "absolute", left: k === 0 ? 6 : -GAP, right: -GAP, height: 2, backgroundColor: t.line }} />
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <View style={{ width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: t.bg, backgroundColor: i.day ? t.accent : t.cyan }} />
                  <View style={{ paddingHorizontal: 5, borderRadius: 4, backgroundColor: t.bg }}>
                    <Text style={{ color: i.day ? t.accent : t.cyan, fontFamily: DISPLAY, fontWeight: "700", fontSize: 12, letterSpacing: 0.6 }} numberOfLines={1}>
                      {i.dp ? (i.u.prec === "day" ? i.dp.big + " " + i.dp.small : i.dp.big + " " + i.dp.small) : "DA DEFINIRE"}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={{ width: w, height: w, borderRadius: 12, overflow: "hidden" }}>
                <ProdImg code={i.u.code} prefer="banner" pos={{ left: "50%", top: "35%" }} />
              </View>
              <Text style={{ color: t.cyan, fontFamily: DISPLAY, fontWeight: "600", fontSize: 10.5, letterSpacing: 0.6, marginTop: 7 }} numberOfLines={1}>
                {i.codes}
              </Text>
              <Text style={{ color: t.ink, fontFamily: DISPLAY, fontWeight: "600", fontSize: 13, lineHeight: 17 }} numberOfLines={2}>
                {i.name}
              </Text>
              <Text style={{ color: t.ink2, fontSize: 11.5, lineHeight: 16, marginTop: 2 }} numberOfLines={1}>
                {i.badge}
              </Text>
            </Pressable>
          );
        })}
      </Carousel>
    </>
  );
}

// ---- set da completare: tutti quelli iniziati e incompleti, dal più vicino al completamento
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

function GoalCard({ g, st, w }: { g: CardSet; st: { n: number; h: number }; w: number }) {
  const t = useTheme();
  const miss = st.n - st.h;
  const missTxt = miss === 1 ? "Ti manca 1 carta" : "Ti mancano " + miss + " carte";
  // pagina del prodotto con le sole carte mancanti
  const go = () => openSet(g.id, "home", true);
  return (
    <Pressable onPress={go} accessibilityRole="button" accessibilityLabel={g.code + " " + g.name + ": " + st.h + " su " + st.n + ". " + missTxt} style={{ width: w, flexDirection: "row", alignItems: "center", gap: 12, padding: 13, borderRadius: 14, borderWidth: 1, borderColor: t.line, backgroundColor: t.surface }}>
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
        <Text style={{ color: t.ink, fontFamily: DISPLAY, fontWeight: "700", fontSize: 16, lineHeight: 20, marginTop: 1, marginBottom: 8 }} numberOfLines={2}>
          {g.name}
        </Text>
        <Progress h={st.h} n={st.n} height={5} color={t.cyan} />
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, minHeight: 31, paddingTop: 9 }}>
          <Text style={{ flex: 1, color: t.cyan, fontWeight: "600", fontSize: 12.8 }}>{missTxt}</Text>
          <Arrow color={t.cyan} size={16} />
        </View>
      </View>
    </Pressable>
  );
}

export function GoalModule({ cw }: { cw: number }) {
  if (!Object.keys(S.qty).length) return <StartCollection />;
  const stats = setStats();
  const list = goals(SETS, stats, (s) => !soonSet(s)).slice(0, 12);
  // nessun set iniziato e incompleto: niente sezione (e niente titolo)
  if (!list.length) return null;
  const w = list.length > 1 ? cw - 30 : cw;
  return (
    <>
      <Sec title="Set da completare" link="Collezione →" onLink={() => goTab("coll")} />
      <Carousel w={w}>
        {list.map((g) => (
          <GoalCard key={g.id} g={g} st={stats[g.id]} w={w} />
        ))}
      </Carousel>
    </>
  );
}

// ---- mazzi: dal più recente (il primo è quello di DeckResume), più "Nuovo mazzo" in fondo
function DeckCard({ d, w }: { d: Deck; w: number }) {
  const t = useTheme();
  const s = deckStats(d);
  const [k, label] = deckState(s);
  const cv = deckCover(d);
  return (
    <Pressable onPress={() => openDeck(d.id)} accessibilityRole="button" accessibilityLabel={"Riprendi il mazzo " + d.name + ": principale " + s.main + " su 50, Digi-Egg " + s.egg + " su 5, " + label} style={{ width: w, flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: t.line, backgroundColor: t.surface }}>
      <View style={{ width: 46, height: 64, marginLeft: 2, borderRadius: 5, transform: [{ rotate: "-7deg" }], boxShadow: `4px 2px 0 ${t.surface2}` }}>
        <View style={{ flex: 1, borderRadius: 5, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: t.surface2 }}>
          {cv ? <Image source={thumbUrl(cv)} style={FILL} contentFit="cover" cachePolicy="disk" recyclingKey={cv.k} /> : <Icon name="deck" color={t.ink2} size={20} />}
        </View>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        {/* nome lungo o testo ingrandito: l'etichetta dello stato va sotto e il nome va a capo (non tagliato) */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 8, rowGap: 3, marginBottom: 3 }}>
          <Text style={{ flexShrink: 1, color: t.ink, fontFamily: DISPLAY, fontWeight: "700", fontSize: 16, lineHeight: 21 }} numberOfLines={2}>
            {d.name}
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
  );
}

function NewDeckCard({ w, first }: { w: number; first?: boolean }) {
  const t = useTheme();
  return (
    <Pressable onPress={() => openDeck(newDeck("Nuovo mazzo " + (S.decks.length + 1)).id)} accessibilityRole="button" accessibilityLabel={first ? "Crea il tuo primo mazzo" : "Nuovo mazzo"} style={{ width: w, flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 12, borderWidth: 1, borderStyle: first ? "solid" : "dashed", borderColor: t.line, backgroundColor: t.surface }}>
      <View style={{ width: 46, height: 64, alignItems: "center", justifyContent: "center", borderRadius: 6, borderWidth: 1.5, borderStyle: "dashed", borderColor: t.line }}>
        <Svg width={22} height={22} viewBox="0 0 24 24">
          <Path d={ICO_PLUS} stroke={t.accent} strokeWidth={2.2} strokeLinecap="round" fill="none" />
        </Svg>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: t.ink, fontFamily: DISPLAY, fontWeight: "700", fontSize: 16, lineHeight: 21 }}>{first ? "Il tuo primo mazzo" : "Nuovo mazzo"}</Text>
        <Text style={{ color: t.ink2, fontSize: 12.5, lineHeight: 17, marginTop: 2 }}>{first ? "Regole e lista ban vengono controllate mentre lo componi." : "Parti da una carta o da un'idea"}</Text>
      </View>
      {first ? <Arrow color={t.accent} size={18} /> : null}
    </Pressable>
  );
}

export function DeckModule({ cw }: { cw: number }) {
  const decks = S.decks.slice().sort((a, b) => (b.upd || 0) - (a.upd || 0));
  if (!decks.length)
    return (
      <>
        <Sec title="Deckbuilding" link="I tuoi mazzi →" onLink={() => goTab("deck")} />
        <NewDeckCard w={cw} first />
      </>
    );
  const w = cw - 30;
  return (
    <>
      <Sec title="Riprendi il mazzo" link="I tuoi mazzi →" onLink={() => goTab("deck")} />
      <Carousel w={w}>
        {decks
          .slice(0, 10)
          .map((d) => <DeckCard key={d.id} d={d} w={w} />)
          .concat(<NewDeckCard key="nuovo" w={w} />)}
      </Carousel>
    </>
  );
}

export { spoilers };
