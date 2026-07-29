package com.reguerta.user.data.devices

import android.util.Log
import com.google.firebase.Timestamp
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import com.reguerta.user.data.firestore.ReguertaFirestoreCollection
import com.reguerta.user.data.firestore.ReguertaFirestoreEnvironment
import com.reguerta.user.data.firestore.ReguertaFirestorePath
import com.reguerta.user.domain.devices.DeviceRegistrationRepository
import com.reguerta.user.domain.devices.RegisteredDevice
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext

class FirestoreDeviceRegistrationRepository(
    private val firestore: FirebaseFirestore,
) : DeviceRegistrationRepository {
    private companion object {
        const val TAG = "ReguertaPush"
    }

    override suspend fun registerDevice(
        memberId: String,
        environment: String,
        device: RegisteredDevice,
        isSessionCurrent: suspend () -> Boolean,
    ): RegisteredDevice = withContext(Dispatchers.IO) {
        ensureSessionCurrent(isSessionCurrent)
        val resolvedEnvironment = ReguertaFirestoreEnvironment.entries.firstOrNull { candidate ->
            candidate.wireValue == environment.trim().lowercase()
        } ?: error("Unsupported Firestore environment: $environment")
        val firestorePath = ReguertaFirestorePath(environment = resolvedEnvironment)
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

        try {
            val existing = deviceDocument.get().await()
            ensureSessionCurrent(isSessionCurrent)
            if (!existing.exists()) {
                payload["firstSeenAt"] = Timestamp(
                    device.firstSeenAtMillis / 1_000,
                    ((device.firstSeenAtMillis % 1_000) * 1_000_000).toInt(),
                )
            }
            // Keep legacy token fields explicitly empty on modern Android registrations.
            // iOS and pre-migration Android documents continue to use them during rollout.
            payload["fcmToken"] = null
            payload["tokenUpdatedAt"] = null
            payload["firebaseInstallationId"] = device.firebaseInstallationId
            payload["registrationUpdatedAt"] = device.registrationUpdatedAtMillis?.let {
                Timestamp(it / 1_000, ((it % 1_000) * 1_000_000).toInt())
            }
            val batch = firestore.batch()
            batch.set(deviceDocument, payload, SetOptions.merge())
            batch.set(
                userDocument,
                mapOf("lastDeviceId" to device.deviceId),
                SetOptions.merge(),
            )
            ensureSessionCurrent(isSessionCurrent)
            batch.commit().await()
            Log.d(TAG, "Device registration saved in Firestore")
            device
        } catch (error: CancellationException) {
            Log.d(TAG, "Device registration superseded before completion")
            throw error
        } catch (error: Throwable) {
            Log.e(TAG, "Failed to save device registration in Firestore")
            throw error
        }
    }

    private suspend fun ensureSessionCurrent(isSessionCurrent: suspend () -> Boolean) {
        if (!isSessionCurrent()) {
            throw CancellationException("Authorized device registration was superseded")
        }
    }
}
