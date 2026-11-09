package com.dayflow.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.os.SystemClock;
import android.os.ParcelFileDescriptor;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import com.capacitorjs.plugins.localnotifications.LocalNotification;
import com.capacitorjs.plugins.localnotifications.LocalNotificationManager;
import com.capacitorjs.plugins.localnotifications.NotificationStorage;
import com.getcapacitor.CapConfig;
import com.getcapacitor.JSObject;
import java.io.ByteArrayOutputStream;
import java.io.FileInputStream;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Collections;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class PriorityAlarmProbeTest {
    private String dump() throws Exception {
        ParcelFileDescriptor descriptor = InstrumentationRegistry.getInstrumentation().getUiAutomation().executeShellCommand("dumpsys alarm");
        try (FileInputStream input = new ParcelFileDescriptor.AutoCloseInputStream(descriptor);
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] bytes = new byte[8192]; int n;
            while ((n = input.read(bytes)) != -1) output.write(bytes, 0, n);
            return output.toString(StandardCharsets.UTF_8.name());
        }
    }
    private JSONArray block(long at) throws Exception {
        String[] lines = dump().split("\\n"); JSONArray selected = new JSONArray();
        for (int i = 0; i < lines.length; i++) {
            if (lines[i].contains("Alarm{") && lines[i].contains("com.dayflow.app}") && lines[i].contains("origWhen " + at)) {
                for (int j = i; j < Math.min(lines.length, i + 10); j++) {
                    if (j > i && lines[j].contains("Alarm{")) break;
                    selected.put(lines[j].trim());
                }
                break;
            }
        }
        return selected;
    }
    @Test public void storedPriorityRebuildsAsClockWithoutShiftingOrTouchingUserReminders() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertEquals("com.dayflow.app", context.getPackageName());
        final int id = 1900000100;
        NotificationStorage storage = new NotificationStorage(context);
        assertNull("Reserved probe ID must be unused", storage.getSavedNotification(String.valueOf(id)));
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        LocalNotificationManager manager = new LocalNotificationManager(storage, null, context, CapConfig.loadDefault(context));
        long wallAt = System.currentTimeMillis() + 13 * 60000L + 41000L;
        long elapsedAt = SystemClock.elapsedRealtime() + 13 * 60000L + 41000L;
        SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        format.setTimeZone(TimeZone.getTimeZone("UTC"));
        JSObject schedule = new JSObject();
        schedule.put("at", format.format(new Date(wallAt)));
        schedule.put("allowWhileIdle", true);
        schedule.put("dayflowAlarmClock", true);
        JSObject source = new JSObject();
        source.put("id", id); source.put("title", "Dayflow priority probe (never delivered)");
        source.put("channelId", "dayflow-reminders"); source.put("schedule", schedule);
        source.put("isExactNotification", true); source.put("isExactMandatory", true);
        JSONObject result = new JSONObject();
        try {
            LocalNotification original = LocalNotification.Companion.buildNotificationFromJSObject(source);
            manager.schedule(null, Collections.singletonList(original));
            storage.appendNotifications(Collections.singletonList(original));
            LocalNotification restored = storage.getSavedNotification(String.valueOf(id));
            assertNotNull(restored);
            assertTrue(restored.getSchedule().isDayflowAlarmClock());
            // Same round-trip used when the boot receiver recreates a future alarm.
            manager.schedule(null, Collections.singletonList(restored));
            JSONArray actual = block(wallAt);
            assertTrue("Expected AlarmClockInfo", actual.toString().contains("Alarm clock:"));
            Matcher matcher = Pattern.compile("whenElapsed (\\d+)").matcher(actual.getString(0));
            assertTrue(matcher.find());
            long effective = Long.parseLong(matcher.group(1));
            assertTrue("Clock registration shifted", Math.abs(effective - elapsedAt) < 1000);
            result.put("storedModePreserved", true);
            result.put("requestedWallAt", wallAt); result.put("requestedElapsedAt", elapsedAt);
            result.put("effectiveElapsedAt", effective); result.put("alarmBlock", actual);
        } finally {
            Intent intent = new Intent().setClassName(context, "com.capacitorjs.plugins.localnotifications.TimedNotificationPublisher");
            PendingIntent operation = PendingIntent.getBroadcast(context, id, intent, PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_MUTABLE);
            if (operation != null) { alarms.cancel(operation); operation.cancel(); }
            Intent launch = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
            if (launch != null) {
                PendingIntent show = PendingIntent.getActivity(context, id, launch, PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE);
                if (show != null) show.cancel();
            }
            storage.deleteNotification(String.valueOf(id));
            assertEquals(0, block(wallAt).length());
            result.put("probeOnlyCleanupConfirmed", true);
            Bundle status = new Bundle(); status.putString("priority_probe_result", result.toString());
            InstrumentationRegistry.getInstrumentation().sendStatus(0, status);
        }
    }
}
