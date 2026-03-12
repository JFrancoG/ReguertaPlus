package com.reguerta.user.domain.access

data class AuthPrincipal(
    val uid: String,
    val email: String,
)
