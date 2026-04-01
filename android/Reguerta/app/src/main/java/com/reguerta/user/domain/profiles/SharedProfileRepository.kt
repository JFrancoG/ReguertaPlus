package com.reguerta.user.domain.profiles

interface SharedProfileRepository {
    suspend fun getAllSharedProfiles(): List<SharedProfile>

    suspend fun getSharedProfile(userId: String): SharedProfile?

    suspend fun upsertSharedProfile(profile: SharedProfile): SharedProfile

    suspend fun deleteSharedProfile(userId: String): Boolean
}
