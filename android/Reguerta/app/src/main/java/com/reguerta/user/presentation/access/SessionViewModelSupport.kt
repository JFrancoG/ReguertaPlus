package com.reguerta.user.presentation.access

import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.access.MemberRole
import com.reguerta.user.domain.access.canManageProductCatalog
import com.reguerta.user.domain.access.isProducer
import com.reguerta.user.domain.calendar.DeliveryCalendarOverride
import com.reguerta.user.domain.calendar.DeliveryWeekday
import com.reguerta.user.domain.notifications.NotificationAudience
import com.reguerta.user.domain.profiles.SharedProfile
import com.reguerta.user.domain.products.Product
import com.reguerta.user.domain.shifts.ShiftAssignment
import com.reguerta.user.domain.shifts.ShiftSwapCandidate
import com.reguerta.user.domain.shifts.ShiftSwapRequest
import com.reguerta.user.domain.shifts.ShiftType
import java.text.DateFormat
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.temporal.WeekFields

internal fun SharedProfile.toDraft(): SharedProfileDraft =
    SharedProfileDraft(
        familyNames = familyNames,
        photoUrl = photoUrl.orEmpty(),
        about = about,
    )

internal fun Product.toDraft(): ProductDraft =
    ProductDraft(
        name = name,
        description = description,
        productImageUrl = productImageUrl.orEmpty(),
        price = price.toSessionUiDecimal(),
        unitName = unitName,
        unitAbbreviation = unitAbbreviation.orEmpty(),
        unitPlural = unitPlural,
        unitQty = unitQty.toSessionUiDecimal(),
        packContainerName = packContainerName.orEmpty(),
        packContainerAbbreviation = packContainerAbbreviation.orEmpty(),
        packContainerPlural = packContainerPlural.orEmpty(),
        packContainerQty = packContainerQty?.toSessionUiDecimal().orEmpty(),
        isAvailable = isAvailable,
        stockMode = stockMode,
        stockQty = stockQty?.toSessionUiDecimal().orEmpty(),
        isEcoBasket = isEcoBasket,
        isCommonPurchase = isCommonPurchase,
        commonPurchaseType = commonPurchaseType,
    )

internal fun ProductDraft.normalized(): ProductDraft =
    copy(
        name = name.trim(),
        description = description.trim(),
        productImageUrl = productImageUrl.trim(),
        price = price.trim(),
        unitName = unitName.trim(),
        unitAbbreviation = unitAbbreviation.trim(),
        unitPlural = unitPlural.trim(),
        unitQty = unitQty.trim(),
        packContainerName = packContainerName.trim(),
        packContainerAbbreviation = packContainerAbbreviation.trim(),
        packContainerPlural = packContainerPlural.trim(),
        packContainerQty = packContainerQty.trim(),
        stockQty = stockQty.trim(),
    )

internal fun String.toPositiveDoubleOrNull(): Double? =
    replace(",", ".").toDoubleOrNull()?.takeIf { it > 0.0 }

internal fun String.toNonNegativeDoubleOrNull(): Double? =
    replace(",", ".").toDoubleOrNull()?.takeIf { it >= 0.0 }

internal val Member.isSessionProducer: Boolean
    get() = isProducer

internal val Member.canManageSessionProductCatalog: Boolean
    get() = canManageProductCatalog

internal fun Double.toSessionUiDecimal(): String =
    if (this % 1.0 == 0.0) {
        toLong().toString()
    } else {
        toString()
    }

internal fun SharedProfileDraft.normalized(): SharedProfileDraft =
    copy(
        familyNames = familyNames.trim(),
        photoUrl = photoUrl.trim(),
        about = about.trim(),
    )

internal val SharedProfileDraft.hasVisibleContent: Boolean
    get() = familyNames.isNotBlank() || photoUrl.isNotBlank() || about.isNotBlank()

internal fun List<ShiftAssignment>.nextAssignedShift(
    memberId: String,
    type: ShiftType,
    nowMillis: Long,
): ShiftAssignment? =
    asSequence()
        .filter { shift -> shift.type == type && shift.dateMillis >= nowMillis && shift.isAssignedTo(memberId) }
        .minByOrNull { shift -> shift.dateMillis }

