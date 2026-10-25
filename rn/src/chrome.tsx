// Cornice dell'app, come nell'app attuale sul telefono (body.mob): barra in alto con il marchio Digivice e il pulsante ⋯,
// foglio "Altro" (Prossime uscite, Immagini offline, Informazioni, tema), barra di navigazione in basso.
import { ReactNode, useState, useSyncExternalStore } from "react";
import { Keyboard, Modal, Platform, Pressable, View } from "react-native";
import { router, usePathname, useGlobalSearchParams } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { Text, DISPLAY } from "./Text";
import { CARDS, UPCOMING } from "./data";
import { decksTodo } from "./decks";
import { owned, useStore } from "./store";
import { setThemePref, useTheme } from "./theme";
import { Icon } from "./ui";

export const TABH = 64; // altezza della barra in basso (senza il bordo inferiore del telefono)

// Marchio Digivice (src/icons/digital-gate-mark.svg, come .dgmark nel sito)
export function DgMark({ size = 30 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="40 40 240 240" fill="none">
      <Path d="M114 38H206C214 38 219 42 225 48L272 95C278 101 282 108 282 116V204C282 212 278 219 272 225L225 272C219 278 212 282 204 282H116C108 282 101 278 95 272L48 225C42 219 38 212 38 204V116C38 108 42 101 48 95L95 48C101 42 108 38 114 38Z" fill="#ff7a3d" transform="translate(160 160) scale(.96) translate(-160 -160)" />
      <Path d="M119 57H201L263 119V201L201 263H119L57 201V119L119 57Z" fill="#17253b" />
      <Path d="M108 239L68 199V121L121 68H199L252 121V199L212 239" stroke="#63d5ee" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
      <Rect x={88} y={87} width={144} height={145} rx={23} fill="#08111f" stroke="#f1f4f9" strokeWidth={9} />
      <Path d="M111 111H209" stroke="#28425b" strokeWidth={5} strokeLinecap="round" />
      <Path d="M128 194V128H159C181 128 196 142 196 161C196 181 181 194 160 194H153" stroke="#63d5ee" strokeWidth={13} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M160 152C157.8 152 154.5 158.8 154.5 163C154.5 167.4 156.7 170 160 170C163.3 170 165.5 167.4 165.5 163C165.5 158.8 162.2 152 160 152Z" fill="#f1f4f9" />
      <Rect x={118} y={248} width={20} height={8} rx={4} fill="#ff7a3d" />
      <Rect x={150} y={248} width={20} height={8} rx={4} fill="#63d5ee" />
      <Rect x={182} y={248} width={20} height={8} rx={4} fill="#ff7a3d" />
    </Svg>
  );
}

// ---- foglio "Altro"
let openMore: (o: boolean) => void = () => {};

function ThemeIcon({ dark, color }: { dark: boolean; color: string }) {
  const p = { stroke: color, strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      {dark ? (
        <>
          <Circle {...p} cx={12} cy={12} r={4} />
          <Path {...p} d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </>
      ) : (
        <Path {...p} d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
      )}
    </Svg>
  );
}

