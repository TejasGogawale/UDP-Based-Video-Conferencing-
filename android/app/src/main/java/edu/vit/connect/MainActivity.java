package edu.vit.connect;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import java.util.ArrayList;
import java.util.List;

/**
 * Native Android wrapper for the deployed VIT Connect web application.
 *
 * Connects directly to the live deployed site (BuildConfig.DEPLOYED_WEB_URL)
 * and bridges Android OS Camera/Microphone permissions to WebRTC inside the
 * Chromium WebView.
 */
public class MainActivity extends Activity {

    private static final int REQ_MEDIA_PERMISSIONS = 1001;
    private static final int REQ_FILE_CHOOSER = 1002;

    private WebView webView;
    private PermissionRequest pendingWebRtcRequest;
    private ValueCallback<Uri[]> filePathCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Keep the screen awake during active video calls
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        FrameLayout container = new FrameLayout(this);
        container.setBackgroundColor(Color.parseColor("#202124"));

        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#202124"));
        container.addView(webView, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ));
        setContentView(container);

        configureWebView();
        requestInitialMediaPermissionsIfNeeded();
        loadTargetUrl(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        loadTargetUrl(intent);
    }

    private void loadTargetUrl(Intent intent) {
        String targetUrl = BuildConfig.DEPLOYED_WEB_URL;
        if (intent != null && intent.getData() != null) {
            Uri uri = intent.getData();
            if ("https".equalsIgnoreCase(uri.getScheme())) {
                targetUrl = uri.toString();
            }
        }
        webView.loadUrl(targetUrl);
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setSupportZoom(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        // Identify as modern Android Chrome so WebRTC & SpeechRecognition APIs work seamlessly
        String defaultUa = settings.getUserAgentString();
        if (defaultUa != null && defaultUa.contains("; wv")) {
            settings.setUserAgentString(defaultUa.replace("; wv", ""));
        }

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme() != null ? uri.getScheme().toLowerCase() : "";
                String host = uri.getHost() != null ? uri.getHost().toLowerCase() : "";

                // Keep the deployed VIT Connect web app inside the native WebView
                if ("https".equals(scheme) && (host.endsWith(".vercel.app") || host.endsWith(".onrender.com"))) {
                    return false;
                }

                // Open external links (Google Calendar, mailto:, etc.) in the appropriate native Android app
                try {
                    Intent externalIntent = new Intent(Intent.ACTION_VIEW, uri);
                    startActivity(externalIntent);
                } catch (Exception ignored) {
                }
                return true;
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    showOfflineFallback(view);
                }
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> {
                    List<String> missingOsPermissions = getMissingMediaPermissions();
                    if (missingOsPermissions.isEmpty()) {
                        request.grant(request.getResources());
                    } else {
                        pendingWebRtcRequest = request;
                        requestPermissions(missingOsPermissions.toArray(new String[0]), REQ_MEDIA_PERMISSIONS);
                    }
                });
            }

            @Override
            public boolean onShowFileChooser(
                WebView webView,
                ValueCallback<Uri[]> filePathCallback,
                FileChooserParams fileChooserParams
            ) {
                if (MainActivity.this.filePathCallback != null) {
                    MainActivity.this.filePathCallback.onReceiveValue(null);
                }
                MainActivity.this.filePathCallback = filePathCallback;
                try {
                    Intent intent = fileChooserParams.createIntent();
                    startActivityForResult(intent, REQ_FILE_CHOOSER);
                    return true;
                } catch (Exception e) {
                    MainActivity.this.filePathCallback = null;
                    return false;
                }
            }
        });
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_MEDIA_PERMISSIONS && pendingWebRtcRequest != null) {
            try {
                pendingWebRtcRequest.grant(pendingWebRtcRequest.getResources());
            } catch (Exception ignored) {
            }
            pendingWebRtcRequest = null;
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_FILE_CHOOSER && filePathCallback != null) {
            Uri[] results = null;
            if (resultCode == RESULT_OK && data != null && data.getDataString() != null) {
                results = new Uri[]{Uri.parse(data.getDataString())};
            }
            filePathCallback.onReceiveValue(results);
            filePathCallback = null;
        }
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    private List<String> getMissingMediaPermissions() {
        String[] required = new String[]{
            Manifest.permission.CAMERA,
            Manifest.permission.RECORD_AUDIO
        };
        List<String> missing = new ArrayList<>();
        for (String perm : required) {
            if (checkSelfPermission(perm) != PackageManager.PERMISSION_GRANTED) {
                missing.add(perm);
            }
        }
        return missing;
    }

    private void requestInitialMediaPermissionsIfNeeded() {
        List<String> missing = getMissingMediaPermissions();
        if (!missing.isEmpty()) {
            requestPermissions(missing.toArray(new String[0]), REQ_MEDIA_PERMISSIONS);
        }
    }

    private void showOfflineFallback(WebView view) {
        String target = BuildConfig.DEPLOYED_WEB_URL;
        String html = "<!DOCTYPE html><html><head><meta charset='utf-8'>"
            + "<meta name='viewport' content='width=device-width,initial-scale=1'>"
            + "<style>"
            + "body{margin:0;background:#202124;color:#e8eaed;font-family:sans-serif;"
            + "display:flex;align-items:center;justify-content:center;height:100vh;text-align:center;padding:24px;box-sizing:border-box;}"
            + ".card{max-width:360px;background:#292a2d;padding:28px;border-radius:16px;border:1px solid #3c4043;}"
            + "h2{margin:0 0 10px;font-size:20px;}"
            + "p{margin:0 0 20px;color:#9aa0a6;font-size:14px;line-height:1.5;}"
            + "a{display:inline-block;background:#1a73e8;color:#fff;text-decoration:none;"
            + "padding:12px 24px;border-radius:10px;font-weight:600;font-size:14px;}"
            + "</style></head><body>"
            + "<div class='card'>"
            + "<h2>Unable to reach VIT Connect</h2>"
            + "<p>Check your internet connection and tap below to reconnect to the live server.</p>"
            + "<a href='" + target + "'>Retry Connection</a>"
            + "</div></body></html>";
        view.loadDataWithBaseURL(target, html, "text/html", "UTF-8", null);
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }
}
