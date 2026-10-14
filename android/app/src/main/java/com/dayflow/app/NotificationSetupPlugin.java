package com.dayflow.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Locale;

@CapacitorPlugin(name = "NotificationSetup")
public class NotificationSetupPlugin extends Plugin {
    private static final String CHANNEL = "dayflow-reminders";
    private static final String PREFS = "dayflow-notification-setup";

    private NotificationChannel ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return null;
        NotificationManager manager = getContext().getSystemService(NotificationManager.class);
        NotificationChannel channel = manager.getNotificationChannel(CHANNEL);
        // Never replace an existing channel: its sound remains the user's choice.
        if (channel == null) {
            channel = new NotificationChannel(CHANNEL, "Recordatorios", NotificationManager.IMPORTANCE_HIGH);
            channel.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),
                new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION).build());
            channel.enableVibration(true);
            channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PRIVATE);
            manager.createNotificationChannel(channel);
        }
        return manager.getNotificationChannel(CHANNEL);
    }

    private JSObject status() {
        NotificationChannel channel = ensureChannel();
        String manufacturer = Build.MANUFACTURER.toLowerCase(Locale.ROOT);
        boolean autostartRequired = manufacturer.equals("xiaomi") || manufacturer.equals("redmi") || manufacturer.equals("poco");
        android.content.SharedPreferences prefs = getContext().getSharedPreferences(PREFS, 0);
        JSObject result = new JSObject();
        result.put("notifications", NotificationManagerCompat.from(getContext()).areNotificationsEnabled()
            && (channel == null || channel.getImportance() != NotificationManager.IMPORTANCE_NONE));
        android.media.AudioManager audio = getContext().getSystemService(android.media.AudioManager.class);
        result.put("sound", channel == null
            ? audio != null && audio.getStreamVolume(android.media.AudioManager.STREAM_NOTIFICATION) > 0
                && audio.getRingerMode() == android.media.AudioManager.RINGER_MODE_NORMAL
            : channel.getSound() != null && channel.getImportance() >= NotificationManager.IMPORTANCE_DEFAULT);
        result.put("vibration", channel != null && channel.shouldVibrate());
        result.put("autostartRequired", autostartRequired);
        result.put("autostartConfirmed", prefs.getBoolean("autostartConfirmed", false));
        result.put("completed", prefs.getBoolean("completed-v1", false));
        return result;
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        call.resolve(status());
    }

    @PluginMethod
    public void complete(PluginCall call) {
        JSObject current = status();
        boolean confirmed = Boolean.TRUE.equals(call.getBoolean("autostartConfirmed", false));
        if (!current.getBool("notifications") || !current.getBool("sound")
            || (current.getBool("autostartRequired") && !confirmed)) {
            call.reject("Activa las notificaciones, el sonido y confirma el autoinicio antes de continuar.");
            return;
        }
        getContext().getSharedPreferences(PREFS, 0).edit()
            .putBoolean("autostartConfirmed", confirmed).putBoolean("completed-v1", true).apply();
        call.resolve(status());
    }

    private void open(PluginCall call, Intent intent) {
        try {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("No se pudieron abrir los ajustes. Ábrelos desde Ajustes → Aplicaciones → Dayflow.");
        }
    }

    @PluginMethod
    public void openSoundSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            openAppSettings(call);
            return;
        }
        ensureChannel();
        open(call, new Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS)
            .putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName())
            .putExtra(Settings.EXTRA_CHANNEL_ID, CHANNEL));
    }

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        open(call, new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
            Uri.parse("package:" + getContext().getPackageName())));
    }
}
