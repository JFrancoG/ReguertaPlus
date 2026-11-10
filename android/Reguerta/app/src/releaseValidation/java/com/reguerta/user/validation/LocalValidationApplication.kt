package com.reguerta.user.validation

import android.app.Application
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.storage.FirebaseStorage
import com.reguerta.user.BuildConfig
import com.reguerta.user.data.firestore.ReguertaFirestoreEnvironment
import com.reguerta.user.data.firestore.ReguertaRuntimeEnvironment

/** Initializes only the synthetic local app, before any product Firebase access. */
class LocalValidationApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        check(BuildConfig.LOCAL_VALIDATION) { "QA initializer cannot run in a production variant" }
        ReguertaRuntimeEnvironment.setBaseEnvironmentForTesting(ReguertaFirestoreEnvironment.DEVELOP)
        check(FirebaseApp.getApps(this).isEmpty()) { "Firebase initialized before the QA isolation boundary" }
        val app = FirebaseApp.initializeApp(
            this,
            FirebaseOptions.Builder()
                .setProjectId("demo-reguerta-hu090")
                .setApplicationId("1:1234567890:android:0123456789abcdef")
                .setApiKey("A00000000000000000000000000000000000000")
                .setStorageBucket("demo-reguerta-hu090.appspot.com")
                .build(),
        )
        FirebaseAuth.getInstance(app).useEmulator("10.0.2.2", 9098)
        FirebaseFirestore.getInstance(app).useEmulator("10.0.2.2", 8798)
        FirebaseStorage.getInstance(app).useEmulator("10.0.2.2", 9198)
    }
}
