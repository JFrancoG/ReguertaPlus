package com.reguerta.user.domain.access

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

class SecureMemberIdTest {
    @Test
    fun `hash suffix separates emails whose forty character slug prefix collides`() {
        val firstEmail = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.one@example.com"
        val secondEmail = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.two@example.com"

        val firstId = buildSecureMemberId(firstEmail)
        val secondId = buildSecureMemberId(secondEmail)

        assertEquals(
            "member_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa_8797f88330",
            firstId,
        )
        assertEquals(
            "member_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa_e61d585b00",
            secondId,
        )
        assertNotEquals(firstId, secondId)
    }
}
