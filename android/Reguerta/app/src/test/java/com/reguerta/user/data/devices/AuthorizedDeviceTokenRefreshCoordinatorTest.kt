package com.reguerta.user.data.devices

import com.reguerta.user.domain.devices.DeviceRegistrationRepository
import com.reguerta.user.domain.devices.DeviceRegistrationWriteBlockedException
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
        assertEquals("TOKEN-A", store.firebaseInstallationId)
        assertTrue(repository.registrations.isEmpty())
    }

    @Test
    fun `cold process stores token without adopting persisted authorization`() = runTest {
        val context = authorizedContext()
        val store = FakeAuthorizedDeviceTokenStore(context = context)
        val repository = RecordingDeviceRegistrationRepository()
        val processSession = FakeAuthorizedDeviceProcessSession()
        val coordinator = coordinator(
            store = store,
            repository = repository,
            processSession = processSession,
        )

        val result = coordinator.refresh("TOKEN-A")

        assertEquals(AuthorizedDeviceTokenRefreshResult.STORED_ONLY, result)
        assertEquals("TOKEN-A", store.firebaseInstallationId)
        assertTrue(repository.registrations.isEmpty())
    }

    @Test
    fun `different process lease rejects persisted authorization`() = runTest {
        val context = authorizedContext(leaseId = "LEASE-A")
        val store = FakeAuthorizedDeviceTokenStore(context = context)
        val repository = RecordingDeviceRegistrationRepository()
        val processSession = FakeAuthorizedDeviceProcessSession(
            initialContext = context.copy(leaseId = "LEASE-B"),
        )
        val coordinator = coordinator(
            store = store,
            repository = repository,
            processSession = processSession,
        )

        val result = coordinator.refresh("TOKEN-A")

        assertEquals(AuthorizedDeviceTokenRefreshResult.STALE_SESSION, result)
        assertTrue(repository.registrations.isEmpty())
    }

    @Test
    fun `different process environment rejects persisted authorization`() = runTest {
        val context = authorizedContext(environment = "develop")
        val store = FakeAuthorizedDeviceTokenStore(context = context)
        val repository = RecordingDeviceRegistrationRepository()
        val processSession = FakeAuthorizedDeviceProcessSession(
            initialContext = context.copy(environment = "production"),
        )
        val coordinator = coordinator(
            store = store,
            repository = repository,
            processSession = processSession,
        )

        val result = coordinator.refresh("TOKEN-A")

        assertEquals(AuthorizedDeviceTokenRefreshResult.STALE_SESSION, result)
        assertTrue(repository.registrations.isEmpty())
    }

    @Test
    fun `invalidation supersedes an activation permit`() {
        ReguertaAuthorizedDeviceProcessSession.invalidate()
        val activationGeneration =
            ReguertaAuthorizedDeviceProcessSession.activationGeneration()

        ReguertaAuthorizedDeviceProcessSession.invalidate()
        val activated = ReguertaAuthorizedDeviceProcessSession.activate(
            context = authorizedContext(),
            expectedGeneration = activationGeneration,
        )

        assertFalse(activated)
        assertEquals(
            AuthorizedDeviceProcessSessionMatch.NOT_ESTABLISHED,
            ReguertaAuthorizedDeviceProcessSession.match(authorizedContext()),
        )
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
                    registrationId = "TOKEN-A",
                ),
            ),
            repository.registrations,
        )
    }

    @Test
    fun `dispatch blocked registration retries on next authorized token event`() = runTest {
        val store = FakeAuthorizedDeviceTokenStore(context = authorizedContext())
        val repository = RecordingDeviceRegistrationRepository(blockedWriteCount = 1)
        val coordinator = coordinator(store = store, repository = repository)

        assertEquals(
            AuthorizedDeviceTokenRefreshResult.DEFERRED,
            coordinator.refresh("TOKEN-A"),
        )
        assertEquals("TOKEN-A", store.firebaseInstallationId)
        assertTrue(repository.registrations.isEmpty())

        assertEquals(
            AuthorizedDeviceTokenRefreshResult.UPLOADED,
            coordinator.refresh("TOKEN-A"),
        )
        assertEquals(listOf("TOKEN-A"), repository.registrations.map { it.registrationId })
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
        assertEquals(
            listOf("TOKEN-A", "TOKEN-B"),
            repository.registrations.map { it.registrationId },
        )
        assertEquals("TOKEN-B", store.firebaseInstallationId)
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
        store.saveFirebaseInstallationId("TOKEN-B")
        releaseFirst.complete(Unit)

        assertTrue(first.await().isFailure)
        assertTrue(repository.registrations.isEmpty())
    }

    @Test
    fun `process invalidation while repository is suspended prevents commit`() = runTest {
        val registrationStarted = CompletableDeferred<Unit>()
        val registrationRelease = CompletableDeferred<Unit>()
        val context = authorizedContext()
        val store = FakeAuthorizedDeviceTokenStore(context = context)
        val processSession = FakeAuthorizedDeviceProcessSession(initialContext = context)
        val repository = RecordingDeviceRegistrationRepository(
            suspendedToken = "TOKEN-A",
            started = registrationStarted,
            release = registrationRelease,
        )
        val coordinator = coordinator(
            store = store,
            repository = repository,
            processSession = processSession,
        )

        val refresh = async { runCatching { coordinator.refresh("TOKEN-A") } }
        registrationStarted.await()
        processSession.invalidate()
        registrationRelease.complete(Unit)

        assertTrue(refresh.await().isFailure)
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
        assertEquals(listOf("TOKEN-B"), repository.registrations.map { it.registrationId })
    }

    @Test
    fun `service handles token inside callback and repository keeps an atomic fenced batch`() {
        val serviceSource = source("data/devices/ReguertaFirebaseMessagingService.kt")
        val repositorySource = source("data/devices/FirestoreDeviceRegistrationRepository.kt")
        val registrarSource = source("data/devices/FirebaseAuthorizedDeviceRegistrar.kt")
        val manifestSource = appSource("src/main/AndroidManifest.xml")

        assertTrue(serviceSource.contains("override fun onRegistered(installationId: String)"))
        assertTrue(serviceSource.contains("registrationCallbackRunner.handle(installationId)"))
        assertFalse(serviceSource.contains("override fun onNewToken"))
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
        assertTrue(repositorySource.contains("payload[\"fcmToken\"] = null"))
        assertTrue(
            repositorySource.contains(
                "payload[\"firebaseInstallationId\"] = device.firebaseInstallationId",
            ),
        )
        assertFalse(registrarSource.contains("Tasks.await"))
        assertTrue(registrarSource.contains("FirebaseMessaging.getInstance().register().await()"))
        assertTrue(registrarSource.contains("FirebaseInstallations.getInstance().id.await()"))
        assertFalse(registrarSource.contains("FirebaseMessaging.getInstance().token"))
        assertTrue(manifestSource.contains("firebase_messaging_installation_id_enabled"))
        assertTrue(manifestSource.contains("android:value=\"true\""))
        assertTrue(
            registrarSource.indexOf("preferences.saveAuthorizedSessionContext(") <
                registrarSource.indexOf("registrationWriter.registerLatest("),
        )
    }

    private fun coordinator(
        store: FakeAuthorizedDeviceTokenStore,
        repository: RecordingDeviceRegistrationRepository,
        processSession: AuthorizedDeviceProcessSession =
            FakeAuthorizedDeviceProcessSession(initialContext = store.context),
        currentAuthUid: () -> String? = { "UID-A" },
    ) = AuthorizedDeviceTokenRefreshCoordinator(
        store = store,
        repository = repository,
        processSession = processSession,
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
                firebaseInstallationId = token,
                firstSeenAtMillis = nowMillis,
                lastSeenAtMillis = nowMillis,
                registrationUpdatedAtMillis = nowMillis,
            )
        },
    )

    private fun authorizedContext(
        memberId: String = "MEMBER-A",
        authUid: String = "UID-A",
        environment: String = "develop",
        leaseId: String = "LEASE-A",
    ) = AuthorizedDeviceSessionContext(
        memberId = memberId,
        authUid = authUid,
        environment = environment,
        leaseId = leaseId,
    )

    private fun registeredDevice(token: String?) = RegisteredDevice(
        deviceId = "DEVICE-A",
        platform = "android",
        appVersion = "1.0",
        osVersion = "test",
        apiLevel = 29,
        manufacturer = "test",
        model = "test",
        firebaseInstallationId = token,
        firstSeenAtMillis = 1_000L,
        lastSeenAtMillis = 1_000L,
        registrationUpdatedAtMillis = token?.let { 1_000L },
    )

    private fun source(relativePath: String): String {
        val projectRoot = generateSequence(Path.of(System.getProperty("user.dir"))) { it.parent }
            .first { Files.exists(it.resolve("app/src/main/java/com/reguerta/user")) }
        return Files.readString(projectRoot.resolve("app/src/main/java/com/reguerta/user/$relativePath"))
    }

    private fun appSource(relativePath: String): String {
        val projectRoot = generateSequence(Path.of(System.getProperty("user.dir"))) { it.parent }
            .first { Files.exists(it.resolve("app/src/main")) }
        return Files.readString(projectRoot.resolve("app/$relativePath"))
    }
}

