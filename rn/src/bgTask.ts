// Controllo delle carte nuove in sottofondo (12 novembre 2026, richiesta dell'utente: "ma non può fare il controllo
// prima dell'apertura dell'app?"). Android lo fa partire ogni tanto anche ad app chiusa (WorkManager, circa ogni 30
// minuti e solo con internet: il momento esatto lo decide il telefono). Il compito legge ver.json del sito; se ci sono
// carte nuove le scarica e le salva come all'apertura (dataupd.ts → bgCheck) e manda una notifica, per esempio
// "12 carte nuove in BT27". All'apertura le carte sono già pronte e il riepilogo compare nel solito riquadro, insieme
// alle immagini (News.tsx → startupNews). Le immagini non si scaricano in sottofondo: arrivano all'apertura.
// Questo file si carica prima dell'app (index.js): Android avvia il compito anche senza aprire nessuna schermata.
import { AppState, Platform } from "react-native";
import * as TaskManager from "expo-task-manager";
import * as BackgroundTask from "expo-background-task";
import * as Notifications from "expo-notifications";
import bundledData from "../data/data.json";
import bundledProducts from "../data/products.json";
import { News, bgCheck, dataInUse, notified, pickData } from "./dataupd";

export const BG_TASK = "dg-carte-nuove";
const CHANNEL = "novita";
const ANDROID = Platform.OS === "android";

const plural = (n: number, one: string, many: string) => n + " " + (n === 1 ? one : many);
const list = (a: string[]) => (a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " e " + a[a.length - 1]);
// testo della notifica: "12 carte nuove in BT27", sotto i nomi delle prime carte
export function notifText(n: News): { title: string; body: string } {
  const p: string[] = [];
  if (n.n) p.push(plural(n.n, "carta nuova", "carte nuove"));
  if (n.c) p.push(plural(n.c, "carta corretta", "carte corrette"));
  const codes = n.groups.map((g) => g.code);
  const where = codes.length <= 3 ? " in " + list(codes) : " in " + codes.length + " prodotti";
  const names: string[] = [];
  const seen = new Set<string>();
  n.groups.forEach((g) =>
    g.cards.forEach((c) => {
      if (c.kind === "n" && !seen.has(c.name)) seen.add(c.name), names.push(c.name);
    }),
  );
  if (!names.length) n.groups.forEach((g) => g.cards.forEach((c) => !seen.has(c.name) && (seen.add(c.name), names.push(c.name))));
  const more = names.length - 4;
  const body = names.slice(0, 4).join(", ") + (more > 0 ? " e " + plural(more, "altra", "altre") : "") + ". Tocca per vederle.";
  return { title: p.join(" e ") + where, body };
}

async function channel() {
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: "Carte nuove",
    description: "Avviso quando arrivano carte nuove o corrette (spoiler e prodotti in arrivo)",
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: "#22d3ee",
  });
}

async function notify(n: News) {
  if (notified(n.h)) return;
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) return;
  await channel();
  const { title, body } = notifText(n);
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data: { h: n.h }, color: "#22d3ee" },
    trigger: { channelId: CHANNEL } as any,
  });
  notified(n.h, true);
}

if (ANDROID)
  TaskManager.defineTask(BG_TASK, async () => {
    try {
      // app chiusa: i dati in uso sono quelli dell'APK o gli ultimi scaricati (gli stessi che sceglie data.ts)
      if (!dataInUse()) pickData<any, any>(bundledData, bundledProducts);
      const n = await bgCheck();
      if (n === false) return BackgroundTask.BackgroundTaskResult.Failed;
      // con l'app davanti agli occhi basta il riquadro
      if (n && n.groups.length && AppState.currentState !== "active") await notify(n);
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch (e) {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });

// da _layout.tsx all'avvio: iscrizione del compito (una volta, poi ci pensa Android anche dopo il riavvio del telefono)
// e via le notifiche già lette (le carte sono nel riquadro)
export async function startBackground() {
  if (!ANDROID) return;
  Notifications.dismissAllNotificationsAsync().catch(() => {});
  try {
    const st = await BackgroundTask.getStatusAsync();
    if (st !== BackgroundTask.BackgroundTaskStatus.Available) return;
    if (!(await TaskManager.isTaskRegisteredAsync(BG_TASK))) await BackgroundTask.registerTaskAsync(BG_TASK, { minimumInterval: 30 });
  } catch (e) {}
}

// permesso delle notifiche (Android 13 e successivi): chiesto una volta, dopo l'intro
export async function askNotifications() {
  if (!ANDROID) return;
  try {
    await channel();
    const p = await Notifications.getPermissionsAsync();
    if (p.granted || !p.canAskAgain) return;
    await Notifications.requestPermissionsAsync();
  } catch (e) {}
}
