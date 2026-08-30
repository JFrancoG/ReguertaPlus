package com.reguerta.user.domain.notifications

@JvmInline
value class ShiftNotificationPushReference private constructor(
    val eventId: String,
) {
    companion object {
        private val EventIdPattern = Regex("^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$")

        fun validated(eventId: String?, type: String?, target: String?): ShiftNotificationPushReference? {
            if (type != "shift_updated" || target != "users" || eventId == null) return null
            if (!EventIdPattern.matches(eventId)) return null
            return ShiftNotificationPushReference(eventId)
        }
    }
}
