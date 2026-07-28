package com.reguerta.user.data.devices

import com.reguerta.user.domain.devices.DeviceRegistrationRepository
import com.reguerta.user.domain.devices.RegisteredDevice
import java.nio.file.Files
import java.nio.file.Path
import java.util.concurrent.CopyOnWriteArrayList
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AuthorizedDeviceTokenRefreshCoordinatorTest {
    @Test
    fun `callback runner does not return before refresh completes`() = runTest {
        val started = CompletableDeferred<Unit>()
        val release = CompletableDeferred<Unit>()
        val runner = FirebaseTokenCallbackRunner(
            timeoutMillis = 5_000L,
            refresh = {
                started.complete(Unit)
                release.await()
                AuthorizedDeviceTokenRefreshResult.STORED_ONLY
            },
        )

        val callback = async(Dispatchers.Default) { runner.handle("TOKEN-A") }
        started.await()

        assertFalse(callback.isCompleted)
        release.complete(Unit)
        assertEquals(AuthorizedDeviceTokenRefreshResult.STORED_ONLY, callback.await())
    }

    @Test
    fun `mismatched auth uid stores token but never uploads it`() = runTest {
        val store = FakeAuthorizedDeviceTokenStore(
            context = authorizedContext(authUid = "UID-A"),
        )
        val repository = RecordingDeviceRegistrationRepository()
        val coordinator = coordinator(
            store = store,
            repository = repository,
            currentAuthUid = { "UID-B" },
        )

        val result = coordinator.refresh(" TOKEN-A ")

        assertEquals(AuthorizedDeviceTokenRefreshResult.STALE_SESSION, result)
        assertEquals("TOKEN-A", store.fcmToken)
        assertTrue(repository.registrations.isEmpty())
    }

    @Test
    fun `authorized refresh forwards persisted member environment and device`() = runTest {
        val context = authorizedContext(
            memberId = "MEMBER-A",
            authUid = "UID-A",
            environment = "production",
        )
        val store = FakeAuthorizedDeviceTokenStore(context = context)
        val repository = RecordingDeviceRegistrationRepository()
        val coordinator = coordinator(
            store = store,
            repository = repository,
            currentAuthUid = { "UID-A" },
        )

        val result = coordinator.refresh("TOKEN-A")

        assertEquals(AuthorizedDeviceTokenRefreshResult.UPLOADED, result)
        assertEquals(
            listOf(
                RecordedRegistration(
                    memberId = "MEMBER-A",
                    environment = "production",
                    deviceId = "DEVICE-A",
                    token = "TOKEN-A",
                ),
            ),
            repository.registrations,
        )
    }

    @Test
    fun `consecutive callbacks are serialized so newest token is written last`() = runTest {
        val firstStarted = CompletableDeferred<Unit>()
        val releaseFirst = CompletableDeferred<Unit>()
        val store = FakeAuthorizedDeviceTokenStore(context = authorizedContext())
        val repository = RecordingDeviceRegistrationRepository(
            suspendedToken = "TOKEN-A",
            started = firstStarted,
            release = releaseFirst,
        )
        val coordinator = coordinator(store = store, repository = repository)

        val first = async { coordinator.refresh("TOKEN-A") }
        firstStarted.await()
        val second = async { coordinator.refresh("TOKEN-B") }

        assertFalse(second.isCompleted)
        releaseFirst.complete(Unit)
        assertEquals(AuthorizedDeviceTokenRefreshResult.UPLOADED, first.await())
        assertEquals(AuthorizedDeviceTokenRefreshResult.UPLOADED, second.await())
        assertEquals(listOf("TOKEN-A", "TOKEN-B"), repository.registrations.map { it.token })
        assertEquals("TOKEN-B", store.fcmToken)
    }

    @Test
    fun `repository fence rejects a token superseded outside the coordinator`() = runTest {
        val firstStarted = CompletableDeferred<Unit>()
        val releaseFirst = CompletableDeferred<Unit>()
        val store = FakeAuthorizedDeviceTokenStore(context = authorizedContext())
        val repository = RecordingDeviceRegistrationRepository(
            suspendedToken = "TOKEN-A",
            started = firstStarted,
            release = releaseFirst,
        )
        val coordinator = coordinator(store = store, repository = repository)

        val first = async { runCatching { coordinator.refresh("TOKEN-A") } }
        firstStarted.await()
        store.saveFcmToken("TOKEN-B")
        releaseFirst.complete(Unit)

        assertTrue(first.await().isFailure)
        assertTrue(repository.registrations.isEmpty())
    }

    @Test
    fun `login registration catches up token received before context was published`() = runTest {
        val store = FakeAuthorizedDeviceTokenStore(context = null)
        val repository = RecordingDeviceRegistrationRepository()
        val callbackCoordinator = coordinator(store = store, repository = repository)
        assertEquals(
            AuthorizedDeviceTokenRefreshResult.STORED_ONLY,
            callbackCoordinator.refresh("TOKEN-B"),
        )
        assertTrue(repository.registrations.isEmpty())

        store.context = authorizedContext()
        val writer = AuthorizedDeviceRegistrationWriter(
            store = store,
            repository = repository,
        )

        val result = writer.registerLatest(
            memberId = "MEMBER-A",
            environment = "develop",
            device = registeredDevice(token = "TOKEN-A"),
            isSessionCurrent = { true },
            refreshedDevice = { token -> registeredDevice(token = token) },
        )

        assertEquals(AuthorizedDeviceRegistrationWriteResult.REGISTERED, result)
        assertEquals(listOf("TOKEN-B"), repository.registrations.map { it.token })
    }

    @Test
    fun `service handles token inside callback and repository keeps an atomic fenced batch`() {
        val serviceSource = source("data/devices/ReguertaFirebaseMessagingService.kt")
        val repositorySource = source("data/devices/FirestoreDeviceRegistrationRepository.kt")
        val registrarSource = source("data/devices/FirebaseAuthorizedDeviceRegistrar.kt")

        assertTrue(serviceSource.contains("tokenCallbackRunner.handle(token)"))
        assertFalse(serviceSource.contains("serviceScope.launch"))
        assertFalse(serviceSource.contains("override fun onDestroy()"))

        val batchCreation = repositorySource.indexOf("val batch = firestore.batch()")
        val deviceWrite = repositorySource.indexOf("batch.set(deviceDocument", startIndex = batchCreation)
        val userWrite = repositorySource.indexOf("batch.set(\n                userDocument", startIndex = deviceWrite)
        val finalFence = repositorySource.lastIndexOf("ensureSessionCurrent(isSessionCurrent)")
        val commit = repositorySource.indexOf("batch.commit().await()", startIndex = finalFence)
        assertTrue(batchCreation >= 0)
        assertTrue(deviceWrite > batchCreation)
        assertTrue(userWrite > deviceWrite)
        assertTrue(finalFence > userWrite)
        assertTrue(commit > finalFence)
        assertFalse(repositorySource.contains("deviceDocument.set("))
        assertFalse(repositorySource.contains("userDocument.set("))
        assertFalse(repositorySource.contains("Tasks.await"))
        assertTrue(repositorySource.contains("deviceDocument.get().await()"))
        assertFalse(registrarSource.contains("Tasks.await"))
        assertTrue(registrarSource.contains("FirebaseMessaging.getInstance().token.await()"))
        assertTrue(
            registrarSource.indexOf("preferences.saveAuthorizedSessionContext(") <
                registrarSource.indexOf("registrationWriter.registerLatest("),
        )
    }

    private fun coordinator(
        store: FakeAuthorizedDeviceTokenStore,
        repository: RecordingDeviceRegistrationRepository,
        currentAuthUid: () -> String? = { "UID-A" },
    ) = AuthorizedDeviceTokenRefreshCoordinator(
        store = store,
        repository = repository,
        currentAuthUidProvider = currentAuthUid,
        nowMillisProvider = { 1_000L },
        deviceProvider = { token, deviceId, nowMillis ->
            RegisteredDevice(
                deviceId = deviceId,
                platform = "android",
                appVersion = "1.0",
                osVersion = "test",
                apiLevel = 29,
                manufacturer = "test",
                model = "test",
                fcmToken = token,
                firstSeenAtMillis = nowMillis,
                lastSeenAtMillis = nowMillis,
                tokenUpdatedAtMillis = nowMillis,
            )
        },
    )

    private fun authorizedContext(
        memberId: String = "MEMBER-A",
        authUid: String = "UID-A",
        environment: String = "develop",
    ) = AuthorizedDeviceSessionContext(
        memberId = memberId,
        authUid = authUid,
        environment = environment,
        leaseId = "LEASE-A",
    )

    private fun registeredDevice(token: String?) = RegisteredDevice(
        deviceId = "DEVICE-A",
        platform = "android",
        appVersion = "1.0",
        osVersion = "test",
        apiLevel = 29,
        manufacturer = "test",
        model = "test",
        fcmToken = token,
        firstSeenAtMillis = 1_000L,
        lastSeenAtMillis = 1_000L,
        tokenUpdatedAtMillis = token?.let { 1_000L },
    )

    private fun source(relativePath: String): String {
        val projectRoot = generateSequence(Path.of(System.getProperty("user.dir"))) { it.parent }
            .first { Files.exists(it.resolve("app/src/main/java/com/reguerta/user")) }
        return Files.readString(projectRoot.resolve("app/src/main/java/com/reguerta/user/$relativePath"))
    }
}

