package com.reguerta.user.domain.devices

import com.reguerta.user.domain.access.Member

fun interface AuthorizedDeviceRegistrar {
    suspend fun register(member: Member)
}
