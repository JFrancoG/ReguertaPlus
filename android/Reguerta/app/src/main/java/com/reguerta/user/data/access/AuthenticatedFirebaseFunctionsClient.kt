package com.reguerta.user.data.access

import com.google.android.gms.tasks.Tasks
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

internal interface AuthenticatedFunctionCaller {
    suspend fun post(functionName: String, body: JsonObject): JsonObject
}

internal class AuthenticatedFunctionException(
    val statusCode: Int,
    val responseBody: String,
) : IOException("Firebase Function request failed with HTTP $statusCode")

internal fun AuthenticatedFunctionException.functionErrorCode(): String? =
    runCatching {
        Json.parseToJsonElement(responseBody)
            .jsonObject["error"]
            ?.jsonObject
            ?.get("code")
            ?.jsonPrimitive
            ?.contentOrNull
    }.getOrNull()

internal fun interface FirebaseIdTokenProvider {
    suspend fun currentIdToken(): String
}

internal fun interface FirebaseProjectIdProvider {
    fun projectId(): String
}

internal fun interface FirebaseJsonPostTransport {
    suspend fun post(
        url: String,
        bearerToken: String,
        body: JsonObject,
    ): JsonObject
}

internal class AuthenticatedFirebaseFunctionsClient(
    private val idTokenProvider: FirebaseIdTokenProvider,
    private val projectIdProvider: FirebaseProjectIdProvider,
    private val transport: FirebaseJsonPostTransport = HttpUrlConnectionJsonPostTransport(),
) : AuthenticatedFunctionCaller {
    override suspend fun post(functionName: String, body: JsonObject): JsonObject {
        val projectId = projectIdProvider.projectId()
        val token = idTokenProvider.currentIdToken()
        val url = "https://europe-west1-$projectId.cloudfunctions.net/$functionName"
        return transport.post(url = url, bearerToken = token, body = body)
    }

    companion object {
        fun create(
            auth: FirebaseAuth,
            firebaseApp: FirebaseApp,
        ): AuthenticatedFirebaseFunctionsClient = AuthenticatedFirebaseFunctionsClient(
            idTokenProvider = FirebaseIdTokenProvider {
                withContext(Dispatchers.IO) {
                    val user = checkNotNull(auth.currentUser) { "No authenticated Firebase user" }
                    checkNotNull(Tasks.await(user.getIdToken(false)).token) {
                        "Firebase ID token is unavailable"
                    }
                }
            },
            projectIdProvider = FirebaseProjectIdProvider {
                checkNotNull(firebaseApp.options.projectId) { "Firebase projectId is unavailable" }
            },
        )
    }
}

private class HttpUrlConnectionJsonPostTransport : FirebaseJsonPostTransport {
    override suspend fun post(
        url: String,
        bearerToken: String,
        body: JsonObject,
    ): JsonObject = withContext(Dispatchers.IO) {
        val connection = URL(url).openConnection() as HttpURLConnection
        try {
            connection.requestMethod = "POST"
            connection.connectTimeout = CONNECT_TIMEOUT_MILLIS
            connection.readTimeout = READ_TIMEOUT_MILLIS
            connection.doOutput = true
            connection.setRequestProperty("Authorization", "Bearer $bearerToken")
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
            connection.outputStream.bufferedWriter(Charsets.UTF_8).use { writer ->
                writer.write(body.toString())
            }

            val statusCode = connection.responseCode
            val stream = if (statusCode in 200..299) connection.inputStream else connection.errorStream
            val responseBody = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
            if (statusCode !in 200..299) {
                throw AuthenticatedFunctionException(statusCode = statusCode, responseBody = responseBody)
            }
            if (responseBody.isBlank()) {
                JsonObject(emptyMap())
            } else {
                Json.parseToJsonElement(responseBody).jsonObject
            }
        } finally {
            connection.disconnect()
        }
    }

    private companion object {
        const val CONNECT_TIMEOUT_MILLIS = 10_000
        const val READ_TIMEOUT_MILLIS = 15_000
    }
}
