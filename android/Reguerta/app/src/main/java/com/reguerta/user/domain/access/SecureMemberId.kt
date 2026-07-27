package com.reguerta.user.domain.access

import java.security.MessageDigest

private val NonMemberIdSlugCharacter = "[^a-z0-9]+".toRegex()
private const val MemberIdSlugLimit = 40
private const val MemberIdHashByteCount = 5
private const val LowercaseHexDigits = "0123456789abcdef"

internal fun buildSecureMemberId(email: String): String {
    val canonicalEmail = email.trim().lowercase()
    val sanitized = canonicalEmail
        .replace(NonMemberIdSlugCharacter, "_")
        .trim('_')
    val suffix = sanitized.ifBlank { "member" }.take(MemberIdSlugLimit)
    val digest = MessageDigest.getInstance("SHA-256")
        .digest(canonicalEmail.toByteArray(Charsets.UTF_8))
    val hash = buildString(MemberIdHashByteCount * 2) {
        digest.take(MemberIdHashByteCount).forEach { byte ->
            val value = byte.toInt() and 0xff
            append(LowercaseHexDigits[value ushr 4])
            append(LowercaseHexDigits[value and 0x0f])
        }
    }
    return "member_${suffix}_$hash"
}