private class FakeAuthorizedDeviceProcessSession(
    initialContext: AuthorizedDeviceSessionContext? = null,
) : AuthorizedDeviceProcessSession {
    private var generation = 0L
    private var activeContext = initialContext

    override fun activationGeneration(): Long = generation

    override fun activate(
        context: AuthorizedDeviceSessionContext,
        expectedGeneration: Long,
    ): Boolean {
        if (generation != expectedGeneration) return false
        activeContext = context
        return true
    }

    override fun invalidate() {
        generation += 1L
        activeContext = null
    }

    override fun invalidateIfOwned(context: AuthorizedDeviceSessionContext) {
        if (activeContext == context) {
            activeContext = null
        }
    }

    override fun match(
        context: AuthorizedDeviceSessionContext,
    ): AuthorizedDeviceProcessSessionMatch = when (val currentContext = activeContext) {
        null -> AuthorizedDeviceProcessSessionMatch.NOT_ESTABLISHED
        context -> AuthorizedDeviceProcessSessionMatch.CURRENT
        else -> {
            check(currentContext != context)
            AuthorizedDeviceProcessSessionMatch.SUPERSEDED
        }
    }
}

private class FakeAuthorizedDeviceTokenStore(
    var context: AuthorizedDeviceSessionContext?,
) : AuthorizedDeviceRegistrationStore {
    var firebaseInstallationId: String? = null

    override suspend fun saveFirebaseInstallationId(installationId: String?) {
        firebaseInstallationId = installationId?.trim()?.ifBlank { null }
    }

    override suspend fun getFirebaseInstallationId(): String? = firebaseInstallationId

    override suspend fun getAuthorizedSessionContext(): AuthorizedDeviceSessionContext? = context

    override suspend fun getOrCreateDeviceId(): String = "DEVICE-A"
}

private data class RecordedRegistration(
    val memberId: String,
    val environment: String,
    val deviceId: String,
    val registrationId: String?,
)

private class RecordingDeviceRegistrationRepository(
    private val suspendedToken: String? = null,
    private val started: CompletableDeferred<Unit>? = null,
    private val release: CompletableDeferred<Unit>? = null,
    blockedWriteCount: Int = 0,
) : DeviceRegistrationRepository {
    val registrations = CopyOnWriteArrayList<RecordedRegistration>()
    private var blockedWritesRemaining = blockedWriteCount

    override suspend fun registerDevice(
        memberId: String,
        environment: String,
        device: RegisteredDevice,
        isSessionCurrent: suspend () -> Boolean,
    ): RegisteredDevice {
        if (!isSessionCurrent()) {
            throw CancellationException("Registration superseded before test write")
        }
        if (blockedWritesRemaining > 0) {
            blockedWritesRemaining -= 1
            throw DeviceRegistrationWriteBlockedException(IllegalStateException("blocked"))
        }
        if (device.firebaseInstallationId == suspendedToken) {
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
            registrationId = device.firebaseInstallationId,
        )
        return device
    }
}
