// Moduli della Home. 6 novembre 2026: nuova Home dal mockup "home-proposta" dell'utente; poi (stesso giorno, richieste
// dell'utente) niente ricerca nel titolo, file scorrevoli in ogni sezione e ordine: In evidenza (con "La tua
// collezione" sotto), Ultimi spoiler, Usciti di recente, All'orizzonte, Set da completare, Riprendi il mazzo.
// Ultimi spoiler: sezione a sé (SpoilerRow, scelta dell'utente tra due proposte; scartate le miniature nel banner).
// Stili solo di questa pagina: i componenti condivisi (Banner, SecHead, Progress…) restano come sono.
import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { useFocusEffect } from "expo-router";
import { Image } from "expo-image";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { DISPLAY, Text } from "./Text";
import { CARDS, Card, CardSet, PRODUCTS, SETS, SETBY, TYPES, Upcoming, bannerUrl, cardsOfSet, daysTo, logoUrl, markText, packUrl, recentSets, soonSet, spoilDate, spoilerSet, thumbUrl, typeOf, upBadge, upSorted, upWhen } from "./data";
import { openCard, openDeck, openSet, openSoon, openUpcoming } from "./nav";
import { FS, R, useTheme } from "./theme";
import { Icon } from "./ui";
import { goSearch, goTab } from "./chrome";
import { Btn, Glow, ICO_ARROW, ICO_PLUS, Progress } from "./visual";
import { Deck, S, owned, setStats } from "./store";
import { deckCover, deckState, deckStats, newDeck } from "./decks";
import { DBadge } from "./deckui";
import { Focus, dateParts, focusPos, goals, groupName, heroSlides, upRows } from "./homeLogic";
import FOCUS from "./bannerFocus.json";
import { COVERS, HERO_ART, HORIZON_ART, heroSrc } from "./covers";
import { whenIntroDone } from "./Intro";
import { type Art, CutImg, LogoLay, artFor, logoArt, useHomeArt } from "./homeArt";

// punto da inquadrare scelto a mano per ogni banner (vedi focusPos in homeLogic.ts)
const focusOf = (code: string) => (FOCUS as Record<string, Focus | string>)[code] as Focus | undefined;

const FILL = { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 };
// banner in evidenza: stessi colori nei due temi (illustrazione che sfuma nel blu notte, testo chiaro)
const HERO = { bg: "#0b1120", ink: "#e8edf7", title: "#f4f7fd", soft: "#a3b1cb", eyebrow: "#63d5ee", btn: "#ff7a3d", btnInk: "#1a0b03", glass: "rgba(11,17,32,.86)", edge: "rgba(232,237,247,.17)" };
const SEC_TOP = 32;
const GAP = 12;
// tipi di prodotto del banner scorrevole, in quest'ordine (uno per tipo)
const HERO_TYPES = ["BT", "EX", "ST", "LM", "PB"];
// In evidenza scorre da solo come un carosello (16 novembre 2026, richiesta dell'utente): una scheda ogni 5 secondi
const HERO_AUTO = 5000;
// puntino che si riempie (scheda in vista con il passaggio automatico): un po' più lungo degli altri, per vedere la barra
const DOT_RUN = 28;
const DOT_H = 9;
// parte interna della capsula (meno il contorno)
const FILL_W = DOT_RUN - 3;
// vero un po' dopo la fine dell'intro: la Home intanto non fa lavori che si possono rimandare (capsula di In evidenza,
// sezioni sotto lo schermo), così la sfumatura finale dell'intro resta fluida (17 novembre 2026, segnalato dall'utente)
export function useAfterIntro(delay: number) {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    let alive = true;
    let id: any = null;
    whenIntroDone(() => {
      id = setTimeout(() => alive && setOk(true), delay);
    });
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, []);
  return ok;
}

// In evidenza in vista (la Home lo dice scorrendo, heroScroll): fuori vista la capsula si ferma
const HERO_VIS = { v: true, subs: new Set<(v: boolean) => void>() };
export function heroScroll(y: number) {
  const v = y < 320;
  if (v === HERO_VIS.v) return;
  HERO_VIS.v = v;
  HERO_VIS.subs.forEach((f) => f(v));
}

