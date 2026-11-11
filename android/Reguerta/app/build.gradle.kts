import com.android.build.api.artifact.SingleArtifact
import com.google.firebase.crashlytics.buildtools.gradle.CrashlyticsExtension
import com.google.gms.googleservices.GoogleServicesTask
import java.util.Properties
import org.gradle.api.DefaultTask
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.tasks.OutputFile
import org.gradle.api.tasks.TaskAction

val releaseSigningPropertiesFile = rootProject.file("keystore.properties")
val releaseSigningProperties = Properties().apply {
    if (releaseSigningPropertiesFile.isFile) {
        releaseSigningPropertiesFile.inputStream().use { load(it) }
    }
}
val releaseStorePath = releaseSigningProperties.getProperty("storeFile")?.takeIf { it.isNotEmpty() }
val releaseStorePassword = releaseSigningProperties.getProperty("storePassword")?.takeIf { it.isNotEmpty() }
val releaseKeyAlias = releaseSigningProperties.getProperty("keyAlias")?.takeIf { it.isNotEmpty() }
val releaseKeyPassword = releaseSigningProperties.getProperty("keyPassword")?.takeIf { it.isNotEmpty() }
val missingReleaseSigningProperties = mapOf(
    "storeFile" to releaseStorePath,
    "storePassword" to releaseStorePassword,
    "keyAlias" to releaseKeyAlias,
    "keyPassword" to releaseKeyPassword,
).filterValues { it == null }.keys
val releaseStoreFile = releaseStorePath?.let { file(it) }

if (releaseSigningPropertiesFile.isFile) {
    require(missingReleaseSigningProperties.isEmpty()) {
        "Missing release signing properties: ${missingReleaseSigningProperties.joinToString()}"
    }
    require(releaseStoreFile?.isFile == true) {
        "Release keystore not found at ${releaseStoreFile?.path}"
    }
}

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.google.services)
    alias(libs.plugins.firebase.crashlytics)
}

abstract class GenerateLocalDebugManifest : DefaultTask() {
    @get:OutputFile
    abstract val outputManifest: RegularFileProperty

    @TaskAction
    fun generate() {
        val output = outputManifest.get().asFile
        output.parentFile.mkdirs()
        output.writeText(
            """
            <manifest xmlns:android="http://schemas.android.com/apk/res/android"
                xmlns:tools="http://schemas.android.com/tools">
                <application>
                    <provider android:name="com.google.mlkit.common.internal.MlKitInitProvider"
                        tools:node="remove" />
                    <service android:name="com.google.mlkit.common.internal.MlKitComponentDiscoveryService"
                        tools:node="remove" />
                </application>
            </manifest>
            """.trimIndent(),
        )
    }
}

// Local comparisons vary only optimization; publishing and upload tasks are not part of this lane.
val hu090Optimization = providers.gradleProperty("hu090Optimization").map(String::toBooleanStrict).orElse(true)
val hu090LocalDebug = providers.gradleProperty("hu090LocalDebug").map(String::toBooleanStrict).orElse(false)
// ML Kit belongs to Debug only; its removal markers must not enter the PDF-only QA graph.
val generateLocalDebugManifest = if (hu090LocalDebug.get()) {
    tasks.register<GenerateLocalDebugManifest>("generateLocalDebugManifest")
} else {
    null
}
val validationGoogleServices = layout.buildDirectory.file("generated/hu090/google-services.json")
val generateValidationGoogleServices = tasks.register("generateLocalValidationGoogleServices") {
    outputs.file(validationGoogleServices)
    doLast {
        val output = validationGoogleServices.get().asFile
        output.parentFile.mkdirs()
        output.writeText(
            """
            {
              "project_info": {
                "project_number": "1234567890",
                "project_id": "demo-reguerta-hu090",
                "storage_bucket": "demo-reguerta-hu090.appspot.com"
              },
              "client": [{
                "client_info": {
                  "mobilesdk_app_id": "1:1234567890:android:0123456789abcdef",
                  "android_client_info": {"package_name": "com.reguerta.user.validation"}
                },
                "api_key": [{"current_key": "A00000000000000000000000000000000000000"}]
              }, {
                "client_info": {
                  "mobilesdk_app_id": "1:1234567890:android:0123456789abcdef",
                  "android_client_info": {"package_name": "com.reguerta.user.debug"}
                },
                "api_key": [{"current_key": "A00000000000000000000000000000000000000"}]
              }],
              "configuration_version": "1"
            }
            """.trimIndent(),
        )
    }
}

