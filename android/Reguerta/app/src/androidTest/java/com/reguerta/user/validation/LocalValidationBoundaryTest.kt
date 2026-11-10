package com.reguerta.user.validation

import android.content.pm.PackageManager
import android.os.Build
import android.security.NetworkSecurityPolicy
import androidx.test.platform.app.InstrumentationRegistry
import com.google.firebase.FirebaseApp
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.storage.FirebaseStorage
import com.reguerta.user.BuildConfig
import java.security.KeyStore
import java.security.MessageDigest
import java.net.URL
import javax.net.ssl.HttpsURLConnection
import javax.net.ssl.SSLHandshakeException
import javax.net.ssl.TrustManagerFactory
import javax.net.ssl.X509TrustManager
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test

class LocalValidationBoundaryTest {
    @get:Rule
    val networkPermissionRule = localValidationNetworkPermissionRule()

    @Before
    fun requireLocalValidationVariant() {
        assumeTrue("Only the synthetic local QA variant is in scope", BuildConfig.LOCAL_VALIDATION)
    }

    @Test
    fun sdkClientsAreInitializedWithOnlyTheDemoProjectAndLocalFirestore() {
        assertEquals("demo-reguerta-hu090", FirebaseApp.getInstance().options.projectId)
        val settings = FirebaseFirestore.getInstance().firestoreSettings
        assertEquals("10.0.2.2:8798", settings.host)
        assertFalse(settings.isSslEnabled)
        assertEquals("demo-reguerta-hu090.appspot.com", FirebaseStorage.getInstance().reference.bucket)
    }

    @Test
    fun cleartextAllowsTheEmulatorHostAndRejectsOtherNonLoopbackHosts() {
        val policy = NetworkSecurityPolicy.getInstance()
        assertTrue(policy.isCleartextTrafficPermitted("10.0.2.2"))
        assertFalse(policy.isCleartextTrafficPermitted("example.com"))
        assertFalse(policy.isCleartextTrafficPermitted("10.0.2.3"))
        // Android 17 adds an implicit localhost policy; loopback cannot reach the host/cloud.
        // https://developer.android.com/privacy-and-security/security-config#localhost
        assertEquals(Build.VERSION.SDK_INT >= 37, policy.isCleartextTrafficPermitted("127.0.0.1"))
    }

    @Test
    fun platformTlsTrustContainsOnlyTheSyntheticQaAnchor() {
        val factory = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm())
        factory.init(null as KeyStore?)
        val trust = factory.trustManagers.filterIsInstance<X509TrustManager>().single()
        val issuers = trust.acceptedIssuers
        assertEquals(1, issuers.size)
        val digest = MessageDigest.getInstance("SHA-256").digest(issuers.single().encoded)
            .joinToString("") { (it.toInt() and 0xff).toString(16).padStart(2, '0') }
        assertEquals("08bfacb16eede8b06d55df655bc99915b78aee5bc1b86628af556d6dc89ae26b", digest)
    }

    @Test
    fun untrustedLocalTlsServerIsRejectedBeforeHttp() {
        val connection = URL("https://10.0.2.2:5998/hu090-negative-tls").openConnection() as HttpsURLConnection
        connection.connectTimeout = 5_000
        connection.readTimeout = 5_000
        try {
            val failure = runCatching { connection.connect() }.exceptionOrNull()
            assertTrue("Expected certificate rejection, received $failure", failure is SSLHandshakeException)
        } finally {
            connection.disconnect()
        }
    }

    @Test
    fun eagerFirebaseProviderAndTelemetryRegistrarsAreAbsent() {
        if (Build.VERSION.SDK_INT < 33) {
            assumeTrue("Package metadata inspection uses the modern API on Android 13+", false)
            return
        }
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val flags = PackageManager.GET_PROVIDERS or PackageManager.GET_SERVICES or PackageManager.GET_META_DATA
        val info = context.packageManager.getPackageInfo(
            context.packageName,
            PackageManager.PackageInfoFlags.of(flags.toLong()),
        )
        assertFalse(info.providers.orEmpty().any { it.name == "com.google.firebase.provider.FirebaseInitProvider" })
        assertFalse(info.providers.orEmpty().any { it.name == "com.google.mlkit.common.internal.MlKitInitProvider" })
        assertFalse(info.services.orEmpty().any {
            it.name == "com.google.mlkit.common.internal.MlKitComponentDiscoveryService"
        })
        val discovery = info.services.orEmpty()
            .single { it.name == "com.google.firebase.components.ComponentDiscoveryService" }
        val registrars = discovery.metaData.keySet().filter { it.startsWith("com.google.firebase.components:") }
        val forbidden = listOf("AnalyticsConnectorRegistrar", "CrashlyticsRegistrar", "FirebaseMessagingRegistrar",
            "FirebaseInstallationsRegistrar", "FirebaseSessionsRegistrar", "TransportRegistrar")
        assertTrue(registrars.none { registrar -> forbidden.any { registrar.endsWith(it) } })
    }
}
