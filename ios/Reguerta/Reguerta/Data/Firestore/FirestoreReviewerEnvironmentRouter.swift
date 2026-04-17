import FirebaseFirestore
import Foundation

final class FirestoreReviewerEnvironmentRouter: @unchecked Sendable, ReviewerEnvironmentRouter {
    private let db: Firestore

    init(db: Firestore = Firestore.firestore()) {
        self.db = db
    }

    func applyRouting(for principal: AuthPrincipal) async {
        guard ReguertaRuntimeEnvironment.baseFirestoreEnvironment == .production else {
            ReguertaRuntimeEnvironment.resetToBaseEnvironment()
            return
        }
        let policy = await loadReviewerPolicy()
        let normalizedEmail = principal.email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let isAllowlisted = policy.emails.contains(normalizedEmail) || policy.uids.contains(principal.uid)
        let reviewerRoutingEnabled = MemberPermissionMatrix.reviewerCapabilities.contains(.routeProductionReviewerToDevelop)
        ReguertaRuntimeEnvironment.applySessionEnvironment((isAllowlisted && reviewerRoutingEnabled) ? .develop : .production)
    }

    func resetToBaseEnvironment() {
        ReguertaRuntimeEnvironment.resetToBaseEnvironment()
    }

    private func loadReviewerPolicy() async -> ReviewerRoutingPolicy {
        let candidates = [
            "production/plus-collections/config/global",
            "production/collections/config/global",
            "production/config/global",
        ]

        for path in candidates {
            do {
                let snapshot = try await db.document(path).getDocument()
                guard snapshot.exists, let payload = snapshot.data() else { continue }
                return ReviewerRoutingPolicy.from(payload: payload)
            } catch {
                continue
            }
        }
        return .empty
    }
}

private struct ReviewerRoutingPolicy {
    let emails: Set<String>
    let uids: Set<String>

    static let empty = ReviewerRoutingPolicy(emails: [], uids: [])

    static func from(payload: [String: Any]) -> ReviewerRoutingPolicy {
        let rootEmails = payload.extractStringSet(
            keys: ["reviewerAllowlistEmails", "reviewerAllowlist", "reviewerEmails"]
        )
        let rootUids = payload.extractStringSet(
            keys: ["reviewerAllowlistUids", "reviewerUids"]
        )
        let nestedAllowlist = payload["reviewerAllowlist"] as? [String: Any]
        let nestedEmails = nestedAllowlist?.extractStringSet(keys: ["emails", "allowlistedEmails"]) ?? []
        let nestedUids = nestedAllowlist?.extractStringSet(keys: ["uids", "allowlistedUids"]) ?? []
        return ReviewerRoutingPolicy(
            emails: Set((rootEmails + nestedEmails).map { $0.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() }),
            uids: Set((rootUids + nestedUids).map { $0.trimmingCharacters(in: .whitespacesAndNewlines) })
        )
    }
}

private extension Dictionary where Key == String, Value == Any {
    func extractStringSet(keys: [String]) -> [String] {
        guard !keys.isEmpty else { return [] }
        var values = [String]()
        for key in keys {
            let value = self[key]
            switch value {
            case let string as String:
                let normalized = string.trimmingCharacters(in: .whitespacesAndNewlines)
                if !normalized.isEmpty {
                    values.append(normalized)
                }
            case let array as [Any]:
                for item in array {
                    guard let string = item as? String else { continue }
                    let normalized = string.trimmingCharacters(in: .whitespacesAndNewlines)
                    if !normalized.isEmpty {
                        values.append(normalized)
                    }
                }
            default:
                break
            }
        }
        return values
    }
}
