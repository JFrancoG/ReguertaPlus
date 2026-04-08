package com.reguerta.user.presentation.access

import androidx.annotation.StringRes
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import com.reguerta.user.R
import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.access.MemberRole
import com.reguerta.user.domain.calendar.DeliveryCalendarOverride
import com.reguerta.user.domain.notifications.NotificationAudience
import com.reguerta.user.domain.notifications.NotificationEvent
import com.reguerta.user.domain.shifts.ShiftAssignment
import com.reguerta.user.domain.shifts.ShiftStatus
import com.reguerta.user.domain.shifts.ShiftSwapRequestStatus
import com.reguerta.user.domain.shifts.ShiftType
import java.text.DateFormat
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.TextStyle
import java.time.temporal.WeekFields
import java.util.Locale

@StringRes
private fun ShiftType.labelRes(): Int = when (this) {
    ShiftType.DELIVERY -> R.string.shifts_type_delivery
    ShiftType.MARKET -> R.string.shifts_type_market
}

@StringRes
internal fun ShiftStatus.labelRes(): Int = when (this) {
    ShiftStatus.PLANNED -> R.string.shifts_status_planned
    ShiftStatus.SWAP_PENDING -> R.string.shifts_status_swap_pending
    ShiftStatus.CONFIRMED -> R.string.shifts_status_confirmed
}

internal fun ShiftAssignment.effectiveDateMillis(overrides: List<DeliveryCalendarOverride>): Long =
    if (type == ShiftType.DELIVERY) {
        overrides.firstOrNull { it.weekKey == dateMillis.toWeekKey() }?.deliveryDateMillis ?: dateMillis
    } else {
        dateMillis
    }

fun ShiftAssignment.toSummaryLine(
    members: List<Member>,
    overrides: List<DeliveryCalendarOverride>,
): String = "${effectiveDateMillis(overrides).toLocalizedDateTime()} · ${assignedUserIds.toMemberNames(members)}"

@Composable
internal fun ShiftAssignment.leftBoardLines(overrides: List<DeliveryCalendarOverride>): List<ShiftBoardLine> = when (type) {
    ShiftType.DELIVERY -> {
        val localDate = effectiveDateMillis(overrides).toLocalDate()
        listOf(
            ShiftBoardLine(
                text = effectiveDateMillis(overrides).toWeekKey(),
                style = MaterialTheme.typography.bodySmall,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface,
            ),
            ShiftBoardLine(
                text = localDate.toLocalizedBoardDate(),
                style = MaterialTheme.typography.bodySmall,
            ),
        )
    }
    ShiftType.MARKET -> {
        val localDate = effectiveDateMillis(overrides).toLocalDate()
        listOf(
            ShiftBoardLine(
                text = localDate.toLocalizedMonthLabel(),
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface,
            ),
            ShiftBoardLine(
                text = localDate.toLocalizedWeekdayLabel(),
                style = MaterialTheme.typography.labelMedium,
            ),
            ShiftBoardLine(
                text = localDate.dayOfMonth.toString(),
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface,
            ),
        )
    }
}

internal fun ShiftAssignment.primaryBoardNames(members: List<Member>): List<String> = when (type) {
    ShiftType.DELIVERY -> buildList {
        assignedUserIds.firstOrNull()?.let { add(members.displayNameFor(it)) }
        add(helperUserId?.let { members.displayNameFor(it) } ?: "—")
    }.ifEmpty { listOf("—", "—") }
    ShiftType.MARKET -> assignedUserIds
        .map { memberId -> members.displayNameFor(memberId) }
        .let { names ->
            if (names.isEmpty()) {
                listOf("—", "—", "—")
            } else {
                (names + List(maxOf(0, 3 - names.size)) { "—" }).take(3)
            }
        }
}

internal fun ShiftAssignment.canBeRequestedBy(
    currentMemberId: String,
    overrides: List<DeliveryCalendarOverride>,
): Boolean = when (type) {
    ShiftType.DELIVERY -> effectiveDateMillis(overrides) > System.currentTimeMillis() &&
        assignedUserIds.firstOrNull() == currentMemberId
    ShiftType.MARKET -> effectiveDateMillis(overrides) > System.currentTimeMillis() &&
        assignedUserIds.contains(currentMemberId)
}