internal fun List<ShiftSwapRequest>.visibleTo(memberId: String): List<ShiftSwapRequest> =
    filter { request ->
        request.requesterUserId == memberId || request.candidates.any { candidate -> candidate.userId == memberId }
    }
        .sortedByDescending { it.requestedAtMillis }

internal fun ShiftAssignment.swapCandidates(
    allShifts: List<ShiftAssignment>,
    requesterUserId: String,
    nowMillis: Long,
): List<ShiftSwapCandidate> {
    val thresholdDate = java.time.Instant.ofEpochMilli(nowMillis)
        .atZone(ZoneId.systemDefault())
        .toLocalDate()
        .plusWeeks(if (type == ShiftType.DELIVERY) 2 else 0)
        .atStartOfDay(ZoneId.systemDefault())
        .toInstant()
        .toEpochMilli()

    return allShifts.asSequence()
        .filter { shift ->
            shift.id != id &&
                shift.type == type &&
                shift.dateMillis >= thresholdDate
        }
        .flatMap { shift ->
            when (type) {
                ShiftType.DELIVERY,
                ShiftType.MARKET,
                    -> shift.assignedUserIds.asSequence()
            }
                .filter { userId -> userId != requesterUserId }
                .map { userId -> ShiftSwapCandidate(userId = userId, shiftId = shift.id) }
        }
        .distinctBy { candidate -> "${candidate.userId}:${candidate.shiftId}" }
        .toList()
}

internal fun ShiftAssignment.swapMemberWith(
    other: ShiftAssignment,
    requesterUserId: String,
    responderUserId: String,
    nowMillis: Long,
): Pair<ShiftAssignment, ShiftAssignment> {
    fun ShiftAssignment.replacing(oldUserId: String, newUserId: String): ShiftAssignment {
        val updatedAssigned = assignedUserIds.map { assignedUserId ->
            if (assignedUserId == oldUserId) newUserId else assignedUserId
        }
        val updatedHelper = when (helperUserId) {
            oldUserId -> newUserId
            else -> helperUserId
        }
        return copy(
            assignedUserIds = updatedAssigned,
            helperUserId = updatedHelper,
            status = com.reguerta.user.domain.shifts.ShiftStatus.CONFIRMED,
            source = "app",
            updatedAtMillis = nowMillis,
        )
    }

    return replacing(requesterUserId, responderUserId) to other.replacing(responderUserId, requesterUserId)
}

internal fun List<ShiftAssignment>.applyConfirmedSwap(
    updatedRequestedShift: ShiftAssignment,
    updatedCandidateShift: ShiftAssignment,
    nowMillis: Long,
): List<ShiftAssignment> {
    val replaced = map { shift ->
        when (shift.id) {
            updatedRequestedShift.id -> updatedRequestedShift
            updatedCandidateShift.id -> updatedCandidateShift
            else -> shift
        }
    }

    val deliveries = replaced
        .filter { it.type == ShiftType.DELIVERY }
        .sortedBy { it.dateMillis }
    val helperByDeliveryId = deliveries.mapIndexed { index, shift ->
        shift.id to deliveries.getOrNull(index + 1)?.assignedUserIds?.firstOrNull()
    }.toMap()

    return replaced.map { shift ->
        if (shift.type != ShiftType.DELIVERY) {
            shift
        } else {
            val recomputedHelper = helperByDeliveryId[shift.id]
            if (shift.helperUserId == recomputedHelper) {
                shift
            } else {
                shift.copy(
                    helperUserId = recomputedHelper,
                    status = com.reguerta.user.domain.shifts.ShiftStatus.CONFIRMED,
                    source = "app",
                    updatedAtMillis = nowMillis,
                )
            }
        }
    }
}

internal fun List<Member>.sessionDisplayNameFor(memberId: String): String =
    firstOrNull { it.id == memberId }?.displayName ?: memberId

internal fun ShiftSwapRequest.sessionAvailableResponses(): List<com.reguerta.user.domain.shifts.ShiftSwapResponse> =
    responses.filter { it.status == com.reguerta.user.domain.shifts.ShiftSwapResponseStatus.AVAILABLE }

internal fun ShiftSwapRequest.hasPendingCandidateFor(memberId: String): Boolean =
    candidates.any { candidate ->
        candidate.userId == memberId && responses.none { response ->
            response.userId == candidate.userId && response.shiftId == candidate.shiftId
        }
    }

