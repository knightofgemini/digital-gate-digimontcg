// Controllo delle carte nuove in sottofondo (12 novembre 2026, richiesta dell'utente: "ma non può fare il controllo
// prima dell'apertura dell'app?"). Android lo fa partire ogni tanto anche ad app chiusa (WorkManager, circa ogni 30
// minuti e solo con internet: il momento esatto lo decide il telefono). Il compito legge ver.json del sito; se ci sono
// carte nuove le scarica e le salva come all'apertura (dataupd.ts → bgCheck) e manda una notifica, per esempio
// "12 carte nuove in BT27". All'apertura le carte sono già pronte e il riepilogo compare nel solito riquadro, insieme
// alle immagini (News.tsx → startupNews). Dopo la notifica scarica anche le immagini delle carte nuove (miniature
// sempre; grandi solo con lo scaricamento automatico in HD e senza dati mobili), così all'apertura il riquadro è pronto
// appena finisce l'intro (12 novembre 2026, richiesta dell'utente).
// Questo file si carica prima dell'app (index.js): Android avvia il compito anche senza aprire nessuna schermata.
import { AppState, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Network from "expo-network";
import * as TaskManager from "expo-task-manager";
import * as BackgroundTask from "expo-background-task";
import * as Notifications from "expo-notifications";
import bundledData from "../data/data.json";
import bundledProducts from "../data/products.json";
import { News, bgCheck, dataInUse, notified, pickData } from "./dataupd";
import { loadImages, saveImg, vurl } from "./imgstore";

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

// immagini delle carte del riepilogo nella cartella delle immagini (imgstore): le stesse che lo scaricamento automatico
// dell'apertura (offline.ts) cercherebbe, che così le trova già salvate e finisce subito
async function prefetch(n: News) {
  await loadImages();
  let off: any = {};
  try {
    off = JSON.parse((await AsyncStorage.getItem("dg-offline")) || "{}") || {};
  } catch (e) {}
  let mobile = false;
  try {
    mobile = (await Network.getNetworkStateAsync()).type === Network.NetworkStateType.CELLULAR;
  } catch (e) {}
  const on = !!off.auto && !off.paused && !mobile;
  const urls = new Set<string>();
  n.groups.forEach((g) => {
    const hd = on && (off.m === "hd" ? !(off.x || []).includes(g.id) : (off.ps || []).includes(g.id));
    g.cards.forEach((c) => {
      if (!c.u) return;
      urls.add(vurl(c.u));
      if (hd) urls.add(vurl(c.u.replace("/img/t/", "/img/f/")));
    });
  });
  const todo = [...urls].slice(0, 600);
  let i = 0;
  const one = async () => {
    while (i < todo.length) await saveImg(todo[i++]).catch(() => {});
  };
  await Promise.all([one(), one(), one(), one()]);
}

if (ANDROID)
  TaskManager.defineTask(BG_TASK, async () => {
    try {
      // app chiusa: i dati in uso sono quelli dell'APK o gli ultimi scaricati (gli stessi che sceglie data.ts)
      if (!dataInUse()) pickData<any, any>(bundledData, bundledProducts);
      const n = await bgCheck();
      if (n === false) return BackgroundTask.BackgroundTaskResult.Failed;
      // con l'app davanti agli occhi basta il riquadro
      if (n && n.groups.length && AppState.currentState !== "active") await notify(n).catch(() => {});
      if (n && n.groups.length) await prefetch(n).catch(() => {});
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
    const reg = await TaskManager.isTaskRegisteredAsync(BG_TASK);
    if (!reg) await BackgroundTask.registerTaskAsync(BG_TASK, { minimumInterval: 30 });
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
