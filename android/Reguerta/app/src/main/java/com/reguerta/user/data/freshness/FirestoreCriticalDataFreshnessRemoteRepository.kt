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
    private val environment: ReguertaFirestoreEnvironment = ReguertaFirestoreEnvironment.DEVELOP,
) : CriticalDataFreshnessRemoteRepository {
    private val firestorePath = ReguertaFirestorePath(environment = environment)

    private val globalConfigDocumentPath: String
        get() = firestorePath.documentPath(
            collection = ReguertaFirestoreCollection.CONFIG,
            documentId = ReguertaFirestoreDocument.GLOBAL.wireValue,
        )

    override suspend fun getConfig(): CriticalDataFreshnessConfig? = withContext(Dispatchers.IO) {
        runCatching {
            val snapshot = Tasks.await(
                firestore.document(globalConfigDocumentPath).get(),
            )
            val cacheExpirationMinutes = snapshot.getLong("cacheExpirationMinutes")?.toInt()
                ?: return@runCatching null
            val timestampMap = snapshot.get("lastTimestamps") as? Map<*, *> ?: return@runCatching null
            val remoteTimestamps = CriticalCollection.entries.associateWith { collection ->
                val rawValue = timestampMap[collection.wireKey]
                when (rawValue) {
                    is Timestamp -> rawValue.toDate().time
                    is java.util.Date -> rawValue.time
                    else -> return@runCatching null
                }
            }

            CriticalDataFreshnessConfig(
                cacheExpirationMinutes = cacheExpirationMinutes,
                remoteTimestampsMillis = remoteTimestamps,
            )
        }.getOrNull()
    }
}
