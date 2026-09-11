package com.reguerta.user.presentation.shifts

import androidx.test.platform.app.InstrumentationRegistry
import com.google.android.gms.tasks.Tasks
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Source
import com.reguerta.user.data.firestore.ReguertaFirestoreEnvironment
import com.reguerta.user.data.shifts.FirestoreShiftRepository
import com.reguerta.user.domain.shifts.ShiftType
import java.util.UUID
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assume.assumeTrue
import org.junit.Test

/** Opt-in SDK + production presentation acceptance; the demo project cannot reach live data. */
class ShiftSheetsEmulatorAcceptanceTest {
    @Test
    fun replacementSynchronizationAndRecoveryRefreshTheSameRepository() = runBlocking {
        assumeTrue(InstrumentationRegistry.getArguments().getString("hu083Acceptance") == "true")
        val app = FirebaseApp.initializeApp(
            InstrumentationRegistry.getInstrumentation().targetContext,
            FirebaseOptions.Builder()
                .setApplicationId("1:1234567890:android:0123456789abcdef")
                .setApiKey("A00000000000000000000000000000000000000")
                .setProjectId("demo-hu083-develop-rehearsal")
                .build(),
            "hu083-${UUID.randomUUID()}",
        )
        val database = FirebaseFirestore.getInstance(app)
        database.useEmulator("10.0.2.2", 8797)
        val repository = FirestoreShiftRepository(database, ReguertaFirestoreEnvironment.DEVELOP)
        try {
            for (phase in listOf("forward", "synchronize", "restore")) {
                val oracle = advance(phase, database)
                val shifts = repository.getAllShifts()
                assertEquals(shifts.map { it.dateMillis }.sorted(), shifts.map { it.dateMillis })
                val expected = oracle.getJSONArray("rows")
                assertEquals(expected.length(), shifts.size)
                shifts.sortedBy { it.id }.forEachIndexed { index, shift ->
                    val row = expected.getJSONObject(index)
                    assertEquals(row.getString("id"), shift.id)
                    assertEquals(row.getString("type"), shift.type.name.lowercase())
                    assertEquals(row.getLong("dateMillis"), shift.dateMillis)
                    val assigned = row.getJSONArray("assignedUserIds")
                    assertEquals((0 until assigned.length()).map(assigned::getString), shift.assignedUserIds)
                    assertEquals(row.nullableString("helperUserId"), shift.helperUserId)
                    assertEquals(row.getString("status"), shift.status.name.lowercase())
                    assertEquals(row.getString("source"), shift.source)
                }
                val member = oracle.getString("memberId")
                val now = oracle.getLong("nowMillis")
                assertEquals(
                    oracle.nullableString("nextLeadId"),
                    shifts.nextDeliveryLeadShift(member, emptyList(), now)?.id,
                )
                assertEquals(
                    oracle.nullableString("nextHelperId"),
                    shifts.nextDeliveryHelperShift(member, emptyList(), now)?.id,
                )
                assertEquals(
                    oracle.nullableString("nextMarketId"),
                    shifts.nextMarketAssignedShift(member, emptyList(), now)?.id,
                )
                assertEquals(
                    oracle.nullableString("boardDeliveryId"),
                    shifts.filter { it.type == ShiftType.DELIVERY }.shiftBoardWindow(emptyList(), now).highlightedShiftId,
                )
            }
        } finally {
            try {
                Tasks.await(database.terminate(), 10, TimeUnit.SECONDS)
            } finally {
                app.delete()
            }
        }
    }

    private suspend fun advance(action: String, database: FirebaseFirestore): JSONObject {
        val command = database.collection("hu083AcceptanceCommands").document()
        Tasks.await(command.set(mapOf("action" to action)), 10, TimeUnit.SECONDS)
        val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(45)
        while (System.nanoTime() < deadline) {
            val snapshot = Tasks.await(command.get(Source.SERVER), 10, TimeUnit.SECONDS)
            check(snapshot.getString("error") == null) { "Local acceptance controller failed" }
            snapshot.getString("oracle")?.let { return JSONObject(it) }
            delay(100)
        }
        error("Local acceptance controller timed out")
    }

    private fun JSONObject.nullableString(key: String): String? = if (isNull(key)) null else getString(key)
}
