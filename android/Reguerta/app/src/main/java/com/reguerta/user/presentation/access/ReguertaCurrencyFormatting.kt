package com.reguerta.user.presentation.access

import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalLocale
import java.text.NumberFormat
import java.util.Currency
import java.util.Locale

private const val EuroCurrencyCode = "EUR"

@Composable
internal fun Double.toEuroCurrencyText(): String {
    return toEuroCurrencyText(LocalLocale.current.platformLocale)
}

internal fun Double.toEuroCurrencyText(locale: Locale): String =
    NumberFormat.getCurrencyInstance(locale).apply {
        currency = Currency.getInstance(EuroCurrencyCode)
        minimumFractionDigits = 2
        maximumFractionDigits = 2
    }.format(this)
