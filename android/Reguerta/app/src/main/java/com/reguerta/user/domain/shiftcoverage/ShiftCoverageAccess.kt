package com.reguerta.user.domain.shiftcoverage

import kotlinx.serialization.Serializable

@Serializable
internal data class ShiftCoverageAccess(
    val schemaVersion: Int,
    val environment: String,
    val memberId: String,
    val enabled: Boolean,
    val policyRevision: String?,
)
