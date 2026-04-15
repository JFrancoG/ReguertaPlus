package com.reguerta.user.data.firestore

import com.reguerta.user.BuildConfig
import java.util.concurrent.atomic.AtomicReference

enum class ReguertaFirestoreEnvironment(val wireValue: String) {
    DEVELOP("develop"),
    PRODUCTION("production"),
}

enum class ReguertaFirestoreCollection(val pathComponent: String) {
    USERS("plus-collections/users"),
    PRODUCTS("plus-collections/products"),
    ORDERS("plus-collections/orders"),
    ORDER_LINES("plus-collections/orderlines"),
    SEASONAL_COMMITMENTS("plus-collections/seasonalCommitments"),
    CONFIG("plus-collections/config"),
    DELIVERY_CALENDAR("plus-collections/deliveryCalendar"),
    SHARED_PROFILES("plus-collections/sharedProfiles"),
    SHIFTS("plus-collections/shifts"),
    SHIFT_PLANNING_REQUESTS("plus-collections/shiftPlanningRequests"),
    SHIFT_SWAP_REQUESTS("plus-collections/shiftSwapRequests"),
    NEWS("plus-collections/news"),
    NOTIFICATION_EVENTS("plus-collections/notificationEvents"),
}

enum class ReguertaFirestoreDocument(val wireValue: String) {
    GLOBAL("global"),
}

data class ReguertaFirestorePath(
    val environment: ReguertaFirestoreEnvironment? = null,
) {
    private val resolvedEnvironment: ReguertaFirestoreEnvironment
        get() = environment ?: ReguertaRuntimeEnvironment.currentFirestoreEnvironment()

    fun collectionPath(collection: ReguertaFirestoreCollection): String =
        "${resolvedEnvironment.wireValue}/${collection.pathComponent}"

    fun documentPath(
        collection: ReguertaFirestoreCollection,
        documentId: String,
    ): String = "${collectionPath(collection)}/$documentId"
}

object ReguertaRuntimeEnvironment {
    private val sessionOverride = AtomicReference<ReguertaFirestoreEnvironment?>(null)
    @Volatile
    private var testingBaseEnvironment: ReguertaFirestoreEnvironment? = null

    val baseFirestoreEnvironment: ReguertaFirestoreEnvironment
        get() = testingBaseEnvironment ?: if (BuildConfig.DEBUG) {
            ReguertaFirestoreEnvironment.DEVELOP
        } else {
            ReguertaFirestoreEnvironment.PRODUCTION
        }

    fun currentFirestoreEnvironment(): ReguertaFirestoreEnvironment =
        sessionOverride.get() ?: baseFirestoreEnvironment

    fun applySessionEnvironment(environment: ReguertaFirestoreEnvironment) {
        sessionOverride.set(if (environment == baseFirestoreEnvironment) null else environment)
    }

    fun resetToBaseEnvironment() {
        sessionOverride.set(null)
    }

    internal fun setBaseEnvironmentForTesting(environment: ReguertaFirestoreEnvironment?) {
        testingBaseEnvironment = environment
        resetToBaseEnvironment()
    }
}
