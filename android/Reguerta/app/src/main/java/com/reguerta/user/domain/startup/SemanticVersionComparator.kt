package com.reguerta.user.domain.startup

object SemanticVersionComparator {
    private val versionRegex = Regex("^\\d+(?:\\.\\d+)*$")

    fun compare(lhs: String, rhs: String): Int? {
        val leftParts = parseVersion(lhs) ?: return null
        val rightParts = parseVersion(rhs) ?: return null
        val maxSize = maxOf(leftParts.size, rightParts.size)

        repeat(maxSize) { index ->
            val left = leftParts.getOrElse(index) { 0 }
            val right = rightParts.getOrElse(index) { 0 }
            if (left != right) {
                return left.compareTo(right)
            }
        }

        return 0
    }

    private fun parseVersion(raw: String): List<Int>? {
        val value = raw.trim()
        if (value.isEmpty() || !versionRegex.matches(value)) {
            return null
        }

        return value.split(".").map { segment ->
            segment.toIntOrNull() ?: return null
        }
    }
}
