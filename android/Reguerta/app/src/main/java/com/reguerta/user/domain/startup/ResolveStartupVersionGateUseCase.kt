package com.reguerta.user.domain.startup

class ResolveStartupVersionGateUseCase(
    private val repository: StartupVersionPolicyRepository,
) {
    suspend operator fun invoke(
        platform: StartupPlatform,
        installedVersion: String,
    ): StartupVersionGateDecision {
        val policy = repository.getPolicy(platform) ?: return StartupVersionGateDecision.Allow
        return evaluate(installedVersion = installedVersion, policy = policy)
    }

    fun evaluate(
        installedVersion: String,
        policy: StartupVersionPolicy,
    ): StartupVersionGateDecision {
        if (policy.storeUrl.isBlank()) {
            return StartupVersionGateDecision.Allow
        }

        val comparisonToMinimum = SemanticVersionComparator.compare(installedVersion, policy.minimumVersion)
            ?: return StartupVersionGateDecision.Allow
        val comparisonToCurrent = SemanticVersionComparator.compare(installedVersion, policy.currentVersion)
            ?: return StartupVersionGateDecision.Allow

        return when {
            comparisonToMinimum < 0 && policy.forceUpdate ->
                StartupVersionGateDecision.ForcedUpdate(storeUrl = policy.storeUrl)

            comparisonToMinimum < 0 || comparisonToCurrent < 0 ->
                StartupVersionGateDecision.OptionalUpdate(storeUrl = policy.storeUrl)

            else -> StartupVersionGateDecision.Allow
        }
    }
}
