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
    val producerParity: ProducerParity? = null,
    val ecoCommitmentMode: EcoCommitmentMode = EcoCommitmentMode.WEEKLY,
    val ecoCommitmentParity: ProducerParity? = null,
) {
    val isAdmin: Boolean
        get() = roles.contains(MemberRole.ADMIN)
}

enum class ProducerParity {
    EVEN,
    ODD,
}

enum class EcoCommitmentMode {
    WEEKLY,
    BIWEEKLY,
}
