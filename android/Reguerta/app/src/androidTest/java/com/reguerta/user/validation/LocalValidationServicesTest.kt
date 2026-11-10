package com.reguerta.user.validation

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.net.Uri
import android.util.Base64
import androidx.test.platform.app.InstrumentationRegistry
import com.google.android.gms.tasks.Tasks
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Source
import com.google.firebase.storage.FirebaseStorage
import com.google.firebase.storage.StorageMetadata
import com.google.firebase.storage.StorageReference
import com.reguerta.user.BuildConfig
import com.reguerta.user.data.access.FirebaseAuthSessionProvider
import com.reguerta.user.data.firestore.ReguertaFirestoreEnvironment
import com.reguerta.user.data.media.FirebaseImagePipelineManager
import com.reguerta.user.data.media.ImageUploadNamespace
import com.reguerta.user.data.orders.FirestoreOrdersRepository
import com.reguerta.user.data.products.FirestoreProductRepository
import com.reguerta.user.domain.access.AuthSessionRefreshResult
import com.reguerta.user.domain.access.AuthSignInResult
import com.reguerta.user.domain.orders.ReceivedOrderProducerStatus
import com.reguerta.user.domain.orders.ReceivedOrderStatusWriteResult
import com.reguerta.user.domain.products.ProductPricingMode
import com.reguerta.user.domain.products.ProductStockMode
import java.io.File
import java.util.UUID
import java.util.concurrent.TimeUnit
import kotlin.math.abs
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test

/** Real SDK/production-adapter smoke tests against synthetic local services only. */
class LocalValidationServicesTest {
    @get:Rule
    val networkPermissionRule = localValidationNetworkPermissionRule()

    private lateinit var context: Context
    private lateinit var auth: FirebaseAuth
    private lateinit var firestore: FirebaseFirestore
    private lateinit var storage: FirebaseStorage

    @Before
    fun requireLocalBoundaryAndVerifiedFixtureSession() = runBlocking {
        assumeTrue("Requires the explicitly isolated QA variant", BuildConfig.LOCAL_VALIDATION)
        assertEquals("demo-reguerta-hu090", FirebaseApp.getInstance().options.projectId)
        assertEquals(
            "http://10.0.2.2:5009/demo-reguerta-hu090/europe-west1",
            BuildConfig.FIREBASE_FUNCTIONS_BASE_URL,
        )
        context = InstrumentationRegistry.getInstrumentation().targetContext
        firestore = FirebaseFirestore.getInstance()
        assertEquals("10.0.2.2:8798", firestore.firestoreSettings.host)
        assertFalse(firestore.firestoreSettings.isSslEnabled)
        storage = FirebaseStorage.getInstance()
        assertEquals("demo-reguerta-hu090.appspot.com", storage.reference.bucket)
        auth = FirebaseAuth.getInstance()

        val result = FirebaseAuthSessionProvider(auth).signIn("qa.member@example.invalid", "Qa-Local-090!")
        assertTrue("The seeded, verified fixture must sign in", result is AuthSignInResult.Success)
        val principal = (result as AuthSignInResult.Success).principal
        assertEquals("qa.member@example.invalid", principal.email)
        assertTrue(principal.uid.isNotBlank())
        assertTrue(checkNotNull(auth.currentUser).isEmailVerified)

        // Verify the Auth emulator identity before any test can write synthetic data.
        val token = checkNotNull(Tasks.await(checkNotNull(auth.currentUser).getIdToken(false), 10, TimeUnit.SECONDS).token)
        val parts = token.split('.')
        assertEquals(3, parts.size)
        assertEquals("", parts[2])
        fun claimObject(part: String) = Json.parseToJsonElement(
            String(Base64.decode(part, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING), Charsets.UTF_8),
        ).jsonObject
        assertEquals("none", claimObject(parts[0])["alg"]?.jsonPrimitive?.contentOrNull)
        val claims = claimObject(parts[1])
        assertEquals("demo-reguerta-hu090", claims["aud"]?.jsonPrimitive?.contentOrNull)
        assertEquals(
            "https://securetoken.google.com/demo-reguerta-hu090",
            claims["iss"]?.jsonPrimitive?.contentOrNull,
        )
    }

    @Test
    fun productionAuthAdapterRefreshesTheVerifiedFixtureSession() = runBlocking {
        val refreshed = FirebaseAuthSessionProvider(auth).refreshCurrentSession()
        assertTrue(refreshed is AuthSessionRefreshResult.Active)
        val principal = (refreshed as AuthSessionRefreshResult.Active).principal
        assertEquals("qa.member@example.invalid", principal.email)
        assertEquals(checkNotNull(auth.currentUser).uid, principal.uid)
    }

