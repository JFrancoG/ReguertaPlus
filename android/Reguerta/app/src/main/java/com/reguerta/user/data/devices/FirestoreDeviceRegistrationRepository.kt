package com.reguerta.user.data.devices

import android.util.Log
import com.google.android.gms.tasks.Tasks
import com.google.firebase.Timestamp
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import com.reguerta.user.data.firestore.ReguertaFirestoreCollection
import com.reguerta.user.data.firestore.ReguertaFirestoreEnvironment
import com.reguerta.user.data.firestore.ReguertaFirestorePath
import com.reguerta.user.domain.devices.DeviceRegistrationRepository
import com.reguerta.user.domain.devices.RegisteredDevice
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class FirestoreDeviceRegistrationRepository(
    private val firestore: FirebaseFirestore,
    private val environment: ReguertaFirestoreEnvironment? = null,
) : DeviceRegistrationRepository {
    private companion object {
        const val TAG = "ReguertaPush"
    }

    private val firestorePath = ReguertaFirestorePath(environment = environment)

    override suspend fun registerDevice(
        memberId: String,
        device: RegisteredDevice,
    ): RegisteredDevice = withContext(Dispatchers.IO) {
        val userDocumentPath = firestorePath.documentPath(
            collection = ReguertaFirestoreCollection.USERS,
            documentId = memberId,
        )
        val userDocument = firestore.document(userDocumentPath)
        val deviceDocument = userDocument.collection("devices").document(device.deviceId)

        val payload = mutableMapOf<String, Any?>(
            "deviceId" to device.deviceId,
            "platform" to device.platform,
            "appVersion" to device.appVersion,
            "osVersion" to device.osVersion,
            "apiLevel" to device.apiLevel,
            "manufacturer" to device.manufacturer,
            "model" to device.model,
            "lastSeenAt" to Timestamp(device.lastSeenAtMillis / 1_000, ((device.lastSeenAtMillis % 1_000) * 1_000_000).toInt()),
        )

        runCatching {
            val existing = Tasks.await(deviceDocument.get())
            if (!existing.exists()) {
                payload["firstSeenAt"] = Timestamp(
                    device.firstSeenAtMillis / 1_000,
                    ((device.firstSeenAtMillis % 1_000) * 1_000_000).toInt(),
                )
            }
            payload["fcmToken"] = device.fcmToken
            payload["tokenUpdatedAt"] = device.tokenUpdatedAtMillis?.let {
                Timestamp(it / 1_000, ((it % 1_000) * 1_000_000).toInt())
            }
            Tasks.await(deviceDocument.set(payload, SetOptions.merge()))
            Tasks.await(userDocument.set(mapOf("lastDeviceId" to device.deviceId), SetOptions.merge()))
            Log.d(
                TAG,
                "Device registration saved in Firestore for member=$memberId, deviceId=${device.deviceId}, tokenPresent=${device.fcmToken != null}, environment=$environment"
            )
            device
        }.onFailure { error ->
            Log.e(
                TAG,
                "Failed to save device registration in Firestore for member=$memberId, deviceId=${device.deviceId}",
                error
            )
        }.getOrDefault(device)
    }
}
