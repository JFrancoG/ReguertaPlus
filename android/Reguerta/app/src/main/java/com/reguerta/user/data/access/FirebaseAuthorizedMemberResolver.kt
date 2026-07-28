package com.reguerta.user.data.access

import com.reguerta.user.domain.access.AuthorizedMemberResolution
import com.reguerta.user.domain.access.AuthorizedMemberResolver
import com.reguerta.user.domain.access.MemberRole
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

internal class FirebaseAuthorizedMemberResolver(
    private val functionCaller: AuthenticatedFunctionCaller,
    private val requestedEnvironment: () -> String,
) : AuthorizedMemberResolver {
    override suspend fun resolve(): AuthorizedMemberResolution {
        val response = try {
            functionCaller.post(
                functionName = RESOLVE_AUTHORIZED_MEMBER_FUNCTION,
                body = buildJsonObject {
                    put("env", requestedEnvironment())
                },
            )
        } catch (error: AuthenticatedFunctionException) {
            if (error.statusCode == 401 || error.statusCode == 403) {
                val errorCode = error.functionErrorCode()
                return AuthorizedMemberResolution.Unauthorized(
                    isActive = if (errorCode == "inactive_member") false else null,
                    emailVerificationRequired = errorCode == "verified_email_required" ||
                        errorCode == "email_not_verified",
                )
            }
            throw error
        }
        val authorized = response.boolean("authorized") ?: false
        val isActive = response.boolean("isActive")
        if (!authorized) {
            return AuthorizedMemberResolution.Unauthorized(isActive = isActive)
        }

        val memberId = requireNotNull(response.string("memberId")) {
            "resolveAuthorizedMember response is missing memberId"
        }
        val environment = requireNotNull(response.string("environment")) {
            "resolveAuthorizedMember response is missing environment"
        }
        val roles = response["roles"]
            ?.jsonArray
            ?.mapNotNull { element -> element.jsonPrimitive.contentOrNull.toMemberRoleOrNull() }
            ?.toSet()
            .orEmpty()
        return AuthorizedMemberResolution.Authorized(
            memberId = memberId,
            roles = roles,
            isActive = isActive == true,
            environment = environment,
            firstLoginLinked = response.boolean("firstLoginLinked") == true,
        )
    }

    private companion object {
        const val RESOLVE_AUTHORIZED_MEMBER_FUNCTION = "resolveAuthorizedMember"
    }
}

private fun JsonObject.string(key: String): String? =
    get(key)?.jsonPrimitive?.contentOrNull?.trim()?.takeIf(String::isNotBlank)

private fun JsonObject.boolean(key: String): Boolean? =
    get(key)?.jsonPrimitive?.booleanOrNull

private fun String?.toMemberRoleOrNull(): MemberRole? = when (this?.trim()?.lowercase()) {
    "member" -> MemberRole.MEMBER
    "producer" -> MemberRole.PRODUCER
    "admin" -> MemberRole.ADMIN
    else -> null
}
