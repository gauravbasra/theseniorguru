# Google ML Kit text recognition ships optional language modules (Chinese,
# Devanagari, Japanese, Korean) that this app does not depend on directly.
# R8 fails because those classes aren't on the classpath unless the
# corresponding optional dependency is added. Suppress the warnings/keep
# rules for them since we only use the Latin recognizer.
-dontwarn com.google.mlkit.vision.text.chinese.**
-dontwarn com.google.mlkit.vision.text.devanagari.**
-dontwarn com.google.mlkit.vision.text.japanese.**
-dontwarn com.google.mlkit.vision.text.korean.**
-keep class com.google.mlkit.vision.text.** { *; }

# ML Kit discovers its registrars via reflection (no-arg constructors). R8
# strips these unless explicitly kept, which crashes MlKitInitProvider at
# app startup with "Unable to get provider ... NoSuchMethodException".
-keep class * implements com.google.mlkit.common.internal.MlKitComponentRegistrar {
    public <init>();
}
-keep class com.google.mlkit.common.internal.CommonComponentRegistrar { public <init>(); }
-keep class com.google.mlkit.vision.common.internal.VisionCommonRegistrar { public <init>(); }
-keep class com.google.mlkit.** { *; }
-keep interface com.google.mlkit.** { *; }
