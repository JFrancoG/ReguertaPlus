package com.reguerta.user.presentation.access

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
import java.time.format.TextStyle
import java.time.temporal.TemporalAdjusters
import java.time.temporal.WeekFields
import java.util.Locale
import org.json.JSONObject

private const val HomeOrderPrefsName = "reguerta_my_order_cart"
private const val HomeOrderCartQuantitiesSuffix = ".quantities"
private const val HomeOrderConfirmedQuantitiesSuffix = ".confirmed_quantities"

internal enum class HomeOrderStateDisplay {
    NOT_STARTED,
    UNCONFIRMED,
    COMPLETED,
}

internal data class HomeWeeklySummaryDisplay(
    val weekKey: String,
    val weekRangeLabel: String,
    val weekBadgeLabel: String,
    val producerName: String,
    val deliveryLabel: String,
    val responsibleName: String,
    val helperName: String,
    val orderState: HomeOrderStateDisplay,
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
    locale: Locale = Locale.forLanguageTag("es-ES"),
): HomeWeeklySummaryDisplay {
    val today = Instant.ofEpochMilli(nowMillis).atZone(zoneId).toLocalDate()
    val deliveryDay = defaultDeliveryDayOfWeek?.toDayOfWeek() ?: DayOfWeek.WEDNESDAY
    val currentWeekStart = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
    val currentWeekKey = currentWeekStart.toIsoWeekKey()
    val currentDeliveryDate = resolveDeliveryDate(
        weekStart = currentWeekStart,
        deliveryDay = deliveryDay,
        overrides = deliveryCalendarOverrides,
        zoneId = zoneId,
    )
    val targetWeekStart = if (today.isAfter(currentDeliveryDate)) {
        currentWeekStart.plusWeeks(1)
    } else {
        currentWeekStart
    }
    val targetWeekKey = targetWeekStart.toIsoWeekKey()
    val targetShift = shifts
        .filter { it.type == ShiftType.DELIVERY }
        .firstOrNull { it.effectiveDateMillis(deliveryCalendarOverrides).toLocalDate(zoneId).toIsoWeekKey() == targetWeekKey }
    val targetDeliveryDate = targetShift
        ?.effectiveDateMillis(deliveryCalendarOverrides)
        ?.toLocalDate(zoneId)
        ?: resolveDeliveryDate(
            weekStart = targetWeekStart,
            deliveryDay = deliveryDay,
            overrides = deliveryCalendarOverrides,
            zoneId = zoneId,
        )
    val weekNumber = targetWeekStart.get(WeekFields.ISO.weekOfWeekBasedYear())

    return HomeWeeklySummaryDisplay(
        weekKey = targetWeekKey,
        weekRangeLabel = "${targetWeekStart.toShortDayMonth(locale)} - ${targetDeliveryDate.toShortDayMonth(locale)}",
        weekBadgeLabel = "Semana $weekNumber",
        producerName = resolveProducerName(targetWeekStart, members),
        deliveryLabel = targetDeliveryDate.toShortWeekdayDay(locale),
        responsibleName = targetShift?.assignedUserIds?.firstOrNull()?.let { members.displayNameForHome(it) } ?: "Pendiente",
        helperName = targetShift?.helperUserId?.let { members.displayNameForHome(it) } ?: "Pendiente",
        orderState = orderState,
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

internal fun formatHomeTopBarDate(
    nowMillis: Long,
    zoneId: ZoneId = ZoneId.systemDefault(),
    locale: Locale = Locale.forLanguageTag("es-ES"),
): String {
    val date = Instant.ofEpochMilli(nowMillis).atZone(zoneId).toLocalDate()
    val weekday = date.dayOfWeek.getDisplayName(TextStyle.FULL, locale).lowercase(locale)
    val month = date.month.getDisplayName(TextStyle.FULL, locale).lowercase(locale)
    return "$weekday ${date.dayOfMonth} $month"
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

private fun resolveDeliveryDate(
    weekStart: LocalDate,
    deliveryDay: DayOfWeek,
    overrides: List<DeliveryCalendarOverride>,
    zoneId: ZoneId,
): LocalDate {
    val weekKey = weekStart.toIsoWeekKey()
    return overrides.firstOrNull { it.weekKey == weekKey }
        ?.deliveryDateMillis
        ?.toLocalDate(zoneId)
        ?: weekStart.plusDays(deliveryDay.value.toLong() - 1L)
}

private fun resolveProducerName(weekStart: LocalDate, members: List<Member>): String {
    val parity = if (weekStart.get(WeekFields.ISO.weekOfWeekBasedYear()) % 2 == 0) {
        ProducerParity.EVEN
    } else {
        ProducerParity.ODD
    }
    return members
        .filter { it.isProducer && it.producerCatalogEnabled }
        .firstOrNull { it.producerParity == parity }
        ?.let { it.companyName?.takeIf(String::isNotBlank) ?: it.displayName }
        ?: members.firstOrNull { it.isProducer && it.producerCatalogEnabled }
            ?.let { it.companyName?.takeIf(String::isNotBlank) ?: it.displayName }
        ?: "Pendiente"
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
    "$dayOfMonth ${month.getDisplayName(TextStyle.SHORT, locale).trimEnd('.').lowercase(locale)}"

private fun LocalDate.toShortWeekdayDay(locale: Locale): String {
    val weekday = dayOfWeek.getDisplayName(TextStyle.SHORT, locale).trimEnd('.')
        .replaceFirstChar { if (it.isLowerCase()) it.titlecase(locale) else it.toString() }
    return "$weekday $dayOfMonth"
}