internal fun ShiftAssignment.highlightedBoardNameIndex(currentMemberId: String): Int? = when (type) {
    ShiftType.DELIVERY -> when {
        assignedUserIds.firstOrNull() == currentMemberId -> 0
        helperUserId == currentMemberId -> 1
        else -> null
    }
    ShiftType.MARKET -> assignedUserIds.indexOf(currentMemberId).takeIf { it >= 0 }
}

private fun List<String>.toMemberNames(members: List<Member>): String =
    map { memberId -> members.displayNameFor(memberId) }
        .joinToString(separator = ", ")
        .ifBlank { "—" }

private fun List<Member>.displayNameFor(memberId: String): String =
    firstOrNull { member -> member.id == memberId }?.displayName ?: memberId

@StringRes
internal fun ShiftSwapRequestStatus.labelRes(): Int = when (this) {
    ShiftSwapRequestStatus.OPEN -> R.string.shift_swap_request_status_open
    ShiftSwapRequestStatus.CANCELLED -> R.string.shift_swap_request_status_cancelled
    ShiftSwapRequestStatus.APPLIED -> R.string.shift_swap_request_status_applied
}

internal fun ShiftBoardSegment.toShiftType(): ShiftType = when (this) {
    ShiftBoardSegment.DELIVERY -> ShiftType.DELIVERY
    ShiftBoardSegment.MARKET -> ShiftType.MARKET
}

private fun Long.toLocalDate(): LocalDate =
    Instant.ofEpochMilli(this)
        .atZone(ZoneId.systemDefault())
        .toLocalDate()

internal fun Long.toWeekKey(): String {
    val localDate = toLocalDate()
    val weekFields = WeekFields.ISO
    val week = localDate.get(weekFields.weekOfWeekBasedYear())
    val year = localDate.get(weekFields.weekBasedYear())
    return String.format(Locale.US, "%04d-W%02d", year, week)
}

private fun LocalDate.toLocalizedBoardDate(): String {
    val locale = Locale.getDefault()
    val weekday = dayOfWeek.getDisplayName(TextStyle.SHORT, locale).trimEnd('.').toTitleCase(locale)
    val month = month.getDisplayName(TextStyle.SHORT, locale).trimEnd('.')
    return "$weekday $dayOfMonth $month"
}

private fun LocalDate.toLocalizedMonthLabel(): String {
    val locale = Locale.getDefault()
    return month.getDisplayName(TextStyle.FULL, locale).toTitleCase(locale)
}

private fun LocalDate.toLocalizedWeekdayLabel(): String {
    val locale = Locale.getDefault()
    return dayOfWeek.getDisplayName(TextStyle.FULL, locale).toTitleCase(locale)
}

private fun String.toTitleCase(locale: Locale): String =
    replaceFirstChar { if (it.isLowerCase()) it.titlecase(locale) else it.toString() }

fun NotificationAudience.labelRes(): Int =
    when (this) {
        NotificationAudience.ALL -> R.string.notifications_target_all
        NotificationAudience.MEMBERS -> R.string.notifications_target_members
        NotificationAudience.PRODUCERS -> R.string.notifications_target_producers
        NotificationAudience.ADMINS -> R.string.notifications_target_admins
    }

fun NotificationEvent.audienceLabelRes(): Int =
    when {
        target == "all" -> R.string.notifications_target_all
        target == "users" -> R.string.notifications_target_users
        segmentType == "role" && targetRole == MemberRole.MEMBER -> R.string.notifications_target_members
        segmentType == "role" && targetRole == MemberRole.PRODUCER -> R.string.notifications_target_producers
        segmentType == "role" && targetRole == MemberRole.ADMIN -> R.string.notifications_target_admins
        else -> R.string.notifications_target_all
    }

fun Long.toLocalizedDateTime(): String =
    DateFormat.getDateTimeInstance(DateFormat.MEDIUM, DateFormat.SHORT).format(java.util.Date(this))

internal fun Long.toLocalizedDateOnly(): String =
    DateFormat.getDateInstance(DateFormat.MEDIUM).format(java.util.Date(this))

internal fun ShiftAssignment.toShiftSwapDisplayLabel(
    memberId: String?,
    overrides: List<DeliveryCalendarOverride>,
): String = effectiveDateMillis(overrides).toLocalizedDateOnly()