private class FakeAuthorizedDeviceTokenStore(
    var context: AuthorizedDeviceSessionContext?,
) : AuthorizedDeviceTokenStore {
    var fcmToken: String? = null

    override suspend fun saveFcmToken(token: String?) {
        fcmToken = token?.trim()?.ifBlank { null }
    }

    override suspend fun getFcmToken(): String? = fcmToken

    override suspend fun getAuthorizedSessionContext(): AuthorizedDeviceSessionContext? = context

    override suspend fun getOrCreateDeviceId(): String = "DEVICE-A"
}

private data class RecordedRegistration(
    val memberId: String,
    val environment: String,
    val deviceId: String,
    val token: String?,
)

private class RecordingDeviceRegistrationRepository(
    private val suspendedToken: String? = null,
    private val started: CompletableDeferred<Unit>? = null,
    private val release: CompletableDeferred<Unit>? = null,
) : DeviceRegistrationRepository {
    val registrations = CopyOnWriteArrayList<RecordedRegistration>()

    override suspend fun registerDevice(
        memberId: String,
        environment: String,
        device: RegisteredDevice,
        isSessionCurrent: suspend () -> Boolean,
    ): RegisteredDevice {
        if (!isSessionCurrent()) {
            throw CancellationException("Registration superseded before test write")
        }
        if (device.fcmToken == suspendedToken) {
            started?.complete(Unit)
            release?.await()
        }
        if (!isSessionCurrent()) {
            throw CancellationException("Registration superseded before test commit")
        }
        registrations += RecordedRegistration(
            memberId = memberId,
            environment = environment,
            deviceId = device.deviceId,
            token = device.fcmToken,
        )
        return device
    }
}
