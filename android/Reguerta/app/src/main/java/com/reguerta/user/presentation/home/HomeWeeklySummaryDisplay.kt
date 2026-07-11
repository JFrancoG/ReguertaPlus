package com.reguerta.user.presentation.home

import android.content.Context
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.access.ProducerParity
import com.reguerta.user.domain.access.isProducer
import com.reguerta.user.domain.calendar.DeliveryCalendarOverride
import com.reguerta.user.domain.calendar.DeliveryWeekday
import com.reguerta.user.domain.shifts.ShiftAssignment
import com.reguerta.user.domain.shifts.ShiftType
import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.chrono.IsoChronology
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeFormatterBuilder
import java.time.format.FormatStyle
import java.time.format.TextStyle
import java.time.temporal.TemporalAdjusters
import java.time.temporal.WeekFields
import java.util.Locale
import org.json.JSONObject

private const val HomeOrderPrefsName = "reguerta_my_order_cart"
private const val HomeOrderCartQuantitiesSuffix = ".quantities"
private const val HomeOrderConfirmedQuantitiesSuffix = ".confirmed_quantities"

internal enum class HomeOrderStateDisplay {
    CONSULTATION,
    NOT_STARTED,
    UNCONFIRMED,
    COMPLETED,
}

internal data class HomeWeeklySummaryDisplay(
    val weekKey: String,
    val orderWeekKey: String,
    val weekRangeLabel: String,
    val weekBadgeLabel: String,
    val producerName: String,
    val deliveryLabel: String,
    val responsibleName: String,
    val helperName: String,
    val marketLabel: String,
    val marketResponsibleNames: List<String>,
    val orderState: HomeOrderStateDisplay,
    val isConsultaPhase: Boolean,
)

internal fun resolveHomeWeeklySummaryDisplay(
    nowMillis: Long,
    defaultDeliveryDayOfWeek: DeliveryWeekday?,
    deliveryCalendarOverrides: List<DeliveryCalendarOverride>,
    shifts: List<ShiftAssignment>,
    members: List<Member>,
    currentMemberId: String?,
    orderState: HomeOrderStateDisplay,
    zoneId: ZoneId = ZoneId.systemDefault(),
    locale: Locale,
    weekLabel: String,
    pendingLabel: String,
): HomeWeeklySummaryDisplay {
    val today = Instant.ofEpochMilli(nowMillis).atZone(zoneId).toLocalDate()
    val currentWeekStart = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
    val currentDeliveryDate = resolveEffectiveHomeDeliveryDate(
        weekStart = currentWeekStart,
        deliveryCalendarOverrides = deliveryCalendarOverrides,
        zoneId = zoneId,
    )
    val targetWeekStart = if (today.isAfter(currentDeliveryDate)) {
        currentWeekStart.plusWeeks(1)
    } else {
        currentWeekStart
    }
    val targetWeekKey = targetWeekStart.toIsoWeekKey()
    val orderWeekStart = targetWeekStart.minusWeeks(1)
    val orderWeekKey = orderWeekStart.toIsoWeekKey()
    val isConsultaPhase = !today.isBefore(currentWeekStart) && !today.isAfter(currentDeliveryDate)
    val targetShift = shifts
        .filter { it.type == ShiftType.DELIVERY }
        .firstOrNull { it.dateMillis.toLocalDate(zoneId).toIsoWeekKey() == targetWeekKey }
    val targetMarketShift = shifts
        .filter { it.type == ShiftType.MARKET }
        .filter { !it.dateMillis.toLocalDate(zoneId).isBefore(today) }
        .minByOrNull { it.dateMillis }
    val targetDeliveryDate = resolveHomeCalendarDeliveryDate(
        weekStart = targetWeekStart,
        deliveryCalendarOverrides = deliveryCalendarOverrides,
        zoneId = zoneId,
    )
    val targetMarketDate = targetMarketShift
        ?.dateMillis
        ?.toLocalDate(zoneId)
        ?: resolveNextScheduledHomeMarketDate(today)
    val weekNumber = targetWeekStart.get(WeekFields.ISO.weekOfWeekBasedYear())
    val targetWeekEnd = targetWeekStart.plusDays(6)

    return HomeWeeklySummaryDisplay(
        weekKey = targetWeekKey,
        orderWeekKey = orderWeekKey,
        weekRangeLabel = "${targetWeekStart.toShortDayMonth(locale)} - ${targetWeekEnd.toShortDayMonth(locale)}",
        weekBadgeLabel = "$weekLabel $weekNumber",
        producerName = resolveProducerName(targetWeekStart, members, pendingLabel),
        deliveryLabel = targetDeliveryDate.toShortWeekdayDay(locale),
        responsibleName = targetShift?.assignedUserIds?.firstOrNull()?.let { members.displayNameForHome(it) } ?: pendingLabel,
        helperName = targetShift?.helperUserId?.let { members.displayNameForHome(it) } ?: pendingLabel,
        marketLabel = targetMarketDate?.let { date ->
            if (targetMarketShift == null) date.toShortDayMonth(locale) else date.toShortWeekdayDay(locale)
        } ?: pendingLabel,
        marketResponsibleNames = targetMarketShift
            ?.assignedUserIds
            ?.take(3)
            ?.map { members.displayNameForHome(it) }
            ?.ifEmpty { listOf(pendingLabel) }
            ?: listOf(pendingLabel),
        orderState = orderState,
        isConsultaPhase = isConsultaPhase,
    )
}

