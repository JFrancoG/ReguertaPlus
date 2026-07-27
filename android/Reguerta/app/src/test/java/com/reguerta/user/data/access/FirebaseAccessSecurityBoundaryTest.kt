package com.reguerta.user.data.access

import com.reguerta.user.domain.access.AuthorizedMemberResolution
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.access.MemberManagementException
import com.reguerta.user.domain.access.MemberRole
import com.reguerta.user.domain.access.SessionEnvironmentRouter
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

class FirebaseAccessSecurityBoundaryTest {
    @Test
    fun `authorized resolver sends only environment and applies backend environment`() = runBlocking {
        val caller = RecordingFunctionCaller(
            response = JsonObject(
                mapOf(
                    "authorized" to JsonPrimitive(true),
                    "memberId" to JsonPrimitive("member_001"),
                    "roles" to kotlinx.serialization.json.JsonArray(
                        listOf(JsonPrimitive("member"), JsonPrimitive("producer")),
                    ),
                    "isActive" to JsonPrimitive(true),
                    "environment" to JsonPrimitive("develop"),
                    "firstLoginLinked" to JsonPrimitive(true),
                ),
            ),
        )
        val environmentRouter = RecordingEnvironmentRouter()
        val resolver = FirebaseAuthorizedMemberResolver(
            functionCaller = caller,
            requestedEnvironment = { "production" },
            environmentRouter = environmentRouter,
        )

        val result = resolver.resolve()

        assertTrue(result is AuthorizedMemberResolution.Authorized)
        result as AuthorizedMemberResolution.Authorized
        assertEquals("member_001", result.memberId)
        assertEquals(setOf(MemberRole.MEMBER, MemberRole.PRODUCER), result.roles)
        assertTrue(result.firstLoginLinked)
        assertEquals("resolveAuthorizedMember", caller.functionName)
        assertEquals(setOf("env"), caller.body.keys)
        assertEquals("production", caller.body.getValue("env").jsonPrimitive.content)
        assertFalse(caller.body.containsKey("authUid"))
        assertFalse(caller.body.containsKey("email"))
        assertEquals("develop", environmentRouter.appliedEnvironment)
    }

    @Test
    fun `admin upsert authenticates through caller without actor uid in body`() = runBlocking {
        val caller = RecordingFunctionCaller(
            response = JsonObject(mapOf("ok" to JsonPrimitive(true))),
        )
        val repository = FirebaseMemberAdministrationRepository(
            functionCaller = caller,
            requestedEnvironment = { "develop" },
        )
        val member = member(id = "member_target", roles = setOf(MemberRole.MEMBER, MemberRole.ADMIN))

        val persisted = repository.upsertMember(member)

        assertEquals(member, persisted)
        assertEquals("upsertMemberByAdmin", caller.functionName)
        assertFalse(caller.body.containsKey("actorAuthUid"))
        assertFalse(caller.body.containsKey("authUid"))
        assertEquals("develop", caller.body.getValue("env").jsonPrimitive.content)
        assertEquals("member_target", caller.body.getValue("memberId").jsonPrimitive.content)
        assertEquals(
            setOf("member", "admin"),
            caller.body.getValue("roles").jsonArray.map { it.jsonPrimitive.content }.toSet(),
        )
        assertTrue(caller.body.getValue("isActive").jsonPrimitive.boolean)
    }

    @Test
    fun `admin repository maps forbidden and last admin responses`() = runBlocking {
        val member = member(id = "member_target")

        val forbidden = FirebaseMemberAdministrationRepository(
            functionCaller = ThrowingFunctionCaller(statusCode = 403),
            requestedEnvironment = { "develop" },
        )
        try {
            forbidden.upsertMember(member)
            fail("Expected access denied")
        } catch (_: MemberManagementException.AccessDenied) {
            assertTrue(true)
        }

        val lastAdmin = FirebaseMemberAdministrationRepository(
            functionCaller = ThrowingFunctionCaller(
                statusCode = 409,
                responseBody = """{"error":{"code":"last_active_admin"}}""",
            ),
            requestedEnvironment = { "develop" },
        )
        try {
            lastAdmin.upsertMember(member)
            fail("Expected last admin protection")
        } catch (_: MemberManagementException.LastAdminRemoval) {
            assertTrue(true)
        }

        val duplicateEmail = FirebaseMemberAdministrationRepository(
            functionCaller = ThrowingFunctionCaller(
                statusCode = 409,
                responseBody = """{"error":{"code":"duplicate_member_email"}}""",
            ),
            requestedEnvironment = { "develop" },
        )
        try {
            duplicateEmail.upsertMember(member)
            fail("Expected a generic member conflict")
        } catch (_: MemberManagementException.Conflict) {
            assertTrue(true)
        }
    }

    @Test
    fun `resolver preserves backend verified email denial`() = runBlocking {
        val resolver = FirebaseAuthorizedMemberResolver(
            functionCaller = ThrowingFunctionCaller(
                statusCode = 403,
                responseBody = """{"error":{"code":"verified_email_required"}}""",
            ),
            requestedEnvironment = { "develop" },
            environmentRouter = RecordingEnvironmentRouter(),
        )

        val result = resolver.resolve() as AuthorizedMemberResolution.Unauthorized

        assertTrue(result.emailVerificationRequired)
    }

    @Test
    fun `resolver preserves backend inactive member denial`() = runBlocking {
        val resolver = FirebaseAuthorizedMemberResolver(
            functionCaller = ThrowingFunctionCaller(
                statusCode = 403,
                responseBody = """{"error":{"code":"inactive_member"}}""",
            ),
            requestedEnvironment = { "develop" },
            environmentRouter = RecordingEnvironmentRouter(),
        )

        val result = resolver.resolve() as AuthorizedMemberResolution.Unauthorized

        assertEquals(false, result.isActive)
        assertFalse(result.emailVerificationRequired)
    }
}

private class RecordingFunctionCaller(
    private val response: JsonObject,
) : AuthenticatedFunctionCaller {
    var functionName: String? = null
    var body: JsonObject = JsonObject(emptyMap())

    override suspend fun post(functionName: String, body: JsonObject): JsonObject {
        this.functionName = functionName
        this.body = body
        return response
    }
}

private class ThrowingFunctionCaller(
    private val statusCode: Int,
    private val responseBody: String = "{}",
) : AuthenticatedFunctionCaller {
    override suspend fun post(functionName: String, body: JsonObject): JsonObject {
        throw AuthenticatedFunctionException(statusCode = statusCode, responseBody = responseBody)
    }
}

private class RecordingEnvironmentRouter : SessionEnvironmentRouter {
    var appliedEnvironment: String? = null

    override fun applyResolvedEnvironment(environment: String) {
        appliedEnvironment = environment
    }

    override fun resetToBaseEnvironment() = Unit
}

private fun member(
    id: String,
    roles: Set<MemberRole> = setOf(MemberRole.MEMBER),
): Member = Member(
    id = id,
    displayName = "Target Member",
    companyName = null,
    phoneNumber = null,
    normalizedEmail = "target@reguerta.app",
    authUid = null,
    roles = roles,
    isActive = true,
    producerCatalogEnabled = true,
)
