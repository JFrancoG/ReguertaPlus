import FirebaseFirestore
import Foundation

final class FirestoreDeliveryCalendarRepository: @unchecked Sendable, DeliveryCalendarRepository {
    private let db: Firestore
    private let environment: ReguertaFirestoreEnvironment

    init(
        db: Firestore = Firestore.firestore(),
        environment: ReguertaFirestoreEnvironment = .develop
    ) {
        self.db = db
        self.environment = environment
    }

    func defaultDeliveryDayOfWeek() async -> DeliveryWeekday? {
        do {
            let snapshot = try await db
                .reguertaDocument(.global, in: .config, environment: environment)
                .getDocument()
            guard let data = snapshot.data() else {
                return nil
            }
            if let topLevel = DeliveryWeekday(rawValue: (data["deliveryDayOfWeek"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines).uppercased()) {
                return topLevel
            }
            let otherConfig = data["otherConfig"] as? [String: Any]
            if let raw = otherConfig?["deliveryDayOfWeek"] as? String {
                return DeliveryWeekday(rawValue: raw.trimmingCharacters(in: .whitespacesAndNewlines).uppercased())
            }
            return nil
        } catch {
            return nil
        }
    }

    func allOverrides() async -> [DeliveryCalendarOverride] {
        do {
            let snapshot = try await db
                .reguertaCollection(.deliveryCalendar, environment: environment)
                .getDocuments()
            return snapshot.documents.compactMap { document in
                guard let data = document.data() as? [String: Any],
                      let deliveryDate = data["deliveryDate"] as? Timestamp,
                      let blockedDate = data["ordersBlockedDate"] as? Timestamp,
                      let openAt = data["ordersOpenAt"] as? Timestamp,
                      let closeAt = data["ordersCloseAt"] as? Timestamp
                else {
                    return nil
                }
                let weekKey = ((data["weekKey"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)).flatMap { $0.isEmpty ? nil : $0 } ?? document.documentID
                let updatedBy = (data["updatedBy"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
                let updatedAt = (data["updatedAt"] as? Timestamp)?.dateValue() ?? .distantPast
                return DeliveryCalendarOverride(
                    weekKey: weekKey,
                    deliveryDateMillis: Int64(deliveryDate.dateValue().timeIntervalSince1970 * 1000),
                    ordersBlockedDateMillis: Int64(blockedDate.dateValue().timeIntervalSince1970 * 1000),
                    ordersOpenAtMillis: Int64(openAt.dateValue().timeIntervalSince1970 * 1000),
                    ordersCloseAtMillis: Int64(closeAt.dateValue().timeIntervalSince1970 * 1000),
                    updatedBy: updatedBy,
                    updatedAtMillis: Int64(updatedAt.timeIntervalSince1970 * 1000)
                )
            }.sorted { $0.weekKey < $1.weekKey }
        } catch {
            return []
        }
    }

    func upsertOverride(_ override: DeliveryCalendarOverride) async -> DeliveryCalendarOverride {
        let payload: [String: Any] = [
            "weekKey": override.weekKey,
            "deliveryDate": Timestamp(date: Date(timeIntervalSince1970: TimeInterval(override.deliveryDateMillis) / 1000)),
            "ordersBlockedDate": Timestamp(date: Date(timeIntervalSince1970: TimeInterval(override.ordersBlockedDateMillis) / 1000)),
            "ordersOpenAt": Timestamp(date: Date(timeIntervalSince1970: TimeInterval(override.ordersOpenAtMillis) / 1000)),
            "ordersCloseAt": Timestamp(date: Date(timeIntervalSince1970: TimeInterval(override.ordersCloseAtMillis) / 1000)),
            "updatedBy": override.updatedBy,
            "updatedAt": Timestamp(date: Date(timeIntervalSince1970: TimeInterval(override.updatedAtMillis) / 1000)),
        ]
        try? await db
            .document(ReguertaFirestorePath(environment: environment).documentPath(in: .deliveryCalendar, documentId: override.weekKey))
            .setData(payload)
        return override
    }

    func deleteOverride(weekKey: String) async {
        try? await db
            .document(ReguertaFirestorePath(environment: environment).documentPath(in: .deliveryCalendar, documentId: weekKey))
            .delete()
    }
}