export function MoreSheet() {
  const t = useTheme();
  const ins = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  useStore();
  openMore = setOpen;
  let uniq = 0;
  if (open) CARDS.forEach((c) => owned(c) && uniq++);
  const go = (href: any) => {
    setOpen(false);
    router.push(href);
  };
  const Row = ({ icon, label, onPress, right }: { icon: ReactNode; label: string; onPress: () => void; right?: ReactNode }) => (
    <Pressable onPress={onPress} style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: t.line }}>
      {icon}
      <Text style={{ color: t.ink, fontSize: 16, fontWeight: "600", flex: 1 }}>{label}</Text>
      {right}
    </Pressable>
  );
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)} statusBarTranslucent>
      <Pressable style={{ flex: 1, backgroundColor: t.scrim }} onPress={() => setOpen(false)} />
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, maxHeight: "82%", backgroundColor: t.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 18 + ins.bottom, boxShadow: "0 -10px 40px rgba(0,0,0,.25)" }}>
        <View style={{ alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: t.line }} />
        <Text style={{ color: t.ink, fontFamily: DISPLAY, fontWeight: "700", fontSize: 18.4, marginTop: 6, marginBottom: 8 }}>Altro</Text>
        <Row
          icon={<Icon name="soon" color={t.ink2} size={20} />}
          label="Prossime uscite"
          onPress={() => go({ pathname: "/prodotti", params: { seg: "soon" } })}
          right={
            UPCOMING.length ? (
              <View style={{ backgroundColor: t.cyanSoft, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 2 }}>
                <Text style={{ color: t.cyan, fontFamily: DISPLAY, fontWeight: "700", fontSize: 11.5 }}>{UPCOMING.length}</Text>
              </View>
            ) : null
          }
        />
        <Row icon={<Icon name="offline" color={t.ink2} size={20} />} label="Immagini offline" onPress={() => go("/offline")} />
        <Row icon={<Icon name="info" color={t.ink2} size={20} />} label="Informazioni" onPress={() => go("/info")} />
        <Row icon={<ThemeIcon dark={t.dark} color={t.ink2} />} label={t.dark ? "Tema chiaro" : "Tema scuro"} onPress={() => setThemePref(t.dark ? "light" : "dark")} />
        <Text style={{ color: t.ink2, fontSize: 11.8, marginTop: 14, lineHeight: 17 }}>Digital Gate - Digimon TCG · catalogo non ufficiale. Immagini e marchi © Bandai, Akiyoshi Hongo, Toei Animation.</Text>
        <View style={{ marginTop: 16, padding: 12, borderRadius: 12, backgroundColor: t.surface, borderWidth: 1, borderColor: t.line }}>
          <Text style={{ color: t.ink2, fontFamily: DISPLAY, fontWeight: "600", fontSize: 13.6, marginBottom: 8 }}>
            <Text style={{ color: t.accent, fontFamily: DISPLAY, fontWeight: "600" }}>{uniq}</Text> / {CARDS.length} carte
          </Text>
          <View style={{ height: 4, backgroundColor: t.surface2, borderRadius: 2, overflow: "hidden" }}>
            <View style={{ height: "100%", width: `${(uniq / CARDS.length) * 100}%`, backgroundColor: t.accent }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ---- barra in alto (.bar con .mbrand e .morebtn)
export function AppBar({ children }: { children?: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ backgroundColor: t.bg, borderBottomWidth: 1, borderBottomColor: t.line, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Pressable onPress={() => goTab("home")} accessibilityLabel="Digital Gate - Digimon TCG, vai alla Home" style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 4, paddingHorizontal: 2 }}>
          <DgMark />
          <View>
            <Text style={{ color: t.ink, fontFamily: DISPLAY, fontWeight: "700", fontSize: 16, lineHeight: 17, letterSpacing: 1.28, textTransform: "uppercase" }}>Digital Gate</Text>
            <Text style={{ color: t.ink2, fontFamily: DISPLAY, fontWeight: "600", fontSize: 9, letterSpacing: 3.06 }}>Digimon TCG</Text>
          </View>
        </Pressable>
        <Pressable onPress={() => openMore(true)} accessibilityLabel="Altro: prossime uscite, informazioni e tema" style={{ width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: t.line, backgroundColor: t.surface, alignItems: "center", justifyContent: "center" }}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill={t.ink}>
            <Circle cx={5} cy={12} r={2} />
            <Circle cx={12} cy={12} r={2} />
            <Circle cx={19} cy={12} r={2} />
          </Svg>
        </Pressable>
      </View>
      {children}
    </View>
  );
}

// Schermata con la barra in alto; il contenuto lascia spazio alla barra in basso
export function Screen({ children, bar }: { children: ReactNode; bar?: ReactNode }) {
  const t = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top"]}>
      <AppBar>{bar}</AppBar>
      <View style={{ flex: 1 }}>{children}</View>
    </SafeAreaView>
  );
}

