package com.reguerta.user.domain.commitments

data class SeasonalCommitment(
    val id: String,
    val userId: String,
    val productId: String,
    val seasonKey: String,
    val fixedQtyPerOfferedWeek: Double,
    val active: Boolean,
    val createdAtMillis: Long,
    val updatedAtMillis: Long,
)
