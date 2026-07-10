package com.reguerta.user.presentation.formatting

import com.reguerta.user.presentation.root.toSessionUiDecimal
import java.util.Locale
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
}
