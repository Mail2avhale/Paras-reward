# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.

# ─────────────────────────────────────────────────────────────────────────
# CAPACITOR + WEBVIEW — keep all classes that are reflected/JS-bridged.
# Without these, release APK crashes with NoSuchMethodError on app start.
# ─────────────────────────────────────────────────────────────────────────
-keep class com.getcapacitor.** { *; }
-keep interface com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keep class com.parasreward.app.** { *; }

# Cordova plugin compatibility shim
-keep class org.apache.cordova.** { *; }
-keep class org.apache.cordova.engine.** { *; }

# WebView JavascriptInterface — methods exposed to JS must not be obfuscated
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# AndroidX & Material
-keep class androidx.** { *; }
-keep interface androidx.** { *; }
-dontwarn androidx.**

# Kotlin metadata (some Capacitor plugins are Kotlin)
-keep class kotlin.Metadata { *; }
-keepclassmembers class **$Companion { *; }

# Preserve native methods (JNI bridges)
-keepclasseswithmembernames class * {
    native <methods>;
}

# Activity lifecycle methods invoked by framework via reflection
-keepclassmembers class * extends android.app.Activity {
   public void *(android.view.View);
}

# Enums — Android framework needs valueOf/values()
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# Parcelable — required for Bundle/Intent serialization
-keepclassmembers class * implements android.os.Parcelable {
    public static final ** CREATOR;
}

# OkHttp / Retrofit / Gson (used by some Capacitor plugins) — safe defaults
-dontwarn okhttp3.**
-dontwarn okio.**
-keepattributes *Annotation*, Signature, Exceptions, InnerClasses

# Play Core (used for in-app updates on SDK 21+)
-keep class com.google.android.play.core.** { *; }
-dontwarn com.google.android.play.core.**

# Google AdMob — keep all reflection-accessed Mobile Ads classes
-keep class com.google.android.gms.ads.** { *; }
-keep class com.google.android.gms.common.** { *; }
-keep class com.google.android.gms.internal.ads.** { *; }
-dontwarn com.google.android.gms.**
-keep class com.getcapacitor.community.admob.** { *; }
-dontwarn com.getcapacitor.community.admob.**



# Keep stack traces readable in Play Console crash reports
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
