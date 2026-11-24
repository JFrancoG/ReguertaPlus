package com.reguerta.user.presentation.shiftcoverage

import com.reguerta.user.domain.shiftcoverage.ShiftCoverageSession
import com.reguerta.user.presentation.root.SessionMode
import com.reguerta.user.presentation.root.SessionUiState

/** Coverage never translates a developer impersonation into backend actor identity. */
internal fun SessionUiState.coverageSession(): ShiftCoverageSession? {
    val authorized = mode as? SessionMode.Authorized ?: return null
    val environment = sessionEnvironment?.takeIf { it in setOf("develop", "production") } ?: return null
    if (authorized.member.id != authorized.authenticatedMember.id || !authorized.authenticatedMember.isActive ||
        !authorized.member.isActive || authorized.authenticatedMember.authUid != authorized.principal.uid) return null
    return ShiftCoverageSession(authorized.principal.uid, authorized.authenticatedMember.id, sessionEpoch, environment,
        ShiftCoverageSession.Authorization(authorized.authenticatedMember.roles.toSet(), authorized.authenticatedMember.isCommonPurchaseManager))
}
