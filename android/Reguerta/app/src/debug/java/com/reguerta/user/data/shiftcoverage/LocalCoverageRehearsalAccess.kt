package com.reguerta.user.data.shiftcoverage

import androidx.annotation.MainThread
import com.reguerta.user.domain.shiftcoverage.CoverageRehearsalAccess
import com.reguerta.user.domain.shiftcoverage.ShiftCoverageFailure
import com.reguerta.user.domain.shiftcoverage.ShiftCoverageSession
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

/** Memory-only Auth emulator session, separate from the application's Firebase Auth instance. */
@MainThread
internal class LocalCoverageRehearsalAccess(
    port: Int = 8799,
    emulatorHost: Boolean = true,
    private val transport: CoverageHttpTransport = LocalCoverageHttpTransport(),
) : CoverageRehearsalAccess {
    private var token: String? = null
    private var session: ShiftCoverageSession? = null
    private var revision = 0L
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }
    private val host = if (emulatorHost) "10.0.2.2" else "127.0.0.1"
    override val repository = LocalShiftCoverageRepository(
        port = port,
        emulatorHost = emulatorHost,
        currentSession = { session },
        tokenProvider = { token ?: throw ShiftCoverageFailure.SessionChanged },
        transport = transport,
    )

    override fun signOut() {
        revision++
        token = null
        session = null
    }

    override suspend fun signIn(email: String, password: String): ShiftCoverageSession {
        signOut()
        val owner = revision
        try {
            val response = transport.post(
                url = "http://$host:9098/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key",
                token = "",
                body = json.encodeToString(Login(email, password)),
            )
            currentCoroutineContext().ensureActive()
            if (owner != revision) throw ShiftCoverageFailure.SessionChanged
            val login = runCatching { json.decodeFromString<LoginResult>(response.body) }.getOrNull()
            if (response.status != 200 || login == null) {
                throw ShiftCoverageFailure.Rejected(401, "coverage_sign_in_failed")
            }
            val provisional = ShiftCoverageSession(login.localId, "resolving", owner)
            token = login.idToken
            session = provisional
            val snapshot = repository.resolveMember(session = provisional)
            if (owner != revision) throw ShiftCoverageFailure.SessionChanged
            return provisional.copy(memberId = snapshot.memberId).also { session = it }
        } catch (error: Exception) {
            if (owner == revision) signOut()
            throw error
        }
    }

    @Serializable
    private data class Login(val email: String, val password: String) {
        val returnSecureToken = true
    }
    @Serializable
    private data class LoginResult(val localId: String, val idToken: String)
}
