package com.reguerta.user.data.access

import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertThrows
import org.junit.Test

class FirebaseFunctionsEndpointBoundaryTest {
    @Test
    fun productionKeepsItsCloudEndpoint() {
        assertEquals(
            "https://europe-west1-reguerta-example.cloudfunctions.net/resolveAuthorizedMember",
            firebaseFunctionUrl("reguerta-example", "resolveAuthorizedMember", false, ""),
        )
    }

    @Test
    fun localEndpointUsesOnlyTheFixedDemoGateway() = runTest {
        var endpoint: String? = null
        var tokenCalls = 0
        val expectedBody = buildJsonObject { put("env", "production") }
        val response = buildJsonObject { put("environment", "develop") }
        val client = AuthenticatedFirebaseFunctionsClient(
            idTokenProvider = FirebaseIdTokenProvider { tokenCalls++; "synthetic-token" },
            projectIdProvider = FirebaseProjectIdProvider { "demo-reguerta-hu090" },
            transport = FirebaseJsonPostTransport { url, token, body ->
                endpoint = url
                assertEquals("synthetic-token", token)
                assertEquals(expectedBody, body)
                response
            },
            localValidation = true,
            configuredBaseUrl = "http://10.0.2.2:5009/demo-reguerta-hu090/europe-west1",
        )
        assertEquals(response, client.post("resolveAuthorizedMember", expectedBody))
        assertEquals(1, tokenCalls)
        assertEquals(
            "http://10.0.2.2:5009/demo-reguerta-hu090/europe-west1/resolveAuthorizedMember",
            endpoint,
        )
    }

    @Test
    fun invalidLocalEndpointFailsBeforeCredentialOrTransportAccess() = runTest {
        var tokenCalls = 0
        var transportCalls = 0
        val client = AuthenticatedFirebaseFunctionsClient(
            idTokenProvider = FirebaseIdTokenProvider { tokenCalls++; "must-not-be-requested" },
            projectIdProvider = FirebaseProjectIdProvider { "demo-reguerta-hu090" },
            transport = FirebaseJsonPostTransport { _, _, _ -> transportCalls++; JsonObject(emptyMap()) },
            localValidation = true,
            configuredBaseUrl = "https://outside.invalid/demo-reguerta-hu090/europe-west1",
        )
        val failure = runCatching { client.post("resolveAuthorizedMember", JsonObject(emptyMap())) }.exceptionOrNull()
        assertNotNull(failure as? IllegalArgumentException)
        assertEquals(0, tokenCalls)
        assertEquals(0, transportCalls)
    }

    @Test
    fun localBuildRejectsAnyOtherProject() {
        assertThrows(IllegalArgumentException::class.java) {
            firebaseFunctionUrl(
                "reguerta-example", "resolveAuthorizedMember", true,
                "http://10.0.2.2:5009/demo-reguerta-hu090/europe-west1",
            )
        }
    }

    @Test
    fun missingLocalConfigurationHasNoCloudFallback() {
        assertThrows(IllegalArgumentException::class.java) {
            firebaseFunctionUrl("demo-reguerta-hu090", "resolveAuthorizedMember", true, "")
        }
        assertThrows(IllegalArgumentException::class.java) {
            firebaseFunctionUrl("demo-reguerta-hu090", "resolveAuthorizedMember", false, "")
        }
    }

    @Test
    fun localEndpointRejectsPortPathCredentialsAndQueryChanges() {
        val invalid = listOf(
            "http://10.0.2.2:5001/demo-reguerta-hu090/europe-west1",
            "http://localhost:5009/demo-reguerta-hu090/europe-west1",
            "http://10.0.2.2:5009/other/europe-west1",
            "http://user@10.0.2.2:5009/demo-reguerta-hu090/europe-west1",
            "http://10.0.2.2:5009/demo-reguerta-hu090/europe-west1?target=cloud",
            "http://10.0.2.2:5009/demo-reguerta-hu090/europe-west1#other",
        )
        invalid.forEach { base ->
            assertThrows(base, IllegalArgumentException::class.java) {
                firebaseFunctionUrl("demo-reguerta-hu090", "resolveAuthorizedMember", true, base)
            }
        }
    }

    @Test
    fun functionNameCannotEscapeTheFixedBase() {
        assertThrows(IllegalArgumentException::class.java) {
            firebaseFunctionUrl(
                "demo-reguerta-hu090", "../other", true,
                "http://10.0.2.2:5009/demo-reguerta-hu090/europe-west1",
            )
        }
    }

    @Test
    fun productionCannotBeRedirectedByAValidationEndpoint() {
        assertThrows(IllegalArgumentException::class.java) {
            firebaseFunctionUrl(
                "reguerta-example", "resolveAuthorizedMember", false,
                "http://10.0.2.2:5009/demo-reguerta-hu090/europe-west1",
            )
        }
    }
}
