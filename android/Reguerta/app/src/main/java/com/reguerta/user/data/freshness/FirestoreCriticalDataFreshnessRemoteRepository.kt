package com.reguerta.user.data.freshness

import com.google.android.gms.tasks.Tasks
import com.google.firebase.Timestamp
import com.google.firebase.firestore.FirebaseFirestore
import com.reguerta.user.data.firestore.ReguertaFirestoreCollection
import com.reguerta.user.data.firestore.ReguertaFirestoreDocument
import com.reguerta.user.data.firestore.ReguertaFirestoreEnvironment
import com.reguerta.user.data.firestore.ReguertaFirestorePath
import com.reguerta.user.domain.freshness.CriticalCollection
import com.reguerta.user.domain.freshness.CriticalDataFreshnessConfig
import com.reguerta.user.domain.freshness.CriticalDataFreshnessRemoteRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class FirestoreCriticalDataFreshnessRemoteRepository(
    private val firestore: FirebaseFirestore,
    private val environment: ReguertaFirestoreEnvironment? = null,
) : CriticalDataFreshnessRemoteRepository {
    private val firestorePath = ReguertaFirestorePath(environment = environment)

    private val memberConfigDocumentPath: String
        get() = firestorePath.documentPath(
            collection = ReguertaFirestoreCollection.CONFIG,
            documentId = ReguertaFirestoreDocument.MEMBER.wireValue,
        )

    override suspend fun getConfig(): CriticalDataFreshnessConfig? = withContext(Dispatchers.IO) {
        val snapshot = Tasks.await(
            firestore.document(memberConfigDocumentPath).get(),
        )
        val cacheExpirationMinutes = snapshot.getLong("cacheExpirationMinutes")?.toInt()
            ?: return@withContext null
        val timestampMap = snapshot.get("lastTimestamps") as? Map<*, *> ?: return@withContext null
        val remoteTimestamps = CriticalCollection.entries.associateWith { collection ->
            val rawValue = timestampMap[collection.wireKey]
            when (rawValue) {
                is Timestamp -> rawValue.toDate().time
                is java.util.Date -> rawValue.time
                else -> return@withContext null
            }
        }

        CriticalDataFreshnessConfig(
            cacheExpirationMinutes = cacheExpirationMinutes,
            remoteTimestampsMillis = remoteTimestamps,
        )
    }
}
