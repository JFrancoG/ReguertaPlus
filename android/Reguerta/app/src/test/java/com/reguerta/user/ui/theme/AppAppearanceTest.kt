package com.reguerta.user.ui.theme

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AppAppearanceTest {
    @Test
    fun `unknown or missing storage value defaults to system`() {
        assertEquals(AppAppearance.SYSTEM, AppAppearance.fromStorageValue(null))
        assertEquals(AppAppearance.SYSTEM, AppAppearance.fromStorageValue("unexpected"))
    }

    @Test
    fun `stored values round trip`() {
        AppAppearance.entries.forEach { appearance ->
            assertEquals(
                appearance,
                AppAppearance.fromStorageValue(appearance.storageValue),
            )
        }
    }

    @Test
    fun `appearance resolves system light and dark modes`() {
        assertTrue(AppAppearance.SYSTEM.resolvesToDark(systemIsDark = true))
        assertFalse(AppAppearance.SYSTEM.resolvesToDark(systemIsDark = false))
        assertFalse(AppAppearance.LIGHT.resolvesToDark(systemIsDark = true))
        assertTrue(AppAppearance.DARK.resolvesToDark(systemIsDark = false))
    }
}
