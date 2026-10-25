// Servizio nativo dell'APK (modules/bg-download, solo Android) usato da "Immagini offline": tiene viva l'app in sottofondo
// mentre scarica e mostra l'avanzamento nella notifica (come BgDownload dell'APK attuale). Sul web e in Expo Go non c'è (null).
import { PermissionsAndroid, Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";

type Native = {
  start(title: string, text: string): boolean;
  update(title: string, text: string, done: number, total: number): void;
  stop(): void;
  battery(): boolean;
  askBattery(): void;
};
const M = Platform.OS === "android" ? requireOptionalNativeModule<Native>("BgDownload") : null;

export const BGD = M
  ? {
      // Android 13+: la notifica dell'avanzamento richiede il permesso (lo scaricamento funziona comunque anche senza)
      async start(title: string, text: string, noAsk: boolean) {
        try {
          if (!noAsk && Number(Platform.Version) >= 33) await PermissionsAndroid.request("android.permission.POST_NOTIFICATIONS" as any).catch(() => null);
          return !!M.start(title, text);
        } catch (e) {
          return false;
        }
      },
      update(title: string, text: string, done: number, total: number) {
        try {
          M.update(title, text, done, total);
        } catch (e) {}
      },
      stop() {
        try {
          M.stop();
        } catch (e) {}
      },
      battery() {
        try {
          return M.battery();
        } catch (e) {
          return true;
        }
      },
      askBattery() {
        try {
          M.askBattery();
        } catch (e) {}
      },
    }
  : null;
