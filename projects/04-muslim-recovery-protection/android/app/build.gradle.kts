plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "com.muslimrecovery.protection"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.muslimrecovery.protection"
        minSdk = 24
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    flavorDimensions += "distribution"
    productFlavors {
        // PLAY: the only flavor that may ever be uploaded anywhere. Until W0b isolation is complete
        // it still contains the historical experimental code, so it is explicitly NON-RELEASABLE
        // engineering evidence (M3-01 Amendment W0a). The suffix is removed by W0b.
        create("play") {
            dimension = "distribution"
            versionNameSuffix = "-nonreleasable-w0a"
        }
        // INTERNAL: may contain separately approved experimental capabilities. The base
        // applicationId is unchanged (D-4); only a suffix lets both flavors coexist on a device.
        create("internal") {
            dimension = "distribution"
            applicationIdSuffix = ".internal"
            versionNameSuffix = "-internal"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
    }
}

// There is no releasable internal build: only debug-type internal variants exist (M3-01 §4).
androidComponents {
    beforeVariants { variantBuilder ->
        if (variantBuilder.buildType == "release" &&
            variantBuilder.productFlavors.contains("distribution" to "internal")
        ) {
            variantBuilder.enable = false
        }
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation(platform("androidx.compose:compose-bom:2025.06.01"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    // M3-01 W0a: D0 (non-sensitive) SettingsStore only. Room/Biometric wait for their contracts.
    implementation("androidx.datastore:datastore-preferences:1.1.1")

    testImplementation("junit:junit:4.13.2")

    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.6.1")
    androidTestImplementation(platform("androidx.compose:compose-bom:2025.06.01"))
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")

    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
}
