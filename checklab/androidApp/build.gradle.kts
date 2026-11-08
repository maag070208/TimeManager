import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.androidApplication)
    alias(libs.plugins.composeCompiler)
}

kotlin {
    compilerOptions {
        jvmTarget = JvmTarget.JVM_11
    }
}
dependencies {
    implementation(project(":shared"))

    implementation(libs.androidx.activity.compose)
    implementation(libs.koin.android)

    implementation(libs.compose.uiToolingPreview)
    debugImplementation(libs.compose.uiTooling)
}

android {
    namespace = "com.axzydev.checklab"
    compileSdk = libs.versions.android.compileSdk.get().toInt()

    defaultConfig {
        applicationId = "com.axzydev.checklab"
        minSdk = libs.versions.android.minSdk.get().toInt()
        targetSdk = libs.versions.android.targetSdk.get().toInt()
        versionCode = 1
        versionName = "1.0"
        // URL del API por build. Emulador: 10.0.2.2 es el localhost de la Mac.
        // Teléfono físico: -Pchecklab.apiUrl=http://<ip-de-la-mac>:4021/api/v1
        val apiUrl = (project.findProperty("checklab.apiUrl") as String?) ?: "http://10.0.2.2:4021/api/v1"
        buildConfigField("String", "API_URL", "\"$apiUrl\"")
    }
    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
    buildTypes {
        release {
            // Dominio de producción pendiente: sin -Pchecklab.releaseApiUrl la app avisa que no hay servidor.
            val releaseApi = (project.findProperty("checklab.releaseApiUrl") as String?) ?: ""
            buildConfigField("String", "API_URL", "\"$releaseApi\"")
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
}