package com.reguerta.user.data.startup

import com.google.android.gms.tasks.Tasks
import com.google.firebase.firestore.FirebaseFirestore
import com.reguerta.user.data.firestore.ReguertaFirestoreCollection
import com.reguerta.user.data.firestore.ReguertaFirestoreDocument
import com.reguerta.user.data.firestore.ReguertaFirestoreEnvironment
import com.reguerta.user.data.firestore.ReguertaFirestorePath
import com.reguerta.user.domain.startup.StartupPlatform
import com.reguerta.user.domain.startup.StartupVersionPolicy
import com.reguerta.user.domain.startup.StartupVersionPolicyRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class FirestoreStartupVersionPolicyRepository(
    private val firestore: FirebaseFirestore,
    private val environment: ReguertaFirestoreEnvironment? = null,
) : StartupVersionPolicyRepository {
    private val firestorePath = ReguertaFirestorePath(environment = environment)

    private val publicConfigDocumentPath: String
        get() = firestorePath.documentPath(
            collection = ReguertaFirestoreCollection.CONFIG,
            documentId = ReguertaFirestoreDocument.PUBLIC.wireValue,
        )

    override suspend fun getPolicy(platform: StartupPlatform): StartupVersionPolicy? = withContext(Dispatchers.IO) {
        val snapshot = Tasks.await(
            firestore.document(publicConfigDocumentPath).get(),
        )

        val versions = snapshot.get("versions") as? Map<*, *> ?: return@withContext null
        val platformPolicy = versions[platform.wireKey] as? Map<*, *> ?: return@withContext null

        val currentVersion = platformPolicy["current"].asRequiredString() ?: return@withContext null
        val minimumVersion = platformPolicy["min"].asRequiredString() ?: return@withContext null
        val storeUrl = platformPolicy["storeUrl"].asRequiredString() ?: return@withContext null
        val forceUpdate = platformPolicy["forceUpdate"] as? Boolean ?: return@withContext null

        StartupVersionPolicy(
            currentVersion = currentVersion,
            minimumVersion = minimumVersion,
            forceUpdate = forceUpdate,
            storeUrl = storeUrl,
        )
    }
}

private fun Any?.asRequiredString(): String? {
    val raw = this as? String ?: return null
    val value = raw.trim()
    return value.takeIf { it.isNotEmpty() }
}
