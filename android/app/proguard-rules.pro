# Keep WebView JS interfaces and BuildConfig if any
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
