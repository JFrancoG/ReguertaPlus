package com.reguerta.user.presentation.formatting

import com.reguerta.user.presentation.root.toSessionUiDecimal
import java.util.Locale
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ReguertaCurrencyFormattingTest {
    @Test
    fun euroCurrencyTextUsesSpanishDecimalSeparatorAndTrailingSymbol() {
        val formatted = 12.5.toEuroCurrencyText(Locale.forLanguageTag("es-ES"))

        assertTrue(formatted.contains("12,50"))
        assertTrue(formatted.trim().endsWith("€"))
    }

    @Test
    fun euroCurrencyTextUsesEnglishDecimalSeparatorAndLeadingSymbol() {
        val formatted = 12.5.toEuroCurrencyText(Locale.US)

        assertTrue(formatted.contains("12.50"))
        assertTrue(formatted.trim().startsWith("€"))
    }

    @Test
    fun sessionDecimalTextUsesLocaleDecimalSeparator() {
        assertTrue(12.5.toSessionUiDecimal(Locale.forLanguageTag("es-ES")).contains("12,5"))
        assertTrue(12.5.toSessionUiDecimal(Locale.US).contains("12.5"))
    }

    @Test
    fun quantityTextUsesUpToThreeDecimalsWithoutTrailingZeros() {
        assertEquals("1", 1.0.toQuantityText(Locale.US))
        assertEquals("0.5", 0.5.toQuantityText(Locale.US))
        assertEquals("0.125", 0.125.toQuantityText(Locale.US))
        assertEquals("0.124", 0.1236.toQuantityText(Locale.US))
        assertEquals("0,5", 0.5.toQuantityText(Locale.forLanguageTag("es-ES")))
    }
}
