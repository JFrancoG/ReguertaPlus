package com.reguerta.user.data.access

import com.reguerta.user.domain.access.EcoCommitmentMode
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.access.MemberAdministrationRepository
import com.reguerta.user.domain.access.MemberManagementException
import com.reguerta.user.domain.access.MemberRole
import com.reguerta.user.domain.access.ProducerParity
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

internal class FirebaseMemberAdministrationRepository(
    private val functionCaller: AuthenticatedFunctionCaller,
    private val requestedEnvironment: () -> String,
) : MemberAdministrationRepository {
    override suspend fun upsertMember(member: Member): Member {
        try {
            functionCaller.post(
                functionName = UPSERT_MEMBER_BY_ADMIN_FUNCTION,
                body = member.toFunctionBody(environment = requestedEnvironment()),
            )
        } catch (error: AuthenticatedFunctionException) {
            when (error.statusCode) {
                401, 403 -> throw MemberManagementException.AccessDenied
                409 -> when (error.functionErrorCode()) {
                    "last_active_admin" -> throw MemberManagementException.LastAdminRemoval
                    else -> throw MemberManagementException.Conflict
                }
                else -> throw error
            }
        }
        return member
    }

    private companion object {
        const val UPSERT_MEMBER_BY_ADMIN_FUNCTION = "upsertMemberByAdmin"
    }
}

private fun Member.toFunctionBody(environment: String) = buildJsonObject {
    put("env", environment)
    put("memberId", id)
    put("displayName", displayName)
    put("companyName", companyName?.let(::JsonPrimitive) ?: JsonNull)
    put("phoneNumber", phoneNumber?.let(::JsonPrimitive) ?: JsonNull)
    put("normalizedEmail", normalizedEmail)
    put(
        "roles",
        JsonArray(roles.sortedBy(MemberRole::name).map { role -> JsonPrimitive(role.wireValue()) }),
    )
    put("isActive", isActive)
    put("producerCatalogEnabled", producerCatalogEnabled)
    put("isCommonPurchaseManager", isCommonPurchaseManager)
    put("producerParity", producerParity?.wireValue()?.let(::JsonPrimitive) ?: JsonNull)
    put("ecoCommitmentMode", ecoCommitmentMode.wireValue())
    put("ecoCommitmentParity", ecoCommitmentParity?.wireValue()?.let(::JsonPrimitive) ?: JsonNull)
}

private fun MemberRole.wireValue(): String = when (this) {
    MemberRole.MEMBER -> "member"
    MemberRole.PRODUCER -> "producer"
    MemberRole.ADMIN -> "admin"
}

private fun ProducerParity.wireValue(): String = when (this) {
    ProducerParity.EVEN -> "even"
    ProducerParity.ODD -> "odd"
}

private fun EcoCommitmentMode.wireValue(): String = when (this) {
    EcoCommitmentMode.WEEKLY -> "weekly"
    EcoCommitmentMode.BIWEEKLY -> "biweekly"
}
