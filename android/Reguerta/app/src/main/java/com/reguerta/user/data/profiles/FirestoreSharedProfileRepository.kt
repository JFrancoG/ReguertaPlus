package com.reguerta.user.data.profiles

import com.google.android.gms.tasks.Tasks
import com.google.firebase.Timestamp
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import com.reguerta.user.data.firestore.ReguertaFirestoreCollection
import com.reguerta.user.data.firestore.ReguertaFirestoreEnvironment
import com.reguerta.user.data.firestore.ReguertaFirestorePath
import com.reguerta.user.data.firestore.toRepositoryException
import com.reguerta.user.domain.RepositoryErrorKind
import com.reguerta.user.domain.RepositoryException
import com.reguerta.user.domain.profiles.SharedProfile
import com.reguerta.user.domain.profiles.SharedProfileRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class FirestoreSharedProfileRepository(
    private val firestore: FirebaseFirestore,
    private val environment: ReguertaFirestoreEnvironment? = null,
) : SharedProfileRepository {
    private val firestorePath = ReguertaFirestorePath(environment = environment)

    private val profilesCollectionPath: String
        get() = firestorePath.collectionPath(ReguertaFirestoreCollection.SHARED_PROFILES)

    override suspend fun getAllSharedProfiles(): List<SharedProfile> = withContext(Dispatchers.IO) {
        try {
            val snapshot = Tasks.await(firestore.collection(profilesCollectionPath).get())
            snapshot.documents
                .map { document ->
                    val data: Map<String, Any> = document.data ?: invalidSharedProfileDocument()
                    decodeSharedProfileDocument(document.id, data)
                }
                .sortedByDescending(SharedProfile::updatedAtMillis)
        } catch (error: Exception) {
            throw error.toRepositoryException(resource = "sharedProfiles")
        }
    }

    override suspend fun getSharedProfile(userId: String): SharedProfile? = withContext(Dispatchers.IO) {
        try {
            val snapshot = Tasks.await(
                firestore.collection(profilesCollectionPath)
                    .document(userId)
                    .get(),
            )
            if (!snapshot.exists()) {
                null
            } else {
                val data: Map<String, Any> = snapshot.data ?: invalidSharedProfileDocument()
                decodeSharedProfileDocument(snapshot.id, data)
            }
        } catch (error: Exception) {
            throw error.toRepositoryException(resource = "sharedProfiles.document")
        }
    }

    override suspend fun upsertSharedProfile(profile: SharedProfile): SharedProfile = withContext(Dispatchers.IO) {
        try {
            Tasks.await(
                firestore.collection(profilesCollectionPath)
                    .document(profile.userId)
                    .set(sharedProfileUpsertPayload(profile), SetOptions.merge()),
            )
            profile
        } catch (error: Exception) {
            throw error.toRepositoryException(resource = "sharedProfiles.write")
        }
    }

    override suspend fun deleteSharedProfile(userId: String): Boolean = withContext(Dispatchers.IO) {
        try {
            Tasks.await(
                firestore.collection(profilesCollectionPath)
                    .document(userId)
                    .delete(),
            )
            true
        } catch (error: Exception) {
            throw error.toRepositoryException(resource = "sharedProfiles.write")
        }
    }
}

internal fun sharedProfileUpsertPayload(profile: SharedProfile): Map<String, Any> = mapOf(
    "userId" to profile.userId,
    "familyNames" to profile.familyNames,
    "photoUrl" to (profile.photoUrl ?: FieldValue.delete()),
    "about" to profile.about,
    "updatedAt" to Timestamp(
        profile.updatedAtMillis / 1_000,
        ((profile.updatedAtMillis % 1_000) * 1_000_000).toInt(),
    ),
)

internal fun decodeSharedProfileDocument(
    documentId: String,
    data: Map<String, Any?>,
): SharedProfile {
    val normalizedDocumentId = documentId.trim()
    if (normalizedDocumentId.isBlank() ||
        data.requiredString("userId") != normalizedDocumentId
    ) {
        invalidSharedProfileDocument()
    }
    val updatedAt = data["updatedAt"] as? Timestamp ?: invalidSharedProfileDocument()
    return SharedProfile(
        userId = normalizedDocumentId,
        familyNames = data.optionalString("familyNames").orEmpty(),
        photoUrl = data.optionalString("photoUrl"),
        about = data.optionalString("about").orEmpty(),
        updatedAtMillis = updatedAt.toDate().time,
    )
}

private fun Map<String, Any?>.requiredString(field: String): String =
    optionalString(field) ?: invalidSharedProfileDocument()

private fun Map<String, Any?>.optionalString(field: String): String? {
    val rawValue = this[field] ?: return null
    val value = rawValue as? String ?: invalidSharedProfileDocument()
    return value.trim().ifBlank { null }
}

private fun invalidSharedProfileDocument(): Nothing = throw RepositoryException(
    kind = RepositoryErrorKind.INVALID_DATA,
    resource = "sharedProfiles.document",
)
