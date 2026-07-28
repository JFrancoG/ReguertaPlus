package com.reguerta.user.data.freshness

import com.google.firebase.Timestamp
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Source
import com.reguerta.user.data.firestore.ReguertaFirestoreCollection
import com.reguerta.user.data.firestore.ReguertaFirestoreDocument
import com.reguerta.user.data.firestore.ReguertaFirestoreEnvironment
import com.reguerta.user.data.firestore.ReguertaFirestorePath
import com.reguerta.user.data.firestore.toRepositoryException
import com.reguerta.user.domain.RepositoryErrorKind
import com.reguerta.user.domain.RepositoryException
import com.reguerta.user.domain.freshness.CriticalCollection
import com.reguerta.user.domain.freshness.CriticalDataFreshnessConfig
import com.reguerta.user.domain.freshness.CriticalDataFreshnessRemoteRepository
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.tasks.await

class FirestoreCriticalDataFreshnessRemoteRepository(
    private val firestore: FirebaseFirestore,
) : CriticalDataFreshnessRemoteRepository {
    override suspend fun getConfig(environment: String): CriticalDataFreshnessConfig {
        val resolvedEnvironment = ReguertaFirestoreEnvironment.entries.firstOrNull { candidate ->
            candidate.wireValue == environment
        } ?: throw invalidCriticalDataFreshnessConfig()
        val memberConfigDocumentPath = ReguertaFirestorePath(environment = resolvedEnvironment).documentPath(
            collection = ReguertaFirestoreCollection.CONFIG,
            documentId = ReguertaFirestoreDocument.MEMBER.wireValue,
        )
        try {
            val snapshot = firestore.document(memberConfigDocumentPath).get(Source.SERVER).await()
            if (!snapshot.exists()) {
                throw RepositoryException(
                    kind = RepositoryErrorKind.NOT_FOUND,
                    resource = CRITICAL_DATA_FRESHNESS_RESOURCE,
                )
            }

            val cacheExpiration = snapshot.getLong("cacheExpirationMinutes")
                ?.takeIf { it in 1..Int.MAX_VALUE.toLong() }
                ?: throw invalidCriticalDataFreshnessConfig()
            val timestampMap = snapshot.get("lastTimestamps") as? Map<*, *>
                ?: throw invalidCriticalDataFreshnessConfig()
            val remoteTimestamps = CriticalCollection.entries.associateWith { collection ->
                val timestampMillis = when (val rawValue = timestampMap[collection.wireKey]) {
                    is Timestamp -> rawValue.toDate().time
                    is java.util.Date -> rawValue.time
                    else -> throw invalidCriticalDataFreshnessConfig()
                }
                timestampMillis.takeIf { it > 0L }
                    ?: throw invalidCriticalDataFreshnessConfig()
            }

            return CriticalDataFreshnessConfig(
                cacheExpirationMinutes = cacheExpiration.toInt(),
                remoteTimestampsMillis = remoteTimestamps,
            )
        } catch (error: CancellationException) {
            throw error
        } catch (error: Exception) {
            throw error.toRepositoryException(resource = CRITICAL_DATA_FRESHNESS_RESOURCE)
        }
    }
}

private const val CRITICAL_DATA_FRESHNESS_RESOURCE = "config.member.freshness"

private fun invalidCriticalDataFreshnessConfig() = RepositoryException(
    kind = RepositoryErrorKind.INVALID_DATA,
    resource = CRITICAL_DATA_FRESHNESS_RESOURCE,
)
