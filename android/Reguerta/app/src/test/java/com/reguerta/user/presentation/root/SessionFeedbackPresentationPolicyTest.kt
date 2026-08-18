package com.reguerta.user.presentation.root

import com.reguerta.user.R
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SessionFeedbackPresentationPolicyTest {
    @Test
    fun `generic load failures are deduplicated during one refresh burst`() {
        val policy = SessionFeedbackPresentationPolicy(loadFailureCooldownMillis = 30_000L)

        assertTrue(policy.shouldPresent(R.string.feedback_unable_load_data, nowMillis = 1_000L))
        assertFalse(policy.shouldPresent(R.string.feedback_unable_load_data, nowMillis = 1_001L))
        assertTrue(policy.shouldPresent(R.string.feedback_unable_save_changes, nowMillis = 1_001L))
        assertTrue(policy.shouldPresent(R.string.feedback_unable_load_data, nowMillis = 31_000L))
    }

    @Test
    fun `clock discontinuity starts a new feedback window`() {
        val policy = SessionFeedbackPresentationPolicy(loadFailureCooldownMillis = 30_000L)

        assertTrue(policy.shouldPresent(R.string.feedback_unable_load_data, nowMillis = 50_000L))
        assertTrue(policy.shouldPresent(R.string.feedback_unable_load_data, nowMillis = 1_000L))
    }
}
