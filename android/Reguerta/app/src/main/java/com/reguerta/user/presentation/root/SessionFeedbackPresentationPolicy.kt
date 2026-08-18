package com.reguerta.user.presentation.root

import androidx.annotation.StringRes
import com.reguerta.user.R

internal class SessionFeedbackPresentationPolicy(
    private val loadFailureCooldownMillis: Long = LOAD_FAILURE_FEEDBACK_COOLDOWN_MILLIS,
) {
    private var lastLoadFailureFeedbackAtMillis: Long? = null

    init {
        require(loadFailureCooldownMillis >= 0L) {
            "Load failure feedback cooldown cannot be negative"
        }
    }

    @Synchronized
    fun shouldPresent(@StringRes messageRes: Int, nowMillis: Long): Boolean {
        if (messageRes != R.string.feedback_unable_load_data) return true
        val lastPresentation = lastLoadFailureFeedbackAtMillis
        if (
            lastPresentation != null &&
            nowMillis >= lastPresentation &&
            nowMillis - lastPresentation < loadFailureCooldownMillis
        ) return false
        lastLoadFailureFeedbackAtMillis = nowMillis
        return true
    }

    @Synchronized
    fun reset() {
        lastLoadFailureFeedbackAtMillis = null
    }
}

internal const val HOME_LOAD_AUTOMATIC_RETRY_DELAY_MILLIS = 10_000L
internal val MY_ORDER_FRESHNESS_RETRY_DELAYS_MILLIS = listOf(10_000L, 20_000L, 30_000L)
private const val LOAD_FAILURE_FEEDBACK_COOLDOWN_MILLIS = 30_000L
