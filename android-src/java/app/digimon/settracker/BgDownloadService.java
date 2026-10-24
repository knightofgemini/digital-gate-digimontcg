package app.digimon.settracker;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import androidx.core.app.NotificationCompat;

/**
 * Servizio in primo piano mentre l'app scarica le immagini (Immagini offline): Android non chiude l'app
 * quando va in sottofondo e lo scaricamento, che avviene nella pagina, continua. Mostra una notifica con l'avanzamento.
 * Lo avvia e lo ferma la pagina tramite BgDownloadPlugin.
 */
public class BgDownloadService extends Service {
    static final String CH = "dg_download";
    static final int ID = 4271;
    private PowerManager.WakeLock lock;

    static Notification build(Context ctx, String title, String text, int done, int total) {
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CH) == null) {
            NotificationChannel ch = new NotificationChannel(CH, "Scaricamento immagini", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("Avanzamento dello scaricamento delle immagini delle carte");
            ch.setShowBadge(false);
            nm.createNotificationChannel(ch);
        }
        Intent open = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
        PendingIntent pi = open == null ? null : PendingIntent.getActivity(ctx, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CH)
            .setSmallIcon(android.R.drawable.stat_sys_download)
            .setContentTitle(title == null ? "Digital Gate" : title)
            .setContentText(text == null ? "" : text)
            .setOnlyAlertOnce(true)
            .setOngoing(true)
            .setSilent(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_PROGRESS);
        if (total > 0) b.setProgress(total, Math.min(done, total), false); else b.setProgress(0, 0, true);
        if (pi != null) b.setContentIntent(pi);
        return b.build();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String title = intent != null ? intent.getStringExtra("title") : null;
        String text = intent != null ? intent.getStringExtra("text") : null;
        Notification n = build(this, title, text, 0, 0);
        if (Build.VERSION.SDK_INT >= 29) startForeground(ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
        else startForeground(ID, n);
        if (lock == null) {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            lock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "DigitalGate:download");
            lock.setReferenceCounted(false);
            lock.acquire(6 * 60 * 60 * 1000L);   // al massimo 6 ore, poi si libera da sé
        }
        return START_NOT_STICKY;
    }

    // Android 15: limite di tempo dei servizi "dataSync" (senza @Override: il metodo non esiste nell'SDK con cui si compila)
    public void onTimeout(int startId) { stopSelf(); }
    public void onTimeout(int startId, int fgsType) { stopSelf(); }

    @Override
    public void onDestroy() {
        if (lock != null && lock.isHeld()) lock.release();
        lock = null;
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
