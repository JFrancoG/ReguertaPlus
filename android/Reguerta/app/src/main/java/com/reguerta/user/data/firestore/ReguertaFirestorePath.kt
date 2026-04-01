package com.reguerta.user.data.firestore

enum class ReguertaFirestoreEnvironment(val wireValue: String) {
    DEVELOP("develop"),
    PRODUCTION("production"),
}

enum class ReguertaFirestoreCollection(val pathComponent: String) {
    USERS("plus-collections/users"),
    CONFIG("plus-collections/config"),
    SHARED_PROFILES("plus-collections/sharedProfiles"),
    NEWS("plus-collections/news"),
    NOTIFICATION_EVENTS("plus-collections/notificationEvents"),
}

enum class ReguertaFirestoreDocument(val wireValue: String) {
    GLOBAL("global"),
}

data class ReguertaFirestorePath(
    val environment: ReguertaFirestoreEnvironment = ReguertaFirestoreEnvironment.DEVELOP,
) {
    fun collectionPath(collection: ReguertaFirestoreCollection): String =
        "${environment.wireValue}/${collection.pathComponent}"

    fun documentPath(
        collection: ReguertaFirestoreCollection,
        documentId: String,
    ): String = "${collectionPath(collection)}/$documentId"
}
