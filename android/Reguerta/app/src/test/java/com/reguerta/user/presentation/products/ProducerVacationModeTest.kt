package com.reguerta.user.presentation.products

import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.access.MemberRole
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ProducerVacationModeTest {
    @Test
    fun `vacation mode hides producer from ordering`() {
        val producer = producer(catalogEnabled = true)

        assertTrue(producer.isVisibleForOrdering())
        assertFalse(producer.copy(producerCatalogEnabled = false).isVisibleForOrdering())
    }

    @Test
    fun `inactive producer stays hidden independently of vacation mode`() {
        assertFalse(
            producer(catalogEnabled = true)
                .copy(isActive = false)
                .isVisibleForOrdering(),
        )
    }

    private fun producer(catalogEnabled: Boolean) = Member(
        id = "producer",
        displayName = "Producer",
        normalizedEmail = "producer@reguerta.test",
        authUid = "auth_producer",
        roles = setOf(MemberRole.PRODUCER),
        isActive = true,
        producerCatalogEnabled = catalogEnabled,
    )
}
