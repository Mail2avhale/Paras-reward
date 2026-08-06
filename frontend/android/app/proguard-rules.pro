# ═══════════════════════════════════════════════════════════════════════
# PARAS REWARD — ProGuard / R8 rules (release AAB)
# ─────────────────────────────────────────────────────────────────────────
# R8 pipeline enabled in gradle.properties (`android.enableR8.fullMode=true`)
# + app/build.gradle (`minifyEnabled true` + `shrinkResources true`).
# This file lists every keep-rule needed to prevent runtime crashes after
# whole-program optimization + obfuscation + shrinking.
#
# Play Console guidance (Feb 2026) recommends keeping rules for
# Firebase / Google Play Services / other libraries to avoid runtime
# issues — every SDK we pull is listed below with its keep-rules.
# ═══════════════════════════════════════════════════════════════════════

# ─────────────────────────────────────────────────────────────────────────
# CAPACITOR + WEBVIEW — keep all classes that are reflected / JS-bridged.
# Without these, release APK crashes with NoSuchMethodError on app start.
# ─────────────────────────────────────────────────────────────────────────
-keep class com.getcapacitor.** { *; }
-keep interface com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keep class com.parasreward.prc.** { *; }

# Cordova plugin compatibility shim
-keep class org.apache.cordova.** { *; }
-keep class org.apache.cordova.engine.** { *; }

# WebView JavascriptInterface — methods exposed to JS must not be obfuscated
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# ─────────────────────────────────────────────────────────────────────────
# ANDROIDX + MATERIAL + KOTLIN
# ─────────────────────────────────────────────────────────────────────────
-keep class androidx.** { *; }
-keep interface androidx.** { *; }
-dontwarn androidx.**

# Kotlin metadata (some Capacitor plugins are Kotlin)
-keep class kotlin.Metadata { *; }
-keepclassmembers class **$Companion { *; }
-dontwarn kotlin.**
-dontwarn kotlinx.**

# Kotlin coroutines
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}
-keepclassmembers class kotlinx.coroutines.** { volatile <fields>; }

# ─────────────────────────────────────────────────────────────────────────
# JNI / NATIVE / FRAMEWORK REFLECTION
# ─────────────────────────────────────────────────────────────────────────
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

# Serializable — java.io fallback path used by some Capacitor plugins
-keepnames class * implements java.io.Serializable
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    !static !transient <fields>;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}

# ─────────────────────────────────────────────────────────────────────────
# JSON / REFLECTION LIBS — OkHttp, Retrofit, Gson, Moshi
# ─────────────────────────────────────────────────────────────────────────
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn retrofit2.**
-keep,allowobfuscation,allowshrinking interface retrofit2.Call
-keep,allowobfuscation,allowshrinking class retrofit2.Response

# Gson — model fields annotated with @SerializedName must not be renamed
-keepattributes *Annotation*, Signature, Exceptions, InnerClasses, EnclosingMethod
-keep class com.google.gson.** { *; }
-keep,allowobfuscation @interface com.google.gson.annotations.SerializedName
-keepclassmembers class * {
    @com.google.gson.annotations.SerializedName <fields>;
}
-dontwarn com.google.gson.**

# javax.annotation — commonly referenced by generated Retrofit/OkHttp code
-dontwarn javax.annotation.**
-dontwarn javax.lang.model.element.Modifier
-dontwarn org.codehaus.mojo.animal_sniffer.**

# ─────────────────────────────────────────────────────────────────────────
# FIREBASE (@capacitor-firebase/app + any push / analytics module)
# ─────────────────────────────────────────────────────────────────────────
-keep class com.google.firebase.** { *; }
-keep interface com.google.firebase.** { *; }
-keep class com.google.firebase.provider.FirebaseInitProvider
-keep class com.google.firebase.iid.** { *; }
-keep class com.google.firebase.messaging.** { *; }
-keep class com.google.firebase.analytics.** { *; }
-keep class com.google.firebase.crashlytics.** { *; }
-keep class com.google.firebase.installations.** { *; }
-dontwarn com.google.firebase.**

# Firebase requires GoogleUserAgent, GoogleApiClient, task machinery — keep
# all Google Play Services base infrastructure.
-keep class com.google.android.gms.common.** { *; }
-keep class com.google.android.gms.tasks.** { *; }
-keep class com.google.android.gms.auth.** { *; }
-dontwarn com.google.android.gms.**

# Firebase config JSON is read via reflection at boot
-keep class com.google.android.gms.internal.firebase-auth-api.** { *; }
-dontwarn com.google.android.gms.internal.**

# ─────────────────────────────────────────────────────────────────────────
# GOOGLE ADMOB — Mobile Ads SDK (play-services-ads 24.7.0)
# ─────────────────────────────────────────────────────────────────────────
-keep class com.google.android.gms.ads.** { *; }
-keep class com.google.android.gms.internal.ads.** { *; }
-keep interface com.google.android.gms.ads.** { *; }
-keep class com.getcapacitor.community.admob.** { *; }
-dontwarn com.getcapacitor.community.admob.**

# ─────────────────────────────────────────────────────────────────────────
# PLAY CORE / PLAY INSTALL REFERRER / PLAY IN-APP REVIEW
# ─────────────────────────────────────────────────────────────────────────
-keep class com.google.android.play.core.** { *; }
-dontwarn com.google.android.play.core.**

# Install Referrer API — reads Play Store referrer at first launch.
# Reflection paths must survive obfuscation.
-keep class com.android.installreferrer.** { *; }
-keep interface com.android.installreferrer.** { *; }
-dontwarn com.android.installreferrer.**

# In-App Review (@capacitor-community/in-app-review)
-keep class com.google.android.play.core.review.** { *; }

# ─────────────────────────────────────────────────────────────────────────
# BIOMETRIC AUTH (@aparajita/capacitor-biometric-auth)
# ─────────────────────────────────────────────────────────────────────────
-keep class androidx.biometric.** { *; }
-dontwarn androidx.biometric.**

# ─────────────────────────────────────────────────────────────────────────
# CAPACITOR PLUGINS (@capawesome/*, @capacitor/*)
# All @CapacitorPlugin-annotated classes are already caught by the
# `@com.getcapacitor.annotation.CapacitorPlugin` rule at the top.
# Some plugins also register listeners via reflection — cover the wildcard.
# ─────────────────────────────────────────────────────────────────────────
-keep class io.capawesome.** { *; }
-keep class ee.forgr.** { *; }
-keep class app.aparajita.** { *; }
-dontwarn io.capawesome.**
-dontwarn ee.forgr.**
-dontwarn app.aparajita.**

# ─────────────────────────────────────────────────────────────────────────
# CRASH REPORT SYMBOLICATION (Play Console)
# ─────────────────────────────────────────────────────────────────────────
# Keep stack traces readable in Play Console crash reports. Combined with
# `debugSymbolLevel 'SYMBOL_TABLE'` in build.gradle this gives clean
# stack traces without leaking full source paths.
-keepattributes SourceFile, LineNumberTable
-renamesourcefileattribute SourceFile
