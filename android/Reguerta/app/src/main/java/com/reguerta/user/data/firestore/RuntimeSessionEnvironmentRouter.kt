package com.reguerta.user.data.firestore

import com.reguerta.user.domain.access.SessionEnvironmentRouter

class RuntimeSessionEnvironmentRouter : SessionEnvironmentRouter {
    override fun applyResolvedEnvironment(environment: String) {
        val resolved = ReguertaFirestoreEnvironment.entries.firstOrNull { candidate ->
            candidate.wireValue == environment.trim().lowercase()
        } ?: error("Unsupported Firestore environment: $environment")
        ReguertaRuntimeEnvironment.applySessionEnvironment(resolved)
    }

    override fun resetToBaseEnvironment() {
        ReguertaRuntimeEnvironment.resetToBaseEnvironment()
    }
}
