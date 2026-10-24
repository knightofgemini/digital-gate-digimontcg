package app.digimon.settracker;

import android.Manifest;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.PowerManager;
import android.net.Uri;
import android.provider.Settings;
import android.util.Log;
import android.webkit.WebView;
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
            keepRenderer(true);
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
        Log.i("DGBG", "avanzamento " + call.getInt("done", 0) + "/" + call.getInt("total", 0));
        call.resolve();
    }

    /**
     * Quando l'app non è visibile Android abbassa la priorità del processo che esegue la pagina e può congelarlo o chiuderlo:
     * mentre si scarica la pagina resta "importante" anche a schermo spento; finito lo scaricamento si torna al normale.
     */
    private void keepRenderer(final boolean on) {
        if (Build.VERSION.SDK_INT < 26) return;
        try {
            final WebView wv = getBridge().getWebView();
            getActivity().runOnUiThread(() -> {
                try {
                    wv.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, !on);
                    Log.i("DGBG", "priorita pagina: " + wv.getRendererRequestedPriority() + " ridotta se invisibile: " + wv.getRendererPriorityWaivedWhenNotVisible());
                } catch (Exception e) {}
            });
        } catch (Exception e) {}
    }

    /** risparmio energetico: l'app è già esclusa dalle ottimizzazioni della batteria? */
    @PluginMethod
    public void battery(PluginCall call) {
        JSObject r = new JSObject();
        try {
            PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
            r.put("ignoring", Build.VERSION.SDK_INT < 23 || pm.isIgnoringBatteryOptimizations(getContext().getPackageName()));
        } catch (Exception e) { r.put("ignoring", false); }
        call.resolve(r);
    }

    /** apre la finestra di Android per escludere l'app dalle ottimizzazioni della batteria (scaricamento a schermo spento) */
    @PluginMethod
    public void askBattery(PluginCall call) {
        try {
            Intent i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + getContext().getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
        } catch (Exception e) {
            try {
                Intent j = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS); j.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(j);
            } catch (Exception e2) { call.reject("non disponibile"); return; }
        }
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        try { getContext().stopService(new Intent(getContext(), BgDownloadService.class)); } catch (Exception e) {}
        running = false;
        keepRenderer(false);
        Log.i("DGBG", "fine");
        call.resolve();
    }
}
