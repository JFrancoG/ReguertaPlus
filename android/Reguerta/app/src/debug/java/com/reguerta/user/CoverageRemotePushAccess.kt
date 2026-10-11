package com.reguerta.user

import android.app.Activity
import android.content.Context
import android.util.Log
import com.google.firebase.FirebaseApp
import com.google.firebase.messaging.FirebaseMessaging
import java.io.File
import com.reguerta.user.domain.shiftcoverage.*
import org.json.JSONObject

/** Transport-only sample: no Auth, Firestore or mutable business repository. */
internal class CoverageRemotePushAccess : CoverageRehearsalAccess, ShiftCoverageRepository {
    override val repository: ShiftCoverageRepository get() = this
    private val snapshot = ShiftCoverageSnapshot(
        schemaVersion = 1, environment = "develop", memberId = "ana", isAdmin = false,
        eligible = true, serverTimeMillis = 1_800_000_000_000, policyRevision = "hu084-provisional-v1",
        policy = ShiftCoverageSnapshot.Policy(86_400_000, 3_600_000, false),
        cases = listOf(ShiftCoverageSnapshot.Case(
            caseId = "preview-case", shiftId = "market-next", type = ShiftCoverageSnapshot.Kind.market,
            positionIndex = 0, status = ShiftCoverageSnapshot.Status.offered, revision = 2, shiftRevision = 1,
            scheduledAtMillis = 1_800_100_000_000, writable = false, absentUserId = "ana", acceptedUserId = null,
            offer = ShiftCoverageSnapshot.Offer("ana", ShiftCoverageSnapshot.OfferSource.admin, 1_800_080_000_000),
            selectionPhase = null, volunteerClosesAtMillis = null, volunteered = false,
            updatedAtMillis = 1_800_000_000_000, administration = null,
        )),
        credits = emptyList(), reserves = emptyList(),
        members = listOf(ShiftCoverageSnapshot.MemberLabel("ana", "Ana de prueba")),
        notifications = listOf(ShiftCoverageSnapshot.Notification(eventId, 1_800_000_000_000)),
        notification = ShiftCoverageSnapshot.NotificationReference(eventId, "preview-case", 2),
    )

    override suspend fun signIn(email: String, password: String): ShiftCoverageSession = throw ShiftCoverageFailure.Unavailable
    override fun signOut() {}
    override suspend fun read(caseId: String?, session: ShiftCoverageSession) = snapshot
    override suspend fun readNotification(eventId: String, session: ShiftCoverageSession): ShiftCoverageSnapshot {
        if (eventId != Companion.eventId) throw ShiftCoverageFailure.Unavailable
        return snapshot
    }
    override suspend fun execute(command: ShiftCoverageCommand, session: ShiftCoverageSession): Unit = throw ShiftCoverageFailure.Unavailable

    companion object {
        val eventId = "coverage-" + "84".repeat(32)
        val session = ShiftCoverageSession("preview", "ana", 1)

        fun registerDestination(activity: Activity) {
            val options = FirebaseApp.getInstance().options
            check(activity.packageName == "com.reguerta.user.debug" && options.projectId == "reguerta-9f27f" &&
                options.applicationId == "1:195744802339:android:65308f6405a03baaadb396") {
                "Real coverage push requires the registered Reguerta Android Debug configuration"
            }
            File(activity.noBackupFilesDir, "coverage-push-destination.json").delete()
            FirebaseMessaging.getInstance().register().addOnFailureListener(activity) {
                Log.e("CoverageRemotePush", "Cannot register rehearsal installation")
            }
        }

        /** FCM invokes this only after registering the installation, including subsequent renewals. */
        fun saveRegisteredDestination(context: Context, id: String) {
            val options = FirebaseApp.getInstance().options
            if (!BuildConfig.COVERAGE_REMOTE_PUSH_REHEARSAL || context.packageName != "com.reguerta.user.debug" ||
                options.projectId != "reguerta-9f27f" ||
                options.applicationId != "1:195744802339:android:65308f6405a03baaadb396" || id.isBlank()) return
            val destination = JSONObject().put("projectId", options.projectId).put("appId", options.applicationId)
                .put("bundleId", context.packageName).put("platform", "android").put("firebaseInstallationId", id)
            try {
                File(context.noBackupFilesDir, "coverage-push-destination.json").writeText(destination.toString())
                Log.i("CoverageRemotePush", "Registered destination saved in private app storage")
            } catch (_: Exception) {
                Log.e("CoverageRemotePush", "Cannot save rehearsal destination")
            }
        }
    }
}