// logo dell'espansione scelto nell'editor (Taglia) sopra un riquadro tagliato: logo caricato a mano, poi quello ufficiale
function CutLogo({ code, a }: { code: string; a: Art }) {
  const u = a.logo ? logoArt(code) || logoUrl(code) : null;
  return u && a.logo ? <LogoLay uri={u} p={a.logo.p} s={a.logo.s} /> : null;
}

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
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: SEC_TOP, marginBottom: 12 }}>
      <Text accessibilityRole="header" style={{ flex: 1, color: t.ink, fontFamily: DISPLAY, fontWeight: "700", fontSize: FS.sec, lineHeight: 29, letterSpacing: -0.3 }}>
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
// dots: puntini sotto la fila con la scheda in vista; onIndex: scheda in primo piano (la prima a sinistra);
// auto: millisecondi dopo cui passa da sola alla scheda dopo (dall'ultima torna alla prima). Si ferma mentre il dito è
// sulla fila, quando si cambia scheda a mano riparte da capo, e non gira con la pagina non in vista o con
// "Riduci movimento" attivo nel telefono. Con auto il puntino della scheda in vista si riempie piano piano come una
// barra: quando è pieno si passa alla scheda dopo (16 novembre 2026, richiesta dell'utente)
function Carousel({ w, children, dots, onIndex, auto, gap = GAP, edge = 14 }: { w: number; children: ReactNode[]; dots?: boolean; onIndex?: (i: number) => void; auto?: number; gap?: number; edge?: number }) {
  const t = useTheme();
  const [i, setI] = useState(0);
  const n = children.length;
  const ref = useRef<any>(null); // ScrollView (il tipo di RN 0.88 non accetta useRef<ScrollView>)
  const cur = useRef(0);
  const geo = useRef({ w, n, gap });
  geo.current = { w, n, gap };
  const [seen, setSeen] = useState(true);
  const [still, setStill] = useState(false);
  // riempimento della capsula: animazione continua fatta dal telefono (non da JavaScript), senza ritagli (la parte
  // piena si allarga da sinistra, scaleX), che si ferma quando In evidenza esce dallo schermo o si cambia pagina e
  // riprende da dove era. Quando la capsula è piena si passa alla scheda dopo. 17 novembre 2026, scelta dell'utente:
  // riempimento continuo ma app leggera (prima: scatti di 0,4 s; ancora prima un'animazione con ritaglio che,
  // insieme alle immagini dei tagli ricaricate di continuo, ridisegnava la Home senza sosta)
  const fill = useRef(new Animated.Value(0)).current;
  const anim = useRef<Animated.CompositeAnimation | null>(null);
  const pos = useRef(0); // punto raggiunto (0-1) quando l'animazione è ferma
  const autoAt = useRef(0); // momento dell'ultimo passaggio automatico (il suo fine scorrimento non riparte da capo)
  const [inView, setInView] = useState(HERO_VIS.v);
  const running = !!auto && n > 1 && seen && !still;
  const ready = useAfterIntro(600);
  const active = running && inView && ready;
  const activeRef = useRef(active);
  activeRef.current = active;
  const stop = () => {
    const a = anim.current;
    anim.current = null;
    if (a) a.stop();
    fill.stopAnimation((v) => (pos.current = v));
  };
  const go = (from: number) => {
    stop();
    pos.current = from;
    fill.setValue(from);
    if (!activeRef.current || !auto) return;
    const a = Animated.timing(fill, { toValue: 1, duration: Math.max(60, (1 - from) * auto), easing: Easing.linear, useNativeDriver: true });
    anim.current = a;
    a.start(({ finished }) => {
      if (!finished || anim.current !== a) return;
      anim.current = null;
      const g = geo.current;
      const k = (cur.current + 1) % g.n;
      autoAt.current = Date.now();
      ref.current?.scrollTo({ x: k * (g.w + g.gap), animated: true });
      go(0);
    });
  };
  useFocusEffect(
    useCallback(() => {
      pos.current = 0;
      setSeen(true);
      return () => setSeen(false);
    }, [])
  );
  useEffect(() => {
    if (!auto) return;
    HERO_VIS.subs.add(setInView);
    AccessibilityInfo.isReduceMotionEnabled().then(setStill).catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setStill);
    return () => {
      HERO_VIS.subs.delete(setInView);
      sub.remove();
    };
  }, [auto]);
  // in vista: parte o riprende da dove era; fuori vista o pagina lasciata: si ferma lì
  useEffect(() => {
    if (active) go(pos.current);
    else stop();
    return stop;
  }, [active, auto]);
  const track = dots || onIndex || auto;
  return (
    <View>
      <ScrollView
        ref={ref}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={w + gap}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        nestedScrollEnabled
        style={{ marginHorizontal: -edge }}
        contentContainerStyle={{ paddingHorizontal: edge, gap }}
        onScroll={
          track
            ? (e) => {
                const k = Math.max(0, Math.min(n - 1, Math.round(e.nativeEvent.contentOffset.x / (w + gap))));
                if (k === cur.current) return;
                cur.current = k;
                if (dots) setI(k);
                if (onIndex) onIndex(k);
              }
            : undefined
        }
        // col dito sopra la capsula si svuota e resta ferma; lasciata la fila riparte da capo
        onScrollBeginDrag={auto ? () => (stop(), (pos.current = 0), fill.setValue(0)) : undefined}
        onScrollEndDrag={auto ? () => go(0) : undefined}
        // dopo il passaggio automatico la capsula è già ripartita: niente salto
        onMomentumScrollEnd={auto ? () => Date.now() - autoAt.current > 900 && go(0) : undefined}
        scrollEventThrottle={32}
      >
        {children}
      </ScrollView>
      {dots && n > 1 ? (
        <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 10, minHeight: DOT_H }} accessibilityLabel={"Scheda " + (i + 1) + " di " + n}>
          {children.map((_, k) => (
            k === i && running ? (
              // capsula con il contorno arancione, che si riempie da sinistra (16 novembre 2026, richiesta dell'utente)
              <View key={k} style={{ width: DOT_RUN, height: DOT_H, borderRadius: DOT_H / 2, borderWidth: 1.5, borderColor: t.accent }}>
                <Animated.View style={{ width: FILL_W, height: DOT_H - 3, borderRadius: (DOT_H - 3) / 2, backgroundColor: t.accent, transformOrigin: "left", transform: [{ scaleX: fill }] }} />
              </View>
            ) : (
              <View key={k} style={{ width: k === i ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: k === i ? t.accent : t.line }} />
            )
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

// altezza di In evidenza a tutta larghezza (28 novembre 2026, direzione "Galleria" scelta dall'utente)
export const HERO_H = 420;
function HeroSlide({ h, w }: { h: HeroData; w: number }) {
  useHomeArt();
  const t = useTheme();
  const sw = useWindowDimensions().width;
  const cut = artFor(h.code, "hero", sw);
  const art = HERO_ART[h.code];
  const b = bannerUrl(h.code);
  const label = h.spoil ? "Nuovi spoiler" : h.badge === "IN ARRIVO" ? "In arrivo" : "Uscito di recente";
  // "Uscito di recente · PB23 · Premium Bandai" (senza ripetere "Uscito" alla fine)
  const eyebrow = h.eyebrow.replace(/ · Uscito$/, "");
  return (
    <Pressable onPress={h.go} accessibilityRole="button" accessibilityLabel={h.badge.toLowerCase() + ": " + h.code + " " + h.name + ", " + h.when + ". " + h.cta} style={{ width: w, height: HERO_H, overflow: "hidden", backgroundColor: HERO.bg, justifyContent: "flex-end" }}>
      {/* taglio scelto nell'editor dell'app (homeArt.tsx), poi l'illustrazione dentro l'APK (covers.ts), poi il banner */}
      {cut ? (
        <CutImg a={cut} />
      ) : art ? (
        <Image source={heroSrc(art, sw)} style={FILL} contentFit="cover" contentPosition={art.pos as any} transition={120} />
      ) : b ? (
        <Image source={b} style={FILL} contentFit="cover" contentPosition={{ left: "42%", top: "27%" }} cachePolicy="disk" transition={120} />
      ) : (
        <HeroFallback code={h.code} />
      )}
      {/* sfumature: in alto scura per leggere il marchio della barra, in basso verso lo sfondo della pagina (l'illustrazione
          entra nella pagina senza bordo) */}
      <View pointerEvents="none" style={FILL}>
        <Svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 10 100">
          <Defs>
            <LinearGradient id={"heroFade" + h.key} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#05080f" stopOpacity={0.6} />
              <Stop offset="0.2" stopColor="#05080f" stopOpacity={0} />
              <Stop offset="0.36" stopColor={t.bg} stopOpacity={0} />
              <Stop offset="0.62" stopColor={t.bg} stopOpacity={0.82} />
              <Stop offset="0.78" stopColor={t.bg} stopOpacity={0.96} />
              <Stop offset="1" stopColor={t.bg} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect width="10" height="100" fill={`url(#heroFade${h.key})`} />
        </Svg>
      </View>
      {cut ? <CutLogo code={h.code} a={cut} /> : null}
      <View style={{ paddingHorizontal: 16, paddingBottom: 6 }}>
        <Text style={{ color: h.spoil ? t.accent : t.ink2, fontSize: FS.sm, lineHeight: 18, fontWeight: "500", marginBottom: 2 }} numberOfLines={1}>
          {label + " · " + eyebrow}
        </Text>
        <Text style={{ color: t.ink, fontFamily: DISPLAY, fontWeight: "700", fontSize: FS.hero, lineHeight: 38, letterSpacing: -0.6, marginBottom: 14 }} numberOfLines={2}>
          {h.name}
        </Text>
        <Pressable onPress={h.go} accessibilityRole="button" accessibilityLabel={h.cta + ": " + h.name} style={{ alignSelf: "flex-start", minHeight: 44, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 18, borderRadius: R.btn, backgroundColor: t.accent }}>
          <Text style={{ color: t.accentInk, fontWeight: "600", fontSize: 14.5 }}>{h.cta}</Text>
          <Arrow color={t.accentInk} />
        </Pressable>
      </View>
    </Pressable>
  );
}

export function HeroCarousel({ sp }: { cw?: number; sp: Spoil[] }) {
  const list = heroData(sp);
  const sw = useWindowDimensions().width;
  if (!list.length) return null;
  return (
    <Carousel w={sw} gap={0} edge={0} dots auto={HERO_AUTO}>
      {list.map((h) => (
        <HeroSlide key={h.key} h={h} w={sw} />
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
  const nd = S.decks.length;
  const Num = ({ v, l }: { v: number; l: string }) => (
    <View>
      <Text style={{ color: t.ink, fontFamily: DISPLAY, fontWeight: "700", fontSize: 28, lineHeight: 32, fontVariant: ["tabular-nums"] }}>{v.toLocaleString("it-IT")}</Text>
      <Text style={{ color: t.ink2, fontSize: FS.xs, lineHeight: 14 }}>{l}</Text>
    </View>
  );
  // 28 novembre 2026 (direzione "Galleria"): numeri grandi al posto della riga nel riquadro; tocco = Collezione
  return (
    <Pressable onPress={() => goTab("coll")} accessibilityRole="button" accessibilityLabel={"La tua collezione: " + n + " " + word + ", " + nd + (nd === 1 ? " mazzo" : " mazzi")} style={{ marginTop: 20, flexDirection: "row", alignItems: "flex-end", gap: 28 }}>
      <Num v={n} l={word + " in collezione"} />
      <Num v={nd} l={nd === 1 ? "mazzo" : "mazzi"} />
      <View style={{ flex: 1, alignItems: "flex-end", paddingBottom: 2 }}>
        <Text style={{ color: t.cyan, fontWeight: "600", fontSize: 13.6 }}>Collezione →</Text>
      </View>
    </Pressable>
  );
}

// ---- sezione "Ultimi spoiler", carte dalla più recente (tocco = scheda della carta)
export function SpoilerRow({ sp }: { sp: Spoil[] }) {
  const t = useTheme();
  // carta in primo piano (la prima a sinistra): il collegamento in alto porta al suo prodotto (16 novembre 2026,
  // richiesta dell'utente: prima restava quello della prima carta)
  const [k, setK] = useState(0);
  if (!sp.length) return null;
  const list = sp.slice(0, 16);
  const cards = list.map((x) => x.c);
  const W = 132;
  const u = (list[k] || list[0]).u;
  return (
    <>
      <Sec title="Ultimi spoiler" link={u.code + " →"} onLink={() => openUpcoming(u.code, "home")} />
      <Carousel w={W} onIndex={setK}>
        {list.map((x) => {
          const mk = markText(x.c);
          return (
            <Pressable key={x.c.k} onPress={() => openCard(x.c, cards)} accessibilityLabel={x.c.name + " " + x.c.code} style={{ width: W }}>
              <View style={{ width: W, height: Math.round(W / 0.716), borderRadius: 7, overflow: "hidden", backgroundColor: t.surface2 }}>
                <Image source={thumbUrl(x.c)} style={FILL} contentFit="cover" cachePolicy="disk" transition={120} recyclingKey={x.c.k} />
              </View>
              <Text style={{ color: t.ink, fontWeight: "600", fontSize: FS.sm, lineHeight: 18, marginTop: 8 }} numberOfLines={1}>
                {x.c.name}
              </Text>
              <Text style={{ color: t.ink2, fontSize: FS.xs, lineHeight: 15 }} numberOfLines={1}>
                {x.c.code}
                {mk ? " " + mk : ""}
              </Text>
            </Pressable>
          );
        })}
      </Carousel>
    </>
  );
}

// ---- usciti di recente: recentSets (stessa scelta e stesso ordine di prima), a scorrimento
export function Recent({ cw }: { cw: number }) {
  const stats = setStats();
  const list = recentSets(10);
  if (!list.length) return null;
  // copertina (11 novembre 2026, scelta dell'utente tra copertina, quadrato e locandina): formato carta come "Set da
  // completare" (stessi tagli dell'editor), larga come le schede di All'orizzonte, scritte uguali alle altre file
  const w = Math.floor((cw - GAP) / 2.1);
  const h = Math.round((w * 91) / 65);
  return (
    <>
      <Sec title="Usciti di recente" link="Tutti →" onLink={() => goTab("sets")} />
      <Carousel w={w}>
        {list.map((x) => (
          <RecentCover key={x.id} x={x} st={stats[x.id]} w={w} h={h} />
        ))}
      </Carousel>
    </>
  );
}

function RecentCover({ x, st, w, h }: { x: CardSet; st?: { n: number; h: number }; w: number; h: number }) {
  const t = useTheme();
  const isNew = daysTo(x.date) >= -60;
  const has = !!st && st.n > 0;
  const done = has && st!.h === st!.n;
  return (
    <Pressable onPress={() => openSet(x.id, "home")} accessibilityRole="button" accessibilityLabel={x.code + " " + x.name + (isNew ? ", nuovo" : "") + (has ? ": " + st!.h + " su " + st!.n + " carte" : "")} style={{ width: w }}>
      <View style={{ width: w, height: h, borderRadius: R.chip, overflow: "hidden", backgroundColor: "#1a2540" }}>
        <SetArt code={x.code} w={w} h={h} />
        {isNew ? <GlassTag text="NUOVO" color="#4ade80" /> : null}
      </View>
      <Text style={{ color: t.ink, fontWeight: "600", fontSize: FS.md, lineHeight: 20, marginTop: 8 }} numberOfLines={2}>
        {x.name}
      </Text>
      <Text style={{ color: t.ink2, fontSize: FS.xs, lineHeight: 15 }} numberOfLines={1}>
        {x.code}
      </Text>
      {has ? (
        <View style={{ marginTop: 6 }}>
          <Progress h={st!.h} n={st!.n} height={4} color={done ? t.ok : t.cyan} />
          <Text style={{ color: done ? t.ok : t.ink2, fontSize: 11.5, lineHeight: 16, marginTop: 3, fontVariant: ["tabular-nums"] }}>
            {st!.h} / {st!.n} carte
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

// etichetta in vetro sopra le immagini (come quelle di In evidenza)
function GlassTag({ text, color }: { text: string; color: string }) {
  return (
    <View style={{ position: "absolute", top: 8, left: 8, borderRadius: 6, borderWidth: 1, borderColor: HERO.edge, backgroundColor: HERO.glass, paddingVertical: 3, paddingHorizontal: 6 }}>
      <Text style={{ color, fontFamily: DISPLAY, fontWeight: "600", fontSize: 9.5, lineHeight: 13, letterSpacing: 1.2 }}>{text}</Text>
    </View>
  );
}
// immagine quadrata di un prodotto: taglio dell'editor, poi immagine dentro l'APK, poi banner tagliato (come All'orizzonte;
// usata anche dalle righe di "In arrivo" nella pagina Prodotti)
export function SquareArt({ code }: { code: string }) {
  useHomeArt();
  const cut = artFor(code, "square");
  if (cut)
    return (
      <>
        <CutImg a={cut} />
        <CutLogo code={code} a={cut} />
      </>
    );
  if (HORIZON_ART[code]) return <Image source={HORIZON_ART[code]} style={FILL} contentFit="cover" transition={120} />;
  return <ProdImg code={code} prefer="banner" pos={focusPos(focusOf(code), 1, { left: "50%", top: "35%" })} />;
}

// ---- All'orizzonte: una scheda per data; i prodotti dello stesso giorno (data esatta, stesso tipo, stesse uscite
// per regione) stanno nella stessa scheda, che apre il calendario dove ognuno ha la sua voce
const relKey = (u: { code: string }) => {
  const p = PRODUCTS[u.code];
  return JSON.stringify((p && p.rel) || []);
};

export function Horizon({ cw }: { cw: number }) {
  const rows = upRows(upSorted(), 20, relKey);
  if (!rows.length) return null;
  return <HorizonLine cw={cw} rows={rows} />;
}

// ---- All'orizzonte a linea del tempo (7 novembre 2026, scelta dell'utente tra 4 proposte: si vede l'immagine del prodotto)
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
// in alto una linea con un punto per ogni data (arancione: giorno esatto, azzurro: solo il mese), sotto l'immagine
// quadrata del prodotto (illustrazione, altrimenti confezione, logo o codice), codici, nome e conto alla rovescia
function HorizonLine({ cw, rows }: { cw: number; rows: Upcoming[][] }) {
  const t = useTheme();
  useHomeArt();
  const w = Math.floor((cw - GAP) / 2.1);
  return (
    <>
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
                {artFor(i.u.code, "square") ? (
                  <>
                    <CutImg a={artFor(i.u.code, "square")!} />
                    <CutLogo code={i.u.code} a={artFor(i.u.code, "square")!} />
                  </>
                ) : HORIZON_ART[i.u.code] ? (
                  <Image source={HORIZON_ART[i.u.code]} style={FILL} contentFit="cover" transition={120} />
                ) : (
                  <ProdImg code={i.u.code} prefer="banner" pos={focusPos(focusOf(i.u.code), 1, { left: "50%", top: "35%" })} />
                )}
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
export function SetArt({ code, w, h, r = 9 }: { code: string; w: number; h: number; r?: number }) {
  const t = useTheme();
  useHomeArt();
  // taglio scelto nell'editor dell'app (homeArt.tsx), poi la copertina verticale dentro l'APK (covers.ts), poi il banner
  const cut = artFor(code, "cover");
  const cv = !cut ? COVERS[code] : undefined;
  const b = !cut && !cv ? bannerUrl(code) : null;
  const pk = !cut && !cv && !b ? packUrl(code) : null;
  const lg = !cut && !cv && !b && !pk ? logoUrl(code) : null;
  return (
    <View style={{ width: w, height: h, borderRadius: r, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: cut || cv || b ? "#1a2540" : t.surface2 }}>
      {cut ? (
        <>
          <CutImg a={cut} />
          <CutLogo code={code} a={cut} />
        </>
      ) : cv ? (
        <Image source={cv} style={FILL} contentFit="cover" contentPosition={{ left: "50%", top: "50%" }} transition={120} />
      ) : b ? (
        <Image source={b} style={FILL} contentFit="cover" contentPosition={focusPos(focusOf(code), w / h, { left: "58%", top: "50%" }) as any} cachePolicy="disk" transition={120} />
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
