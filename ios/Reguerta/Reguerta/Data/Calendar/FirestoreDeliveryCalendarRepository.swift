import FirebaseFirestore
import Foundation

final class FirestoreDeliveryCalendarRepository: @unchecked Sendable, DeliveryCalendarRepository {
    private let db: Firestore
    private let environment: ReguertaFirestoreEnvironment?

    init(
        db: Firestore = Firestore.firestore(),
        environment: ReguertaFirestoreEnvironment? = nil
    ) {
        self.db = db
        self.environment = environment
    }

    func defaultDeliveryDayOfWeek() async -> DeliveryWeekday? {
        let path = ReguertaFirestorePath(environment: environment)
        let prefix = path.resolvedEnvironment.rawValue
        let candidatePaths = [
            path.documentPath(in: .config, documentId: ReguertaFirestoreDocument.global.rawValue),
            "\(prefix)/collections/config/\(ReguertaFirestoreDocument.global.rawValue)",
            "\(prefix)/config/\(ReguertaFirestoreDocument.global.rawValue)",
            "config/\(ReguertaFirestoreDocument.global.rawValue)",
        ]

        for documentPath in candidatePaths {
            do {
                let snapshot = try await db.document(documentPath).getDocument()
                guard let data = snapshot.data() else { continue }
                if let resolved = resolveDeliveryWeekday(data: data) {
                    return resolved
                }
            } catch {
                continue
            }
        }
        return nil
    }

    func allOverrides() async -> [DeliveryCalendarOverride] {
        let path = ReguertaFirestorePath(environment: environment)
        let prefix = path.resolvedEnvironment.rawValue
        let candidatePaths = [
            path.collectionPath(.deliveryCalendar),
            "\(prefix)/collections/deliveryCalendar",
            "\(prefix)/deliveryCalendar",
            "deliveryCalendar",
        ]

        for collectionPath in candidatePaths {
            do {
                let snapshot = try await db.collection(collectionPath).getDocuments()
                let overrides = snapshot.documents.compactMap { document -> DeliveryCalendarOverride? in
                    let data = document.data()
                    guard let deliveryDate = data["deliveryDate"] as? Timestamp else { return nil }
                    let deliveryDateSeconds = deliveryDate.dateValue().timeIntervalSince1970
                    let blockedSeconds = (data["ordersBlockedDate"] as? Timestamp)?.dateValue().timeIntervalSince1970
                        ?? (deliveryDateSeconds + 86_400)
                    let openSeconds = (data["ordersOpenAt"] as? Timestamp)?.dateValue().timeIntervalSince1970
                        ?? blockedSeconds
                    let closeSeconds = (data["ordersCloseAt"] as? Timestamp)?.dateValue().timeIntervalSince1970
                        ?? (blockedSeconds + 86_400)
                    let weekKey = ((data["weekKey"] as? String)?
                        .trimmingCharacters(in: .whitespacesAndNewlines))
                        .flatMap { $0.isEmpty ? nil : $0 } ?? document.documentID
                    let updatedBy = (data["updatedBy"] as? String)?
                        .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
                    let updatedAt = (data["updatedAt"] as? Timestamp)?.dateValue() ?? .distantPast
                    return DeliveryCalendarOverride(
                        weekKey: weekKey,
                        deliveryDateMillis: Int64(deliveryDateSeconds * 1000),
                        ordersBlockedDateMillis: Int64(blockedSeconds * 1000),
                        ordersOpenAtMillis: Int64(openSeconds * 1000),
                        ordersCloseAtMillis: Int64(closeSeconds * 1000),
                        updatedBy: updatedBy,
                        updatedAtMillis: Int64(updatedAt.timeIntervalSince1970 * 1000)
                    )
                }.sorted { $0.weekKey < $1.weekKey }
                if !overrides.isEmpty {
                    return overrides
                }
            } catch {
                continue
            }
        }
        return []
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

private func resolveDeliveryWeekday(data: [String: Any]) -> DeliveryWeekday? {
    let normalizedTopLevel = ((data["deliveryDayOfWeek"] as? String) ?? (data["deliveryDateOfWeek"] as? String) ?? "")
        .trimmingCharacters(in: .whitespacesAndNewlines)
        .uppercased()
    if let weekday = DeliveryWeekday(rawValue: normalizedTopLevel) {
        return weekday
    }

    guard let otherConfig = data["otherConfig"] as? [String: Any] else {
        return nil
    }
    let normalizedNested = ((otherConfig["deliveryDayOfWeek"] as? String) ?? (otherConfig["deliveryDateOfWeek"] as? String) ?? "")
        .trimmingCharacters(in: .whitespacesAndNewlines)
        .uppercased()
    return DeliveryWeekday(rawValue: normalizedNested)
}
