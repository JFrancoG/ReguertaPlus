package com.reguerta.user.domain.commitments

interface SeasonalCommitmentRepository {
    suspend fun getActiveCommitmentsForUser(userId: String): List<SeasonalCommitment>
}
