package com.dayflow.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.os.ParcelFileDescriptor;
import android.os.Process;
import android.os.SystemClock;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.ByteArrayOutputStream;
import java.io.FileInputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

/** Read-only diagnosis of the platform's registration times. No app database access. */
@RunWith(AndroidJUnit4.class)
public class AlarmSchedulingProbeTest {
    private static final String PREFIX = "com.dayflow.app.ALARM_PROBE_";

    private String alarmDump() throws Exception {
        ParcelFileDescriptor descriptor = InstrumentationRegistry.getInstrumentation()
            .getUiAutomation().executeShellCommand("dumpsys alarm");
        try (FileInputStream input = new ParcelFileDescriptor.AutoCloseInputStream(descriptor);
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] bytes = new byte[8192];
            int read;
            while ((read = input.read(bytes)) != -1) output.write(bytes, 0, read);
            return output.toString(StandardCharsets.UTF_8.name());
        }
    }

    private JSONArray ownBlock(String dump, String marker) {
        String[] lines = dump.split("\\n");
        JSONArray result = new JSONArray();
        for (int i = 1; i < lines.length; i++) {
            if (lines[i].contains(marker) && lines[i - 1].contains("Alarm{")) {
                for (int j = i - 1; j < Math.min(lines.length, i + 6); j++) {
                    if (j > i && lines[j].contains("Alarm{")) break;
                    result.put(lines[j].trim());
                }
                break;
            }
        }
        return result;
    }

    @Test public void compareNativeRegistrationTimesWithoutTouchingUserReminders() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertEquals("com.dayflow.app", context.getPackageName());
        AlarmManager manager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        assertTrue(Build.VERSION.SDK_INT < 31 || manager.canScheduleExactAlarms());
        List<PendingIntent> probes = new ArrayList<>();
        JSONObject result = new JSONObject();
        JSONArray records = new JSONArray();
        result.put("uid", Process.myUid());
        result.put("package", context.getPackageName());
        result.put("wallBefore", System.currentTimeMillis());
        result.put("elapsedBefore", SystemClock.elapsedRealtime());
        long offset = 11 * 60 * 1000L + 37000L;
        long wallAt = System.currentTimeMillis() + offset;
        long elapsedAt = SystemClock.elapsedRealtime() + offset;
        String[] variants = {"EXACT_RTC", "EXACT_IDLE_RTC", "EXACT_IDLE_ELAPSED", "ALARM_CLOCK"};
        try {
            for (int i = 0; i < variants.length; i++) {
                String action = PREFIX + variants[i];
                Intent intent = new Intent(action).setClassName(context,
                    "com.capacitorjs.plugins.localnotifications.TimedNotificationPublisher");
                PendingIntent operation = PendingIntent.getBroadcast(context, 1900000001 + i,
                    intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
                probes.add(operation);
                if (i == 0) manager.setExact(AlarmManager.RTC_WAKEUP, wallAt, operation);
                if (i == 1) manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, wallAt, operation);
                if (i == 2) manager.setExactAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, elapsedAt, operation);
                if (i == 3) manager.setAlarmClock(new AlarmManager.AlarmClockInfo(wallAt, null), operation);
                JSONObject record = new JSONObject();
                record.put("variant", variants[i]);
                record.put("requestedWallAt", wallAt);
                record.put("requestedElapsedAt", elapsedAt);
                record.put("alarmBlock", ownBlock(alarmDump(), action));
                assertTrue("Native alarm missing: " + variants[i], record.getJSONArray("alarmBlock").length() > 0);
                records.put(record);
            }
            result.put("registrations", records);
        } finally {
            // Cancel only operations bearing our unique diagnostic action and request codes.
            // Never cancel a production notification or clear any application data.
            for (PendingIntent operation : probes) {
                manager.cancel(operation);
                operation.cancel();
            }
            String remaining = alarmDump();
            for (String variant : variants) {
                assertEquals("Probe alarm left registered", 0, ownBlock(remaining, PREFIX + variant).length());
            }
            result.put("probeAlarmsRemoved", true);
            Bundle status = new Bundle();
            status.putString("alarm_probe_result", result.toString());
            InstrumentationRegistry.getInstrumentation().sendStatus(0, status);
        }
    }
}
