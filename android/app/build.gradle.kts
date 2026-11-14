import java.util.Properties

plugins {
    id("com.android.application")
}

// Release signing is read from a private file outside the repository:
//   storeFile=/path/to/key.jks, storePassword=, keyAlias=, keyPassword=
// Keep the same key for every release, or updates will not install over old versions.
val signingFile = file(System.getenv("AUGUSTE_TENNIS_SIGNING")
    ?: "${System.getProperty("user.home")}/.config/auguste-tennis/signing.properties")
val signingProps = Properties().apply { if (signingFile.exists()) signingFile.inputStream().use { load(it) } }

android {
    namespace = "io.github.jonathanriche.augustetennis"
    compileSdk = 36
    buildToolsVersion = "35.0.0"
    defaultConfig {
        applicationId = "io.github.jonathanriche.augustetennis"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "1.0.0"
    }
    signingConfigs {
        if (signingFile.exists()) create("release") {
            storeFile = file(signingProps.getProperty("storeFile"))
            storePassword = signingProps.getProperty("storePassword")
            keyAlias = signingProps.getProperty("keyAlias")
            keyPassword = signingProps.getProperty("keyPassword")
        }
    }
    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.findByName("release") ?: signingConfigs.getByName("debug")
        }
    }
    // The release lint step crashes with the local toolchain.
    lint { checkReleaseBuilds = false }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