androidComponents.onVariants { variant ->
    val capitalizedName = variant.name.replaceFirstChar { it.uppercaseChar() }
    if (variant.buildType == "release") {
        val mergedManifest = variant.artifacts.get(SingleArtifact.MERGED_MANIFEST)
        val privacyScript = rootProject.file("scripts/verify-release-privacy.py")
        val privacyCheck = tasks.register<Exec>("verify${capitalizedName}Privacy") {
            group = "verification"
            description = "Reject advertising permissions/defaults in the final Release manifest"
            inputs.file(mergedManifest)
            inputs.file(privacyScript)
            doFirst {
                commandLine("python3", privacyScript, "--merged-manifest", mergedManifest.get().asFile)
            }
        }
        tasks.configureEach {
            if (name == "assemble$capitalizedName" || name == "bundle$capitalizedName") {
                dependsOn(privacyCheck)
            }
        }
    }
    if (variant.buildType != "releaseValidation" && !(variant.buildType == "debug" && hu090LocalDebug.get())) {
        return@onVariants
    }
    if (variant.buildType == "debug") {
        variant.sources.manifests.addGeneratedManifestFile(
            checkNotNull(generateLocalDebugManifest),
            GenerateLocalDebugManifest::outputManifest,
        )
    }
    tasks.named<GoogleServicesTask>("process${capitalizedName}GoogleServices").configure {
        dependsOn(generateValidationGoogleServices)
        googleServicesJsonFiles.set(validationGoogleServices.map { listOf(it.asFile) })
        doFirst {
            check(googleServicesJsonFiles.get() == listOf(validationGoogleServices.get().asFile)) {
                "Local validation must use only the generated demo Firebase configuration"
            }
        }
    }
}

private object MyConfig {
    const val GROUP_ID = "com.reguerta"
    const val APPLICATION_ID = "$GROUP_ID.user"
    const val VERSION_NAME = "0.3.0.1"
    const val VERSION_CODE = 37
    const val COMPILE_SDK_VERSION = 37
    const val TARGET_SDK_VERSION = 37
    const val MIN_SDK_VERSION = 29
}

android {
    namespace = MyConfig.APPLICATION_ID
    compileSdk {
        version = release(MyConfig.COMPILE_SDK_VERSION)
    }

    defaultConfig {
        applicationId = MyConfig.APPLICATION_ID
        minSdk {
            version = release(MyConfig.MIN_SDK_VERSION)
        }
        targetSdk {
            version = release(MyConfig.TARGET_SDK_VERSION)
        }
        versionCode = MyConfig.VERSION_CODE
        versionName = MyConfig.VERSION_NAME

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        buildConfigField("boolean", "LOCAL_VALIDATION", "false")
        buildConfigField("String", "FIREBASE_FUNCTIONS_BASE_URL", "\"\"")
    }

    signingConfigs {
        create("release") {
            if (releaseSigningPropertiesFile.isFile) {
                storeFile = checkNotNull(releaseStoreFile)
                storePassword = checkNotNull(releaseStorePassword)
                keyAlias = checkNotNull(releaseKeyAlias)
                keyPassword = checkNotNull(releaseKeyPassword)
            }
        }
    }

    buildTypes {
        getByName("debug") {
            applicationIdSuffix = ".debug"
            if (hu090LocalDebug.get()) {
                buildConfigField("boolean", "LOCAL_VALIDATION", "true")
                buildConfigField(
                    "String",
                    "FIREBASE_FUNCTIONS_BASE_URL",
                    "\"http://10.0.2.2:5009/demo-reguerta-hu090/europe-west1\"",
                )
            }
        }
        release {
            optimization {
                enable = true
            }
            configure<CrashlyticsExtension> {
                mappingFileUploadEnabled = false
            }
            signingConfig = signingConfigs.getByName("release")
        }
        create("releaseValidation") {
            initWith(getByName("release"))
            optimization {
                enable = hu090Optimization.get()
            }
            applicationIdSuffix = ".validation"
            isDebuggable = false
            signingConfig = signingConfigs.getByName("debug")
            matchingFallbacks += listOf("release")
            buildConfigField("boolean", "LOCAL_VALIDATION", "true")
            buildConfigField(
                "String",
                "FIREBASE_FUNCTIONS_BASE_URL",
                "\"http://10.0.2.2:5009/demo-reguerta-hu090/europe-west1\"",
            )
            configure<CrashlyticsExtension> {
                mappingFileUploadEnabled = false
            }
        }
    }
    sourceSets.getByName("releaseValidation").kotlin.directories.add("src/release/java")
    if (hu090LocalDebug.get()) {
        check(!file("src/debug/AndroidManifest.xml").exists()) { "Review the Debug manifest before local override" }
        sourceSets.getByName("debug").apply {
            kotlin.directories.add("src/releaseValidation/java")
            res.directories.add("src/releaseValidation/res")
            manifest.srcFile("src/releaseValidation/AndroidManifest.xml")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
    lint {
        warningsAsErrors = true
        abortOnError = true
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.material.icons.extended)
    implementation(libs.androidx.navigation3.runtime)
    implementation(libs.androidx.navigation3.ui)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.kotlinx.coroutines.play.services)
    implementation(libs.androidx.datastore.preferences)
    implementation(libs.coil.compose)
    implementation(libs.coil.network.okhttp)
    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.analytics)
    implementation(libs.firebase.auth)
    implementation(libs.firebase.firestore)
    implementation(libs.firebase.storage)
    implementation(libs.firebase.messaging)
    implementation(libs.firebase.installations)
    implementation(libs.firebase.crashlytics)
    implementation(libs.tink.android)
    debugImplementation(libs.mlkit.genai.prompt)
    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.test)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.test.rules)
    androidTestImplementation(libs.androidx.espresso.core)
    // Instrumented tests have a separate graph; resolving the provider also avoids a false duplicate warning.
    androidTestImplementation(platform(libs.androidx.compose.bom.get()))
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
    debugImplementation(libs.androidx.compose.ui.tooling)
    debugImplementation(libs.androidx.compose.ui.test.manifest)
}
