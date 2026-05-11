import Foundation

extension AuthorizedSession {
    var membersById: [String: Member] {
        Dictionary(uniqueKeysWithValues: members.map { ($0.id, $0) })
    }
}

extension Optional where Wrapped == Member {
    var isVisibleForOrdering: Bool {
        guard let self else { return true }
        return self.isActive && self.producerCatalogEnabled
    }
}

extension Member {
    var seasonalCommitmentLookupKeys: [String] {
        var keys: [String] = [id]
        if let authUid = authUid?.trimmingCharacters(in: .whitespacesAndNewlines), !authUid.isEmpty {
            keys.append(authUid)
        }
        let emailKey = normalizedEmail.trimmingCharacters(in: .whitespacesAndNewlines)
        if !emailKey.isEmpty {
            keys.append(emailKey)
        }
        return keys
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .reduce(into: [String]()) { acc, key in
                if !acc.contains(key) {
                    acc.append(key)
                }
            }
    }
}
