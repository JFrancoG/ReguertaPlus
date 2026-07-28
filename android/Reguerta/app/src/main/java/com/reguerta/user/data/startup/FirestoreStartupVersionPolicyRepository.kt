package com.reguerta.user.data.startup

import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Source
import com.reguerta.user.data.firestore.ReguertaFirestoreCollection
import com.reguerta.user.data.firestore.ReguertaFirestoreDocument
import com.reguerta.user.data.firestore.ReguertaFirestoreEnvironment
import com.reguerta.user.data.firestore.ReguertaFirestorePath
import com.reguerta.user.data.firestore.toRepositoryException
import com.reguerta.user.domain.RepositoryErrorKind
import com.reguerta.user.domain.RepositoryException
import com.reguerta.user.domain.startup.StartupPlatform
import com.reguerta.user.domain.startup.StartupVersionPolicy
import com.reguerta.user.domain.startup.StartupVersionPolicyRepository
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.tasks.await

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

    override suspend fun getPolicy(platform: StartupPlatform): StartupVersionPolicy {
        try {
            val snapshot = firestore.document(publicConfigDocumentPath).get(Source.SERVER).await()
            if (!snapshot.exists()) {
                throw RepositoryException(
                    kind = RepositoryErrorKind.NOT_FOUND,
                    resource = STARTUP_VERSION_POLICY_RESOURCE,
                )
            }

            val versions = snapshot.get("versions") as? Map<*, *>
                ?: throw invalidStartupVersionPolicy()
            val platformPolicy = versions[platform.wireKey] as? Map<*, *>
                ?: throw invalidStartupVersionPolicy()

            val currentVersion = platformPolicy["current"].asRequiredString()
                ?: throw invalidStartupVersionPolicy()
            val minimumVersion = platformPolicy["min"].asRequiredString()
                ?: throw invalidStartupVersionPolicy()
            val storeUrl = platformPolicy["storeUrl"].asRequiredString()
                ?: throw invalidStartupVersionPolicy()
            val forceUpdate = platformPolicy["forceUpdate"] as? Boolean
                ?: throw invalidStartupVersionPolicy()

            return StartupVersionPolicy(
                currentVersion = currentVersion,
                minimumVersion = minimumVersion,
                forceUpdate = forceUpdate,
                storeUrl = storeUrl,
            )
        } catch (error: CancellationException) {
            throw error
        } catch (error: Exception) {
            throw error.toRepositoryException(resource = STARTUP_VERSION_POLICY_RESOURCE)
        }
    }
}

private const val STARTUP_VERSION_POLICY_RESOURCE = "config.public.versions"

private fun invalidStartupVersionPolicy() = RepositoryException(
    kind = RepositoryErrorKind.INVALID_DATA,
    resource = STARTUP_VERSION_POLICY_RESOURCE,
)

private fun Any?.asRequiredString(): String? {
    val raw = this as? String ?: return null
    val value = raw.trim()
    return value.takeIf { it.isNotEmpty() }
}
