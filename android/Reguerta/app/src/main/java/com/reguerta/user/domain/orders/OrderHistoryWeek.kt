package com.reguerta.user.domain.orders

import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.WeekFields
import java.util.Locale

data class OrderHistoryWeekOption(
    val weekKey: String,
    val weekYear: Int,
    val weekNumber: Int,
    val rangeLabel: String,
) {
    val title: String = "$weekYear Semana $weekNumber"
    val shortYearWeekLabel: String = "$weekYear Sem $weekNumber"
    val pickerLabel: String = "$rangeLabel · $shortYearWeekLabel"
    val orderTitle: String = "Pedido $rangeLabel"
}

fun String.isValidIsoWeekKey(): Boolean {
    val parts = split("-W")
    if (parts.size != 2 || parts[0].length != 4) return false
    val week = parts[1].toIntOrNull() ?: return false
    return week in 1..53
}

fun orderHistoryPreviousIsoWeekKey(
    nowMillis: Long,
    zoneId: ZoneId = ZoneId.of("Europe/Madrid"),
): String {
    val today = Instant.ofEpochMilli(nowMillis).atZone(zoneId).toLocalDate()
    val currentWeekStart = today.with(DayOfWeek.MONDAY)
    return currentWeekStart.minusWeeks(1).toIsoWeekKey()
}

fun orderHistoryContinuousWeekOptions(
    realWeekKeys: List<String>,
    preferredWeekKey: String,
    locale: Locale = Locale.forLanguageTag("es-ES"),
): List<OrderHistoryWeekOption> {
    val starts = (realWeekKeys.filter(String::isValidIsoWeekKey) + listOfNotNull(preferredWeekKey.takeIf(String::isValidIsoWeekKey)))
        .distinct()
        .mapNotNull(String::toIsoWeekStartDate)
        .sorted()
    val first = starts.firstOrNull() ?: return emptyList()
    val last = starts.last()
    return generateSequence(first) { date ->
        date.plusWeeks(1).takeIf { !it.isAfter(last) }
    }.map { weekStart ->
        weekStart.toOrderHistoryWeekOption(locale)
    }.toList()
}

fun orderHistoryWeekOption(
    weekKey: String,
    locale: Locale = Locale.forLanguageTag("es-ES"),
): OrderHistoryWeekOption? =
    weekKey.toIsoWeekStartDate()?.toOrderHistoryWeekOption(locale)

fun String.toIsoWeekStartDate(): LocalDate? {
    if (!isValidIsoWeekKey()) return null
    val parts = split("-W")
    val year = parts[0].toIntOrNull() ?: return null
    val week = parts[1].toIntOrNull() ?: return null
    val start = LocalDate.of(year, 1, 4)
        .with(WeekFields.ISO.weekBasedYear(), year.toLong())
        .with(WeekFields.ISO.weekOfWeekBasedYear(), week.toLong())
        .with(DayOfWeek.MONDAY)
    return start.takeIf { it.toIsoWeekKey() == this }
}

fun LocalDate.toIsoWeekKey(): String {
    val week = get(WeekFields.ISO.weekOfWeekBasedYear())
    val year = get(WeekFields.ISO.weekBasedYear())
    return String.format(Locale.US, "%04d-W%02d", year, week)
}

private fun LocalDate.toOrderHistoryWeekOption(locale: Locale): OrderHistoryWeekOption {
    val weekEnd = plusDays(6)
    val weekNumber = get(WeekFields.ISO.weekOfWeekBasedYear())
    val weekYear = get(WeekFields.ISO.weekBasedYear())
    return OrderHistoryWeekOption(
        weekKey = toIsoWeekKey(),
        weekYear = weekYear,
        weekNumber = weekNumber,
        rangeLabel = "${toShortDayMonth(locale)} - ${weekEnd.toShortDayMonth(locale)}",
    )
}

private fun LocalDate.toShortDayMonth(locale: Locale): String {
    val formatter = DateTimeFormatter.ofPattern("d MMM", locale)
    return format(formatter).replace(".", "").lowercase(locale)
}
