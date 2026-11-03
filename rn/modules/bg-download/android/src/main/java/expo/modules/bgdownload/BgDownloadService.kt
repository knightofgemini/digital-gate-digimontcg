package expo.modules.bgdownload

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.wifi.WifiManager
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat

/**
 * Servizio in primo piano mentre l'app scarica le immagini (Immagini offline): Android non chiude l'app quando va in
 * sottofondo e lo scaricamento continua. Notifica con l'avanzamento, wake lock (al massimo 6 ore) e Wi-Fi tenuto acceso
 * anche a schermo spento. Stesso comportamento di BgDownloadService dell'APK attuale.
 */
class BgDownloadService : Service() {
  private var lock: PowerManager.WakeLock? = null
  private var wifi: WifiManager.WifiLock? = null

  companion object {
    const val CH = "dg_download"
    const val ID = 4271

    fun build(ctx: Context, title: String?, text: String?, done: Int, total: Int): Notification {
      val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CH) == null) {
        val ch = NotificationChannel(CH, "Scaricamento immagini", NotificationManager.IMPORTANCE_LOW)
        ch.description = "Avanzamento dello scaricamento delle immagini delle carte"
        ch.setShowBadge(false)
        nm.createNotificationChannel(ch)
      }
      val open = ctx.packageManager.getLaunchIntentForPackage(ctx.packageName)
      val pi = if (open == null) null else PendingIntent.getActivity(ctx, 0, open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
      val b = NotificationCompat.Builder(ctx, CH)
        .setSmallIcon(android.R.drawable.stat_sys_download)
        .setContentTitle(title ?: "Digital Gate")
        .setContentText(text ?: "")
        .setOnlyAlertOnce(true)
        .setOngoing(true)
        .setSilent(true)
        .setPriority(NotificationCompat.PRIORITY_LOW)
        .setCategory(NotificationCompat.CATEGORY_PROGRESS)
      if (total > 0) b.setProgress(total, minOf(done, total), false) else b.setProgress(0, 0, true)
      if (pi != null) b.setContentIntent(pi)
      return b.build()
    }
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val n = build(this, intent?.getStringExtra("title"), intent?.getStringExtra("text"), 0, 0)
    if (Build.VERSION.SDK_INT >= 29) startForeground(ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
    else startForeground(ID, n)
    if (lock == null) {
      val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
      lock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "DigitalGate:download").also {
        it.setReferenceCounted(false)
        it.acquire(6 * 60 * 60 * 1000L)
      }
    }
    if (wifi == null) {
      try {
        val wm = applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
        @Suppress("DEPRECATION")
        val mode = if (Build.VERSION.SDK_INT >= 29) WifiManager.WIFI_MODE_FULL_HIGH_PERF else WifiManager.WIFI_MODE_FULL
        wifi = wm.createWifiLock(mode, "DigitalGate:download").also {
          it.setReferenceCounted(false)
          it.acquire()
        }
      } catch (e: Exception) {
        wifi = null
      }
    }
    return START_NOT_STICKY
  }

  // Android 15: limite di tempo dei servizi "dataSync"
  override fun onTimeout(startId: Int) {
    stopSelf()
  }

  override fun onTimeout(startId: Int, fgsType: Int) {
    stopSelf()
  }

  override fun onDestroy() {
    try {
      if (lock?.isHeld == true) lock?.release()
    } catch (e: Exception) {}
    lock = null
    try {
      if (wifi?.isHeld == true) wifi?.release()
    } catch (e: Exception) {}
    wifi = null
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null
}
