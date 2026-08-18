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
        let canonicalKey = id.trimmingCharacters(in: .whitespacesAndNewlines)
        return canonicalKey.isEmpty ? [] : [canonicalKey]
    }
}
