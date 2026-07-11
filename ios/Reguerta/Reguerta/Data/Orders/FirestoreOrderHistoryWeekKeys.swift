import FirebaseFirestore
import Foundation

func fetchOrderHistoryWeekKeys(
    currentMember: Member?,
    db: Firestore = Firestore.firestore(),
    environment: ReguertaFirestoreEnvironment = ReguertaRuntimeEnvironment.currentFirestoreEnvironment
) async throws -> [String] {
    guard let member = currentMember else {
        return []
    }

    let firestorePath = ReguertaFirestorePath(environment: environment)
    let targets = resolvePreviousOrderReadTargets(firestorePath: firestorePath)
    var weekKeys = Set<String>()
    var lastError: Error?
    var hasSuccessfulRead = false

    for target in targets {
        do {
            let targetWeekKeys = try await fetchOrderHistoryWeekKeys(
                target: target,
                memberId: member.id,
                db: db
            )
            hasSuccessfulRead = true
            weekKeys.formUnion(targetWeekKeys)
        } catch {
            lastError = error
        }
    }

    if !hasSuccessfulRead, let lastError {
        throw lastError
    }

    return weekKeys.sorted()
}

func fetchOldestOrderHistoryWeekKey(
    db: Firestore = Firestore.firestore(),
    environment: ReguertaFirestoreEnvironment = ReguertaRuntimeEnvironment.currentFirestoreEnvironment
) async throws -> String? {
    let ordersPath = ReguertaFirestorePath(environment: environment).collectionPath(.orders)
    let snapshot = try await db.collection(ordersPath)
        .order(by: "weekKey")
        .limit(to: 1)
        .getDocuments()
    guard let document = snapshot.documents.first else { return nil }
    return orderHistoryWeekKey(from: document.data(), documentID: document.documentID)
}

private func fetchOrderHistoryWeekKeys(
    target: MyOrderCheckoutWriteTarget,
    memberId: String,
    db: Firestore
) async throws -> Set<String> {
    var weekKeys = Set<String>()
    var hasSuccessfulRead = false
    var lastError: Error?

    for fieldName in ["userId", "memberId"] {
        do {
            let ordersSnapshot = try await db.collection(target.orders)
                .whereField(fieldName, isEqualTo: memberId)
                .getDocuments()
            hasSuccessfulRead = true
            for document in ordersSnapshot.documents {
                if let weekKey = orderHistoryWeekKey(from: document.data(), documentID: document.documentID) {
                    weekKeys.insert(weekKey)
                }
            }
        } catch {
            lastError = error
        }

        do {
            let linesSnapshot = try await db.collection(target.orderlines)
                .whereField(fieldName, isEqualTo: memberId)
                .getDocuments()
            hasSuccessfulRead = true
            for document in linesSnapshot.documents {
                if let weekKey = orderHistoryWeekKey(from: document.data(), documentID: document.documentID) {
                    weekKeys.insert(weekKey)
                }
            }
        } catch {
            lastError = error
        }
    }

    if !hasSuccessfulRead, let lastError {
        throw lastError
    }
    return weekKeys
}

private func orderHistoryWeekKey(from data: [String: Any], documentID: String) -> String? {
    if let weekKey = (data["weekKey"] as? String)?
        .trimmingCharacters(in: .whitespacesAndNewlines),
       weekKey.isValidIsoWeekKey {
        return weekKey
    }
    return documentID.components(separatedBy: "_")
        .last(where: \.isValidIsoWeekKey)
}
