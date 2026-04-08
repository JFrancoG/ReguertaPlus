package com.reguerta.user.presentation.access

import com.reguerta.user.domain.access.AuthPrincipal
import com.reguerta.user.domain.access.UnauthorizedReason

internal fun shouldRefreshCriticalDataFor(
    currentMode: SessionMode,
    principal: AuthPrincipal,
): Boolean = when (currentMode) {
    SessionMode.SignedOut -> true
    is SessionMode.Unauthorized -> currentMode.email != principal.email
    is SessionMode.Authorized -> currentMode.principal.uid != principal.uid
}

internal fun shouldShowUnauthorizedDialog(
    currentMode: SessionMode,
    email: String,
    reason: UnauthorizedReason,
): Boolean {
    if (reason != UnauthorizedReason.USER_NOT_FOUND_IN_AUTHORIZED_USERS) {
        return false
    }
    return currentMode !is SessionMode.Unauthorized || currentMode.email != email
}