internal fun Long.toShiftNotificationDateTime(): String {
    val formatter = DateFormat.getDateInstance(DateFormat.MEDIUM)
    return formatter.format(java.util.Date(this))
}

internal fun buildDeliveryCalendarOverride(
    weekKey: String,
    weekday: DeliveryWeekday,
    updatedByUserId: String,
    updatedAtMillis: Long,
): DeliveryCalendarOverride? {
    val weekStart = weekKey.toIsoWeekStartDate() ?: return null
    val deliveryDate = weekStart.plusDays(weekday.toDayOfWeek().value.toLong() - 1L)
    val zone = ZoneId.systemDefault()
    val deliveryMillis = deliveryDate.atStartOfDay(zone).toInstant().toEpochMilli()
    val ordersBlockedMillis = deliveryDate.plusDays(1).atStartOfDay(zone).toInstant().toEpochMilli()
    val ordersOpenMillis = deliveryDate.plusDays(2).atTime(LocalTime.MIDNIGHT).atZone(zone).toInstant().toEpochMilli()
    val ordersCloseMillis = weekStart.plusDays(6).atTime(23, 59, 59).atZone(zone).toInstant().toEpochMilli()
    return DeliveryCalendarOverride(
        weekKey = weekKey,
        deliveryDateMillis = deliveryMillis,
        ordersBlockedDateMillis = ordersBlockedMillis,
        ordersOpenAtMillis = ordersOpenMillis,
        ordersCloseAtMillis = ordersCloseMillis,
        updatedBy = updatedByUserId,
        updatedAtMillis = updatedAtMillis,
    )
}

internal fun String.toIsoWeekStartDate(): LocalDate? = runCatching {
    val yearPart = substringBefore("-W").toInt()
    val weekPart = substringAfter("-W").toInt()
    LocalDate.of(yearPart, 1, 4)
        .with(WeekFields.ISO.weekOfWeekBasedYear(), weekPart.toLong())
        .with(DayOfWeek.MONDAY)
}.getOrNull()

internal fun DeliveryWeekday.toDayOfWeek(): DayOfWeek = when (this) {
    DeliveryWeekday.MONDAY -> DayOfWeek.MONDAY
    DeliveryWeekday.TUESDAY -> DayOfWeek.TUESDAY
    DeliveryWeekday.WEDNESDAY -> DayOfWeek.WEDNESDAY
    DeliveryWeekday.THURSDAY -> DayOfWeek.THURSDAY
    DeliveryWeekday.FRIDAY -> DayOfWeek.FRIDAY
    DeliveryWeekday.SATURDAY -> DayOfWeek.SATURDAY
    DeliveryWeekday.SUNDAY -> DayOfWeek.SUNDAY
}

internal val EmailPatternRegex = "^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$".toRegex(setOf(RegexOption.IGNORE_CASE))
internal const val MY_ORDER_FRESHNESS_TIMEOUT_MILLIS = 2_500L
private const val PasswordMinLength = 6
private const val PasswordMaxLength = 16

internal fun String.isValidPassword(): Boolean = length in PasswordMinLength..PasswordMaxLength

internal fun SessionMode.isAuthenticatedSession(): Boolean =
    this is SessionMode.Authorized || this is SessionMode.Unauthorized

internal fun NotificationAudience.toTarget(): String =
    when (this) {
        NotificationAudience.ALL -> "all"
        NotificationAudience.MEMBERS,
        NotificationAudience.PRODUCERS,
        NotificationAudience.ADMINS,
            -> "segment"
    }

internal fun NotificationAudience.toSegmentType(): String? =
    when (this) {
        NotificationAudience.ALL -> null
        NotificationAudience.MEMBERS,
        NotificationAudience.PRODUCERS,
        NotificationAudience.ADMINS,
            -> "role"
    }

internal fun NotificationAudience.toTargetRole(): MemberRole? =
    when (this) {
        NotificationAudience.ALL -> null
        NotificationAudience.MEMBERS -> MemberRole.MEMBER
        NotificationAudience.PRODUCERS -> MemberRole.PRODUCER
        NotificationAudience.ADMINS -> MemberRole.ADMIN
    }
