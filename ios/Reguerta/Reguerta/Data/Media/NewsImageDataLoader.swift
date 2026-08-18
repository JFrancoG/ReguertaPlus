import Foundation

struct NewsImageDataResponse {
    let data: Data
    let statusCode: Int?
}

protocol NewsImageDataFetching: Sendable {
    func data(for request: URLRequest) async throws -> NewsImageDataResponse
}

struct URLSessionNewsImageDataFetcher: NewsImageDataFetching {
    private let storedSession: URLSession

    var session: URLSession { storedSession }

    func data(for request: URLRequest) async throws -> NewsImageDataResponse {
        let (data, response) = try await storedSession.data(for: request)
        return NewsImageDataResponse(
            data: data,
            statusCode: (response as? HTTPURLResponse)?.statusCode
        )
    }
}

enum NewsImageDataLoaderError: Error, Equatable {
    case invalidResponse
    case httpStatus(Int)
    case emptyData
}

struct NewsImageDataLoader {
    private let storedFetcher: any NewsImageDataFetching

    func load(from url: URL) async throws -> Data {
        let request = URLRequest(
            url: url,
            cachePolicy: .reloadRevalidatingCacheData,
            timeoutInterval: 30
        )
        let response = try await storedFetcher.data(for: request)
        guard let statusCode = response.statusCode else { throw NewsImageDataLoaderError.invalidResponse }
        guard (200 ..< 300).contains(statusCode) else { throw NewsImageDataLoaderError.httpStatus(statusCode) }
        guard !response.data.isEmpty else { throw NewsImageDataLoaderError.emptyData }
        return response.data
    }
}

extension URLSessionNewsImageDataFetcher {
    init(session: URLSession = .shared) {
        self.storedSession = session
    }
}

extension NewsImageDataLoader {
    init(fetcher: any NewsImageDataFetching = URLSessionNewsImageDataFetcher()) {
        self.storedFetcher = fetcher
    }
}
