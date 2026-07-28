package com.reguerta.user.domain.startup

import com.reguerta.user.domain.RepositoryErrorKind
import com.reguerta.user.domain.RepositoryException
import java.net.URI

class ResolveStartupVersionGateUseCase(
    private val repository: StartupVersionPolicyRepository,
) {
    suspend operator fun invoke(
        platform: StartupPlatform,
        installedVersion: String,
    ): StartupVersionGateDecision {
        val policy = repository.getPolicy(platform)
        return evaluate(installedVersion = installedVersion, policy = policy)
    }

    fun evaluate(
        installedVersion: String,
        policy: StartupVersionPolicy,
    ): StartupVersionGateDecision {
        val comparisonToMinimum = SemanticVersionComparator.compare(installedVersion, policy.minimumVersion)
            ?: throw invalidVersionPolicy()
        val comparisonToCurrent = SemanticVersionComparator.compare(installedVersion, policy.currentVersion)
            ?: throw invalidVersionPolicy()
        val minimumToCurrent = SemanticVersionComparator.compare(policy.minimumVersion, policy.currentVersion)
            ?: throw invalidVersionPolicy()
        val storeUrl = policy.storeUrl.trim()

        if (minimumToCurrent > 0 || !storeUrl.isHttpUrl()) {
            throw invalidVersionPolicy()
        }

        return when {
            comparisonToMinimum < 0 && policy.forceUpdate ->
                StartupVersionGateDecision.ForcedUpdate(storeUrl = storeUrl)

            comparisonToMinimum < 0 || comparisonToCurrent < 0 ->
                StartupVersionGateDecision.OptionalUpdate(storeUrl = storeUrl)

            else -> StartupVersionGateDecision.Allow
        }
    }
}

private fun String.isHttpUrl(): Boolean = runCatching {
    val uri = URI(this)
    (uri.scheme.equals("http", ignoreCase = true) || uri.scheme.equals("https", ignoreCase = true)) &&
        !uri.host.isNullOrBlank()
}.getOrDefault(false)

private fun invalidVersionPolicy() = RepositoryException(
    kind = RepositoryErrorKind.INVALID_DATA,
    resource = "startupVersionPolicy",
)