    @Test
    fun productionProductAdapterDecodesTheIndependentSeedContract() = runBlocking {
        // Source.SERVER ensures a stale device cache cannot satisfy this emulator smoke.
        val remote = Tasks.await(
            firestore.document("develop/plus-collections/products/hu090-carrots").get(Source.SERVER),
            10,
            TimeUnit.SECONDS,
        )
        assertTrue(remote.exists())
        val products = FirestoreProductRepository(firestore, ReguertaFirestoreEnvironment.DEVELOP).getAllProducts()
        val product = products.single { it.id == "hu090-carrots" }
        assertEquals("HU090 Carrots", product.name)
        assertEquals("hu090-producer", product.vendorId)
        assertEquals("HU090 Fixture Farm", product.companyName)
        assertEquals(2.5, product.price, 0.0)
        assertEquals("bag", product.unitName)
        assertEquals("bags", product.unitPlural)
        assertEquals(1.0, product.unitQty, 0.0)
        assertEquals(ProductPricingMode.FIXED, product.pricingMode)
        assertEquals(ProductStockMode.INFINITE, product.stockMode)
        assertTrue(product.isVisibleInOrdering)
    }

    @Test
    fun realDeniedFirestoreWriteCrossesTheProductionAdapterAsTypedDenial() = runBlocking {
        // The fixture rules deny this ID, independent of SDK message text or app mapping.
        val result = FirestoreOrdersRepository(firestore, ReguertaFirestoreEnvironment.DEVELOP)
            .updateReceivedOrderProducerStatus(
                orderId = "hu090-denied",
                producerId = "hu090-producer",
                status = ReceivedOrderProducerStatus.READ,
                nowMillis = 1_700_000_000_000,
            )
        assertEquals(ReceivedOrderStatusWriteResult.PERMISSION_DENIED, result)
    }

    @Test
    fun storageSdkUploadsDownloadsAndDeletesOnlyAnIsolatedSyntheticObject() {
        val reference = storage.reference.child("hu090-instrumented/${UUID.randomUUID()}/roundtrip.bin")
        val expected = "HU090 local Storage fixture: áñ🍅".toByteArray(Charsets.UTF_8)
        val metadata = StorageMetadata.Builder().setContentType("application/octet-stream").build()
        var uploaded = false
        try {
            Tasks.await(reference.putBytes(expected, metadata), 15, TimeUnit.SECONDS)
            uploaded = true
            assertLocalStorageUrl(Tasks.await(reference.downloadUrl, 10, TimeUnit.SECONDS))
            val actual = Tasks.await(reference.getBytes(1_024), 10, TimeUnit.SECONDS)
            assertArrayEquals(expected, actual)
        } finally {
            if (uploaded) Tasks.await(reference.delete(), 10, TimeUnit.SECONDS)
        }
    }

    @Test
    fun productionImagePipelineUploadsAReadableThreeHundredPixelJpeg() = runBlocking {
        val owner = "hu090-instrumented-${UUID.randomUUID()}"
        val source = File.createTempFile("hu090-photo-", ".png", context.cacheDir)
        val bitmap = Bitmap.createBitmap(640, 480, Bitmap.Config.ARGB_8888)
        bitmap.eraseColor(Color.MAGENTA)
        try {
            source.outputStream().use { output -> assertTrue(bitmap.compress(Bitmap.CompressFormat.PNG, 100, output)) }
        } finally {
            bitmap.recycle()
        }
        var uploaded: StorageReference? = null
        try {
            val result = FirebaseImagePipelineManager(context, storage).processAndUpload(
                sourceUri = Uri.fromFile(source),
                ownerId = owner,
                namespace = ImageUploadNamespace.PRODUCTS,
                entityId = "synthetic-photo",
                nameHint = "HU090 local image",
            )
            assertNotNull("The production image pipeline must upload the synthetic PNG", result)
            val image = checkNotNull(result)
            val url = Uri.parse(image.downloadUrl)
            assertLocalStorageUrl(url)
            val objectPath = checkNotNull(url.lastPathSegment)
            assertTrue(objectPath.startsWith("develop/images/products/$owner/"))
            val reference = storage.reference.child(objectPath)
            uploaded = reference
            val bytes = Tasks.await(reference.getBytes(1_048_576), 10, TimeUnit.SECONDS)
            assertEquals(image.byteSize, bytes.size)
            assertEquals("image/jpeg", image.mimeType)
            assertEquals(300, image.widthPx)
            assertEquals(300, image.heightPx)
            assertEquals("image/jpeg", Tasks.await(reference.metadata, 10, TimeUnit.SECONDS).contentType)
            assertEquals(0xff, bytes[0].toInt() and 0xff)
            assertEquals(0xd8, bytes[1].toInt() and 0xff)
            val decoded = checkNotNull(BitmapFactory.decodeByteArray(bytes, 0, bytes.size))
            try {
                assertEquals(300, decoded.width)
                assertEquals(300, decoded.height)
                val center = decoded.getPixel(150, 150)
                assertTrue(abs(Color.red(center) - 255) <= 8)
                assertTrue(Color.green(center) <= 8)
                assertTrue(abs(Color.blue(center) - 255) <= 8)
            } finally {
                decoded.recycle()
            }
        } finally {
            source.delete()
            uploaded?.let { Tasks.await(it.delete(), 10, TimeUnit.SECONDS) }
        }
    }

    private fun assertLocalStorageUrl(url: Uri) {
        assertEquals("http", url.scheme)
        assertEquals("10.0.2.2", url.host)
        assertEquals(9198, url.port)
        assertTrue(checkNotNull(url.path).startsWith("/v0/b/demo-reguerta-hu090.appspot.com/o/"))
    }
}