// tastiera aperta: la barra in basso si nasconde (come body.kbd nel sito)
let KBD = false;
const kbdSubs = new Set<() => void>();
if (Platform.OS !== "web") {
  Keyboard.addListener("keyboardDidShow", () => ((KBD = true), kbdSubs.forEach((f) => f())));
  Keyboard.addListener("keyboardDidHide", () => ((KBD = false), kbdSubs.forEach((f) => f())));
}
export const useKbd = () => useSyncExternalStore((f) => (kbdSubs.add(f), () => kbdSubs.delete(f)), () => KBD, () => KBD);

// spazio da lasciare in fondo alle pagine per la barra di navigazione
export function useTabPad() {
  const b = useSafeAreaInsets().bottom;
  return useKbd() ? 0 : TABH + b;
}

// ---- barra di navigazione in basso
type TabId = "home" | "sets" | "cards" | "coll" | "deck";
const TABS: [TabId, string, string, string][] = [
  ["home", "Home", "home", "/"],
  ["sets", "Prodotti", "sets", "/prodotti"],
  ["cards", "Carte", "cards", "/carte"],
  ["coll", "Collezione", "coll", "/collezione"],
  ["deck", "Mazzi", "deck", "/mazzi"],
];
const TABROOTS = TABS.map((x) => x[3]);
// Pagine senza barra in basso: scheda carta e scansione (a tutto schermo)
const NOBAR = /^\/(carta|scansiona)/;

export function goTab(id: TabId) {
  const href = TABS.find((x) => x[0] === id)![3];
  if (router.canDismiss()) router.dismissAll();
  router.navigate(href as any);
}

function curTab(path: string, from?: string): TabId | null {
  if (path === "/") return "home";
  if (path.startsWith("/prodott")) return from === "coll" ? "coll" : "sets";
  if (path.startsWith("/carte")) return "cards";
  if (path.startsWith("/collezione")) return "coll";
  if (path.startsWith("/mazz")) return "deck";
  return null;
}

export function TabBar() {
  const t = useTheme();
  const ins = useSafeAreaInsets();
  const path = usePathname();
  const params = useGlobalSearchParams<{ from?: string }>();
  const kbd = useKbd();
  useStore();
  if (NOBAR.test(path) || kbd) return null;
  const cur = curTab(path, params.from);
  const todo = decksTodo();
  return (
    <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", backgroundColor: t.surface, borderTopWidth: 1, borderTopColor: t.line, paddingTop: 6, paddingHorizontal: 4, paddingBottom: 8 + ins.bottom, boxShadow: "0 -4px 16px rgba(15,26,46,.06)" }}>
      {TABS.map(([id, label, icon, href]) => {
        const on = cur === id;
        return (
          <Pressable key={id} onPress={() => (on && TABROOTS.includes(path) ? null : goTab(id))} accessibilityLabel={id === "deck" && todo ? `${label}, ${todo} ${todo === 1 ? "mazzo da completare" : "mazzi da completare"}` : label} style={{ flex: 1, minHeight: 50, alignItems: "center", justifyContent: "center", gap: 3 }}>
            {on && <View style={{ position: "absolute", top: 2, width: 44, height: 30, borderRadius: 15, backgroundColor: t.accentSoft }} />}
            <Icon name={icon} color={on ? t.accent : t.ink2} size={23} />
            <Text style={{ color: on ? t.accent : t.ink2, fontSize: 11.2, fontWeight: on ? "700" : "500" }}>{label}</Text>
            {id === "deck" && todo ? (
              <View style={{ position: "absolute", top: 2, left: "50%", marginLeft: 6, minWidth: 16, height: 16, paddingHorizontal: 4, borderRadius: 8, backgroundColor: t.cyan, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: "#fff", fontFamily: DISPLAY, fontWeight: "700", fontSize: 9.6, lineHeight: 16 }}>{todo}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
