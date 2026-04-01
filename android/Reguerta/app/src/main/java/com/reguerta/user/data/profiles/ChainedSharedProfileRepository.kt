package com.reguerta.user.data.profiles

import com.reguerta.user.domain.profiles.SharedProfile
import com.reguerta.user.domain.profiles.SharedProfileRepository

class ChainedSharedProfileRepository(
    private val primary: SharedProfileRepository,
    private val fallback: SharedProfileRepository,
) : SharedProfileRepository {
    override suspend fun getAllSharedProfiles(): List<SharedProfile> {
        val primaryProfiles = primary.getAllSharedProfiles()
        return if (primaryProfiles.isNotEmpty()) {
            primaryProfiles
        } else {
            fallback.getAllSharedProfiles()
        }
    }

    override suspend fun getSharedProfile(userId: String): SharedProfile? =
        primary.getSharedProfile(userId) ?: fallback.getSharedProfile(userId)

    override suspend fun upsertSharedProfile(profile: SharedProfile): SharedProfile =
        primary.upsertSharedProfile(profile)

    override suspend fun deleteSharedProfile(userId: String): Boolean =
        primary.deleteSharedProfile(userId)
}
