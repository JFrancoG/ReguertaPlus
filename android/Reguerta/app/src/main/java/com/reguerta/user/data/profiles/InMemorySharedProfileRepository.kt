package com.reguerta.user.data.profiles

import com.reguerta.user.domain.profiles.SharedProfile
import com.reguerta.user.domain.profiles.SharedProfileRepository
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

class InMemorySharedProfileRepository : SharedProfileRepository {
    private val mutex = Mutex()
    private val profiles = mutableMapOf(
        "member_admin_001" to SharedProfile(
            userId = "member_admin_001",
            familyNames = "Ana, Mario y Leo",
            photoUrl = null,
            about = "Nos encanta la verdura de temporada y venir a recoger los pedidos en familia.",
            updatedAtMillis = 1_742_800_000_000,
        ),
        "member_member_001" to SharedProfile(
            userId = "member_member_001",
            familyNames = "Marta y Alba",
            photoUrl = null,
            about = "Somos nuevas en la comunidad y nos apuntamos para aprender a comer mejor.",
            updatedAtMillis = 1_742_860_000_000,
        ),
    )

    override suspend fun getAllSharedProfiles(): List<SharedProfile> = mutex.withLock {
        profiles.values.sortedByDescending { it.updatedAtMillis }
    }

    override suspend fun getSharedProfile(userId: String): SharedProfile? = mutex.withLock {
        profiles[userId]
    }

    override suspend fun upsertSharedProfile(profile: SharedProfile): SharedProfile = mutex.withLock {
        profiles[profile.userId] = profile
        profile
    }

    override suspend fun deleteSharedProfile(userId: String): Boolean = mutex.withLock {
        profiles.remove(userId) != null
    }
}
