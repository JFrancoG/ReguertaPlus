package com.reguerta.user.domain.startup

enum class StartupPlatform(val wireKey: String) {
    ANDROID("android"),
    IOS("ios"),
}

data class StartupVersionPolicy(
    val currentVersion: String,
    val minimumVersion: String,
    val forceUpdate: Boolean,
    val storeUrl: String,
)

sealed interface StartupVersionGateDecision {
    data object Allow : StartupVersionGateDecision

    data class OptionalUpdate(val storeUrl: String) : StartupVersionGateDecision

    data class ForcedUpdate(val storeUrl: String) : StartupVersionGateDecision
}

interface StartupVersionPolicyRepository {
    suspend fun getPolicy(platform: StartupPlatform): StartupVersionPolicy?
}
