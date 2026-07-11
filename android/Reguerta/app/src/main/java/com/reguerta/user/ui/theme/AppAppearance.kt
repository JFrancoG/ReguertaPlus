package com.reguerta.user.ui.theme

enum class AppAppearance(val storageValue: String) {
    SYSTEM("system"),
    LIGHT("light"),
    DARK("dark"),
    ;

    fun resolvesToDark(systemIsDark: Boolean): Boolean = when (this) {
        SYSTEM -> systemIsDark
        LIGHT -> false
        DARK -> true
    }

    companion object {
        fun fromStorageValue(value: String?): AppAppearance =
            entries.firstOrNull { appearance -> appearance.storageValue == value } ?: SYSTEM
    }
}
