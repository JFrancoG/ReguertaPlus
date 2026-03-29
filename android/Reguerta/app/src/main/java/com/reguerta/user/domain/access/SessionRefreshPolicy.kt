package com.reguerta.user.domain.access

enum class SessionRefreshTrigger {
    STARTUP,
    FOREGROUND,
}

class SessionRefreshPolicy(
    private val minimumForegroundIntervalMillis: Long = 15_000L,
) {
    fun shouldRefresh(
        trigger: SessionRefreshTrigger,
        lastRefreshAtMillis: Long?,
        nowMillis: Long,
        isRefreshInFlight: Boolean,
    ): Boolean {
        if (isRefreshInFlight) {
            return false
        }

        return when (trigger) {
            SessionRefreshTrigger.STARTUP -> lastRefreshAtMillis == null
            SessionRefreshTrigger.FOREGROUND -> {
                lastRefreshAtMillis == null ||
                    nowMillis - lastRefreshAtMillis >= minimumForegroundIntervalMillis
            }
        }
    }
}
