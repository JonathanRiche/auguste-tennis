package io.github.jonathanriche.augustetennis;

import android.app.Activity;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageInstaller;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Locale;

/**
 * In-app updates from GitHub releases: looks up the latest release, and if it
 * is newer than the installed version, downloads its APK and hands it to the
 * system installer, which asks the user to confirm.
 */
final class Updater {
    private static final String REPO = "JonathanRiche/auguste-tennis";

    interface Status {
        void show(String message);
    }

    private final Activity activity;
    private final Status status;
    private final String action;
    private volatile boolean busy;

    private final BroadcastReceiver receiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            int code = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
            if (code == PackageInstaller.STATUS_PENDING_USER_ACTION) {
                Intent confirm = intent.getParcelableExtra(Intent.EXTRA_INTENT);
                if (confirm != null) {
                    confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    activity.startActivity(confirm);
                }
                say("Tap Update or Install to finish.");
            } else if (code == PackageInstaller.STATUS_SUCCESS) {
                say("Updated!");
            } else {
                String why = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE);
                say(code == PackageInstaller.STATUS_FAILURE_ABORTED ? "Update cancelled" : "Install failed" + (why == null ? "" : ": " + why));
            }
        }
    };

    Updater(Activity activity, Status status) {
        this.activity = activity;
        this.status = status;
        this.action = activity.getPackageName() + ".INSTALL_STATUS";
        IntentFilter filter = new IntentFilter(action);
        if (Build.VERSION.SDK_INT >= 33) {
            activity.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            activity.registerReceiver(receiver, filter);
        }
    }

    void close() {
        activity.unregisterReceiver(receiver);
    }

    String currentVersion() {
        try {
            return activity.getPackageManager().getPackageInfo(activity.getPackageName(), 0).versionName;
        } catch (Exception e) {
            return "0";
        }
    }

    void start() {
        if (busy) return;
        busy = true;
        new Thread(() -> {
            try {
                run();
            } catch (Exception e) {
                say("Update failed: " + (e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage()));
            } finally {
                busy = false;
            }
        }, "updater").start();
    }

    private void say(String message) {
        activity.runOnUiThread(() -> status.show(message));
    }

    private void run() throws Exception {
        say("Checking for a new version...");
        String current = currentVersion();
        JSONObject release = new JSONObject(new String(
                readAll(open("https://api.github.com/repos/" + REPO + "/releases/latest")), "UTF-8"));
        String latest = release.getString("tag_name").replaceFirst("^v", "");
        if (compare(latest, current) <= 0) {
            say("You have the newest version (" + current + ").");
            return;
        }
        String url = null;
        JSONArray assets = release.getJSONArray("assets");
        for (int i = 0; i < assets.length(); i++) {
            JSONObject a = assets.getJSONObject(i);
            if (a.getString("name").endsWith(".apk")) url = a.getString("browser_download_url");
        }
        if (url == null) throw new Exception("no APK in release " + latest);

        // Android asks once whether this app may install updates. Send the
        // grown-up to that switch rather than downloading for nothing.
        if (!activity.getPackageManager().canRequestPackageInstalls()) {
            say("Version " + latest + " is ready. Allow Auguste Tennis to install apps, come back and check again.");
            activity.runOnUiThread(() -> activity.startActivity(new Intent(
                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + activity.getPackageName()))));
            return;
        }

        PackageInstaller installer = activity.getPackageManager().getPackageInstaller();
        PackageInstaller.SessionParams params =
                new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
        params.setAppPackageName(activity.getPackageName());
        if (Build.VERSION.SDK_INT >= 31) {
            params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED);
        }
        int id = installer.createSession(params);
        try (PackageInstaller.Session session = installer.openSession(id)) {
            HttpURLConnection c = open(url);
            long total = c.getContentLengthLong();
            try (InputStream in = c.getInputStream();
                 OutputStream out = session.openWrite("app.apk", 0, total > 0 ? total : -1)) {
                byte[] buf = new byte[65536];
                long done = 0;
                int n, shown = -1;
                while ((n = in.read(buf)) > 0) {
                    out.write(buf, 0, n);
                    done += n;
                    int pct = total > 0 ? (int) (done * 100 / total) : 0;
                    if (pct != shown) {
                        shown = pct;
                        say(String.format(Locale.US, "Downloading %s... %d%%", latest, pct));
                    }
                }
                session.fsync(out);
            }
            Intent result = new Intent(action).setPackage(activity.getPackageName());
            int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
            session.commit(PendingIntent.getBroadcast(activity, id, result, flags).getIntentSender());
            say("Installing " + latest + "...");
        } catch (Exception e) {
            installer.abandonSession(id);
            throw e;
        }
    }

    private static HttpURLConnection open(String url) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(15000);
        c.setReadTimeout(30000);
        c.setRequestProperty("User-Agent", "auguste-tennis-updater");
        c.setRequestProperty("Accept", "application/vnd.github+json, application/octet-stream");
        int code = c.getResponseCode();
        if (code != 200) throw new Exception("server said " + code);
        return c;
    }

    private static byte[] readAll(HttpURLConnection c) throws Exception {
        try (InputStream in = c.getInputStream()) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            return out.toByteArray();
        }
    }

    /** Compares dotted version numbers such as 1.10.0 and 1.9.2. */
    static int compare(String a, String b) {
        String[] x = a.split("[.-]"), y = b.split("[.-]");
        for (int i = 0; i < Math.max(x.length, y.length); i++) {
            int p = i < x.length ? num(x[i]) : 0, q = i < y.length ? num(y[i]) : 0;
            if (p != q) return Integer.compare(p, q);
        }
        return 0;
    }

    private static int num(String s) {
        try {
            return Integer.parseInt(s);
        } catch (NumberFormatException e) {
            return 0;
        }
    }
}
