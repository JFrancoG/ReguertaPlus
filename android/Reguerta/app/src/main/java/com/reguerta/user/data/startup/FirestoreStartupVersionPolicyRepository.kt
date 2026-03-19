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
    private val environment: ReguertaFirestoreEnvironment = ReguertaFirestoreEnvironment.DEVELOP,
) : StartupVersionPolicyRepository {
    private val firestorePath = ReguertaFirestorePath(environment = environment)

    private val globalConfigDocumentPath: String
        get() = firestorePath.documentPath(
            collection = ReguertaFirestoreCollection.CONFIG,
            documentId = ReguertaFirestoreDocument.GLOBAL.wireValue,
        )

    override suspend fun getPolicy(platform: StartupPlatform): StartupVersionPolicy? = withContext(Dispatchers.IO) {
        runCatching {
            val snapshot = Tasks.await(
                firestore.document(globalConfigDocumentPath).get(),
            )

            val versions = snapshot.get("versions") as? Map<*, *> ?: return@runCatching null
            val platformPolicy = versions[platform.wireKey] as? Map<*, *> ?: return@runCatching null

            val currentVersion = platformPolicy["current"].asRequiredString() ?: return@runCatching null
            val minimumVersion = platformPolicy["min"].asRequiredString() ?: return@runCatching null
            val storeUrl = platformPolicy["storeUrl"].asRequiredString() ?: return@runCatching null
            val forceUpdate = platformPolicy["forceUpdate"] as? Boolean ?: return@runCatching null

            StartupVersionPolicy(
                currentVersion = currentVersion,
                minimumVersion = minimumVersion,
                forceUpdate = forceUpdate,
                storeUrl = storeUrl,
            )
        }.getOrNull()
    }
}

private fun Any?.asRequiredString(): String? {
    val raw = this as? String ?: return null
    val value = raw.trim()
    return value.takeIf { it.isNotEmpty() }
}