internal fun resolveHomeOrderState(
    context: Context,
    memberId: String?,
    weekKey: String,
): HomeOrderStateDisplay {
    val storageKey = "member_${memberId.orEmpty()}_week_$weekKey"
    val preferences = context.getSharedPreferences(HomeOrderPrefsName, Context.MODE_PRIVATE)
    return when {
        preferences.hasPositiveQuantity("$storageKey$HomeOrderConfirmedQuantitiesSuffix") -> HomeOrderStateDisplay.COMPLETED
        preferences.hasPositiveQuantity("$storageKey$HomeOrderCartQuantitiesSuffix") -> HomeOrderStateDisplay.UNCONFIRMED
        else -> HomeOrderStateDisplay.NOT_STARTED
    }
}

internal fun resolveHomeDisplayedOrderState(
    isConsultaPhase: Boolean,
    orderState: HomeOrderStateDisplay,
): HomeOrderStateDisplay =
    if (isConsultaPhase) HomeOrderStateDisplay.CONSULTATION else orderState

internal fun formatHomeTopBarDate(
    nowMillis: Long,
    zoneId: ZoneId = ZoneId.systemDefault(),
    locale: Locale = Locale.getDefault(),
): String {
    val date = Instant.ofEpochMilli(nowMillis).atZone(zoneId).toLocalDate()
    val monthDayPattern = localizedMonthDayPattern(locale, monthPattern = "MMMM")
    val localizedPattern = when {
        monthDayPattern.startsWith("MMMM") -> "EEEE, $monthDayPattern"
        locale.language == "es" -> "EEEE, d 'de' MMMM"
        else -> "EEEE, $monthDayPattern"
    }
    return date.format(DateTimeFormatter.ofPattern(localizedPattern, locale))
}

private fun android.content.SharedPreferences.hasPositiveQuantity(key: String): Boolean =
    runCatching {
        val raw = getString(key, null).orEmpty()
        if (raw.isBlank()) {
            false
        } else {
            val payload = JSONObject(raw)
            payload.keys().asSequence().any { productId -> payload.optInt(productId, 0) > 0 }
        }
    }.getOrDefault(false)

private fun resolveEffectiveHomeDeliveryDate(
    weekStart: LocalDate,
    deliveryCalendarOverrides: List<DeliveryCalendarOverride>,
    zoneId: ZoneId,
): LocalDate = resolveHomeCalendarDeliveryDate(
    weekStart = weekStart,
    deliveryCalendarOverrides = deliveryCalendarOverrides,
    zoneId = zoneId,
)

