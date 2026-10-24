package app.digimon.settracker;

import android.Manifest;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/** Usato dalla pagina (window.Capacitor.Plugins.BgDownload): start / update / stop del servizio di scaricamento. */
@CapacitorPlugin(name = "BgDownload", permissions = { @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS }) })
public class BgDownloadPlugin extends Plugin {
    private boolean running = false;

    @PluginMethod
    public void start(PluginCall call) {
        // Android 13+: la notifica dell'avanzamento richiede il permesso (lo scaricamento funziona comunque anche senza)
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED && !call.getBoolean("noAsk", false)) {
            requestPermissionForAlias("notifications", call, "afterPerm");
            return;
        }
        doStart(call);
    }

    @PermissionCallback
    private void afterPerm(PluginCall call) { doStart(call); }

    private void doStart(PluginCall call) {
        try {
            Context ctx = getContext();
            Intent i = new Intent(ctx, BgDownloadService.class);
            i.putExtra("title", call.getString("title", "Scaricamento immagini"));
            i.putExtra("text", call.getString("text", ""));
            ContextCompat.startForegroundService(ctx, i);
            running = true;
            JSObject r = new JSObject(); r.put("ok", true); call.resolve(r);
        } catch (Exception e) {
            call.reject("Servizio non avviato: " + e.getMessage());
        }
    }

    @PluginMethod
    public void update(PluginCall call) {
        if (!running) { call.resolve(); return; }
        try {
            NotificationManager nm = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
            nm.notify(BgDownloadService.ID, BgDownloadService.build(getContext(), call.getString("title", "Scaricamento immagini"),
                call.getString("text", ""), call.getInt("done", 0), call.getInt("total", 0)));
        } catch (Exception e) { /* notifica non disponibile: si ignora */ }
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        try { getContext().stopService(new Intent(getContext(), BgDownloadService.class)); } catch (Exception e) {}
        running = false;
        call.resolve();
    }
}
