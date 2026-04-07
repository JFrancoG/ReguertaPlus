package com.reguerta.user.domain.access

data class Member(
    val id: String,
    val displayName: String,
    val normalizedEmail: String,
    val authUid: String?,
    val roles: Set<MemberRole>,
    val isActive: Boolean,
    val producerCatalogEnabled: Boolean,
    val isCommonPurchaseManager: Boolean = false,
) {
    val isAdmin: Boolean
        get() = roles.contains(MemberRole.ADMIN)
}