private fun resolveHomeCalendarDeliveryDate(
    weekStart: LocalDate,
    deliveryCalendarOverrides: List<DeliveryCalendarOverride>,
    zoneId: ZoneId,
): LocalDate {
    val weekKey = weekStart.toIsoWeekKey()
    val override = deliveryCalendarOverrides.firstOrNull { it.weekKey == weekKey }
    return override?.deliveryDateMillis?.toLocalDate(zoneId)
        ?: weekStart.plusDays(DayOfWeek.WEDNESDAY.value.toLong() - 1L)
}

private fun resolveNextScheduledHomeMarketDate(today: LocalDate): LocalDate? =
    generateSequence(today.withDayOfMonth(1)) { monthStart -> monthStart.plusMonths(1) }
        .take(24)
        .filter { monthStart -> monthStart.monthValue != 7 && monthStart.monthValue != 8 }
        .map { monthStart -> monthStart.with(TemporalAdjusters.dayOfWeekInMonth(3, DayOfWeek.SATURDAY)) }
        .firstOrNull { marketDate -> !marketDate.isBefore(today) }

private fun resolveProducerName(
    weekStart: LocalDate,
    members: List<Member>,
    pendingLabel: String,
): String {
    val orderWeekStart = weekStart.minusWeeks(1)
    val orderWeekNumber = orderWeekStart.get(WeekFields.ISO.weekOfWeekBasedYear())
    val parity = if (orderWeekNumber % 2 == 0) {
        ProducerParity.EVEN
    } else {
        ProducerParity.ODD
    }
    val producers = members
        .filter(Member::isProducer)
        .sortedBy { it.companyName?.takeIf(String::isNotBlank) ?: it.displayName }
    return producers
        .firstOrNull { it.producerParity == parity }
        ?.let { it.companyName?.takeIf(String::isNotBlank) ?: it.displayName }
        ?: producers.getOrNull(orderWeekNumber % producers.size.coerceAtLeast(1))
            ?.let { it.companyName?.takeIf(String::isNotBlank) ?: it.displayName }
        ?: pendingLabel
}

private fun List<Member>.displayNameForHome(memberId: String): String =
    firstOrNull { it.id == memberId }?.displayName ?: memberId

private fun LocalDate.toIsoWeekKey(): String {
    val week = get(WeekFields.ISO.weekOfWeekBasedYear())
    val year = get(WeekFields.ISO.weekBasedYear())
    return String.format(Locale.US, "%04d-W%02d", year, week)
}

private fun Long.toLocalDate(zoneId: ZoneId): LocalDate =
    Instant.ofEpochMilli(this).atZone(zoneId).toLocalDate()

private fun LocalDate.toShortDayMonth(locale: Locale): String =
    format(DateTimeFormatter.ofPattern(localizedMonthDayPattern(locale), locale))
        .replace(".", "")

private fun localizedMonthDayPattern(locale: Locale, monthPattern: String = "MMM"): String {
    val localizedPattern = DateTimeFormatterBuilder.getLocalizedDateTimePattern(
        FormatStyle.MEDIUM,
        null,
        IsoChronology.INSTANCE,
        locale,
    )
    val monthIndex = listOf(localizedPattern.indexOf('M'), localizedPattern.indexOf('L'))
        .filter { it >= 0 }
        .minOrNull()
        ?: Int.MAX_VALUE
    val dayIndex = localizedPattern.indexOf('d').takeIf { it >= 0 } ?: Int.MAX_VALUE
    return if (monthIndex < dayIndex) "$monthPattern d" else "d $monthPattern"
}

private fun LocalDate.toShortWeekdayDay(locale: Locale): String {
    val weekday = dayOfWeek.getDisplayName(TextStyle.SHORT, locale).trimEnd('.')
        .replaceFirstChar { if (it.isLowerCase()) it.titlecase(locale) else it.toString() }
    return "$weekday $dayOfMonth"
}
