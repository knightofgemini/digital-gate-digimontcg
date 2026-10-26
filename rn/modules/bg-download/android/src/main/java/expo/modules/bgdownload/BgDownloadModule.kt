package expo.modules.bgdownload

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.provider.Settings
import android.util.Log
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

/**
 * "BgDownload" per src/bgdl.ts. Funzioni sincrone (start/battery restituiscono subito il risultato),
 * più sleep() asincrona: un'attesa fatta da Android, che a differenza dei timer di JavaScript continua
 * anche con l'app in sottofondo e lo schermo spento (i timer di React Native si fermano).
 */
class BgDownloadModule : Module() {
  private val ctx: Context
    get() = requireNotNull(appContext.reactContext) { "contesto non disponibile" }
  private val main = Handler(Looper.getMainLooper())

  override fun definition() = ModuleDefinition {
    Name("BgDownload")

    Function("start") { title: String, text: String ->
      try {
        val i = Intent(ctx, BgDownloadService::class.java)
        i.putExtra("title", title)
        i.putExtra("text", text)
        ContextCompat.startForegroundService(ctx, i)
        Log.i("DGBG", "inizio")
        true
      } catch (e: Exception) {
        // es. ForegroundServiceStartNotAllowedException: avvio chiesto con l'app già in sottofondo
        Log.w("DGBG", "servizio non avviato: " + e)
        false
      }
    }

    Function("update") { title: String, text: String, done: Int, total: Int ->
      try {
        NotificationManagerCompat.from(ctx).notify(BgDownloadService.ID, BgDownloadService.build(ctx, title, text, done, total))
      } catch (e: Exception) {}
    }

    Function("stop") {
      try {
        ctx.stopService(Intent(ctx, BgDownloadService::class.java))
      } catch (e: Exception) {}
      Log.i("DGBG", "fine")
    }

    Function("battery") {
      try {
        val pm = ctx.getSystemService(Context.POWER_SERVICE) as PowerManager
        Build.VERSION.SDK_INT < 23 || pm.isIgnoringBatteryOptimizations(ctx.packageName)
      } catch (e: Exception) {
        false
      }
    }

    Function("askBattery") {
      try {
        val i = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + ctx.packageName))
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        ctx.startActivity(i)
      } catch (e: Exception) {
        try {
          val j = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
          j.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          ctx.startActivity(j)
        } catch (e2: Exception) {}
      }
    }

    AsyncFunction("sleep") { ms: Double, promise: Promise ->
      main.postDelayed({ promise.resolve(null) }, maxOf(0.0, ms).toLong())
    }

    // memoria delle immagini dell'app attuale (WebView di Capacitor, fino a ~500 MB) che la nuova app non usa:
    // si cancella solo quella, non la memoria dei dati (Local Storage) da cui si recuperano collezione e mazzi
    Function("clearOldImages") {
      try {
        val sw = File(ctx.applicationInfo.dataDir, "app_webview/Default/Service Worker")
        var ok = false
        for (name in arrayOf("CacheStorage", "ScriptCache")) {
          val f = File(sw, name)
          if (f.exists()) ok = f.deleteRecursively() || ok
        }
        ok
      } catch (e: Exception) {
        false
      }
    }
  }
}
