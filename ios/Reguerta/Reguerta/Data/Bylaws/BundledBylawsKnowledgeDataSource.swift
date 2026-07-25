import Foundation

enum BylawsKnowledgeDataError: Error, Equatable {
    case resourceMissing
    case invalidSchema
}

actor BundledBylawsKnowledgeDataSource: BylawsKnowledgeProviding {
    private var cachedIndex: BylawsKnowledgeIndex?

    func loadIndex() async throws -> BylawsKnowledgeIndex {
        if let cachedIndex {
            return cachedIndex
        }

        let index = try loadBundledBylawsIndex()
        cachedIndex = index
        return index
    }
}

nonisolated func loadBundledBylawsIndex() throws -> BylawsKnowledgeIndex {
    guard let url = resolveBundledBylawsURL(
        fileName: "bylaws-index-es",
        fileExtension: "json"
    ) else {
        throw BylawsKnowledgeDataError.resourceMissing
    }

    let data = try Data(contentsOf: url)
    let payload = try JSONDecoder().decode(BylawsKnowledgePayload.self, from: data)
    guard payload.metadata.schemaVersion == 2,
          payload.metadata.pageCount == 13,
          !payload.chunks.isEmpty,
          payload.chunks.allSatisfy(\.isValid)
    else {
        throw BylawsKnowledgeDataError.invalidSchema
    }

    return BylawsKnowledgeIndex(
        schemaVersion: payload.metadata.schemaVersion,
        pageCount: payload.metadata.pageCount,
        articles: payload.chunks.map(\.domainModel)
    )
}

nonisolated private struct BylawsKnowledgePayload: Decodable {
    let metadata: Metadata
    let chunks: [Chunk]

    nonisolated struct Metadata: Decodable {
        let pageCount: Int
        let schemaVersion: Int
    }

    nonisolated struct Chunk: Decodable {
        let id: String
        let kind: String
        let articleNumber: Int?
        let pageStart: Int
        let pageEnd: Int
        let title: String
        let text: String
        let searchAliases: [String]

        var isValid: Bool {
            !id.isEmpty
                && !kind.isEmpty
                && pageStart >= 1
                && pageEnd >= pageStart
                && pageEnd <= 13
                && !title.isEmpty
                && !text.isEmpty
                && !searchAliases.isEmpty
        }

        var domainModel: BylawsArticle {
            BylawsArticle(
                id: id,
                kind: kind,
                articleNumber: articleNumber,
                pageStart: pageStart,
                pageEnd: pageEnd,
                title: title,
                text: text,
                searchAliases: searchAliases
            )
        }
    }
}

nonisolated func resolveBundledBylawsURL(
    fileName: String,
    fileExtension: String
) -> URL? {
    let subdirectories = ["bylaws", "Resources/bylaws", "Resources"]
    for bundle in [Bundle.main] {
        for subdirectory in subdirectories {
            if let url = bundle.url(
                forResource: fileName,
                withExtension: fileExtension,
                subdirectory: subdirectory
            ) {
                return url
            }
        }
        if let url = bundle.url(forResource: fileName, withExtension: fileExtension) {
            return url
        }
    }
    return nil
}
