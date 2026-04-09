package com.reguerta.user.presentation.access

import com.reguerta.user.domain.access.Member
import com.reguerta.user.domain.access.ProducerParity
import com.reguerta.user.domain.products.Product
import java.time.Instant
import java.time.ZoneId
import java.time.temporal.WeekFields

internal fun currentIsoWeekProducerParity(nowMillis: Long = System.currentTimeMillis()): ProducerParity {
    val localDate = Instant.ofEpochMilli(nowMillis)
        .atZone(ZoneId.systemDefault())
        .toLocalDate()
    val isoWeek = localDate.get(WeekFields.ISO.weekOfWeekBasedYear())
    return if (isoWeek % 2 == 0) {
        ProducerParity.EVEN
    } else {
        ProducerParity.ODD
    }
}

internal fun Product.matchesCurrentProducerWeek(
    membersById: Map<String, Member>,
    currentWeekParity: ProducerParity,
): Boolean {
    val producerParity = membersById[vendorId]?.producerParity ?: return true
    return producerParity == currentWeekParity
}
