package com.reguerta.user.domain.profiles

data class SharedProfile(
    val userId: String,
    val familyNames: String,
    val photoUrl: String?,
    val about: String,
    val updatedAtMillis: Long,
) {
    val hasVisibleContent: Boolean
        get() = familyNames.isNotBlank() || !photoUrl.isNullOrBlank() || about.isNotBlank()
}
