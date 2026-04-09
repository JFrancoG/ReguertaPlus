package com.reguerta.user.data.commitments

import com.reguerta.user.domain.commitments.SeasonalCommitment
import com.reguerta.user.domain.commitments.SeasonalCommitmentRepository
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

class InMemorySeasonalCommitmentRepository(
    items: List<SeasonalCommitment> = emptyList(),
) : SeasonalCommitmentRepository {
    private val mutex = Mutex()
    private val commitments = items.associateBy { it.id }.toMutableMap()

    override suspend fun getActiveCommitmentsForUser(userId: String): List<SeasonalCommitment> = mutex.withLock {
        commitments.values
            .filter { it.userId == userId && it.active }
            .sortedWith(compareBy<SeasonalCommitment> { it.seasonKey }.thenBy { it.productId })
    }
}
