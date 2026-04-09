package com.reguerta.user.data.commitments

import com.reguerta.user.domain.commitments.SeasonalCommitment
import com.reguerta.user.domain.commitments.SeasonalCommitmentRepository

class ChainedSeasonalCommitmentRepository(
    private val primary: SeasonalCommitmentRepository,
    private val fallback: SeasonalCommitmentRepository,
) : SeasonalCommitmentRepository {
    override suspend fun getActiveCommitmentsForUser(userId: String): List<SeasonalCommitment> {
        val primaryCommitments = primary.getActiveCommitmentsForUser(userId)
        return if (primaryCommitments.isNotEmpty()) primaryCommitments else fallback.getActiveCommitmentsForUser(userId)
    }
}
