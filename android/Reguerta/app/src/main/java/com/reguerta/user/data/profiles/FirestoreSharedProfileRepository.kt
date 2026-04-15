package com.reguerta.user.data.profiles

import com.google.android.gms.tasks.Tasks
import com.google.firebase.Timestamp
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import com.reguerta.user.data.firestore.ReguertaFirestoreCollection
import com.reguerta.user.data.firestore.ReguertaFirestoreEnvironment
import com.reguerta.user.data.firestore.ReguertaFirestorePath
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
        runCatching {
            val snapshot = Tasks.await(
                firestore.collection(profilesCollectionPath).get(),
            )
            snapshot.documents
                .mapNotNull { it.toSharedProfile() }
                .sortedByDescending { it.updatedAtMillis }
        }.getOrDefault(emptyList())
    }

    override suspend fun getSharedProfile(userId: String): SharedProfile? = withContext(Dispatchers.IO) {
        runCatching {
            val snapshot = Tasks.await(
                firestore.collection(profilesCollectionPath)
                    .document(userId)
                    .get(),
            )
            snapshot.toSharedProfile()
        }.getOrNull()
    }

    override suspend fun upsertSharedProfile(profile: SharedProfile): SharedProfile = withContext(Dispatchers.IO) {
        val payload = mutableMapOf<String, Any>(
            "userId" to profile.userId,
            "familyNames" to profile.familyNames,
            "about" to profile.about,
            "updatedAt" to Timestamp(
                profile.updatedAtMillis / 1_000,
                ((profile.updatedAtMillis % 1_000) * 1_000_000).toInt(),
            ),
        )
        profile.photoUrl?.let { payload["photoUrl"] = it }

        runCatching {
            Tasks.await(
                firestore.collection(profilesCollectionPath)
                    .document(profile.userId)
                    .set(payload, SetOptions.merge()),
            )
            profile
        }.getOrDefault(profile)
    }

    override suspend fun deleteSharedProfile(userId: String): Boolean = withContext(Dispatchers.IO) {
        runCatching {
            Tasks.await(
                firestore.collection(profilesCollectionPath)
                    .document(userId)
                    .delete(),
            )
            true
        }.getOrDefault(false)
    }
}

private fun com.google.firebase.firestore.DocumentSnapshot.toSharedProfile(): SharedProfile? {
    if (!exists()) {
        return null
    }

    val userId = getString("userId")?.trim()?.ifBlank { null } ?: id
    return SharedProfile(
        userId = userId,
        familyNames = getString("familyNames")?.trim().orEmpty(),
        photoUrl = getString("photoUrl")?.trim()?.ifBlank { null },
        about = getString("about")?.trim().orEmpty(),
        updatedAtMillis = getTimestamp("updatedAt")?.toDate()?.time ?: 0L,
    )
}
