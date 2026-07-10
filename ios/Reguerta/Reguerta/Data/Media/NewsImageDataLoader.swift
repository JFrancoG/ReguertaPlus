import Foundation

struct NewsImageDataResponse: Sendable {
    let data: Data
    let statusCode: Int?
}

protocol NewsImageDataFetching: Sendable {
    func data(for request: URLRequest) async throws -> NewsImageDataResponse
}

struct URLSessionNewsImageDataFetcher: NewsImageDataFetching {
    let session: URLSession

    init(session: URLSession = .shared) {
        self.session = session
    }

    func data(for request: URLRequest) async throws -> NewsImageDataResponse {
        let (data, response) = try await session.data(for: request)
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

struct NewsImageDataLoader: Sendable {
    private let fetcher: any NewsImageDataFetching

    init(fetcher: any NewsImageDataFetching = URLSessionNewsImageDataFetcher()) {
        self.fetcher = fetcher
    }

    func load(from url: URL) async throws -> Data {
        let request = URLRequest(
            url: url,
            cachePolicy: .reloadRevalidatingCacheData,
            timeoutInterval: 30
        )
        let response = try await fetcher.data(for: request)
        guard let statusCode = response.statusCode else {
            throw NewsImageDataLoaderError.invalidResponse
        }
        guard (200 ..< 300).contains(statusCode) else {
            throw NewsImageDataLoaderError.httpStatus(statusCode)
        }
        guard !response.data.isEmpty else {
            throw NewsImageDataLoaderError.emptyData
        }
        return response.data
    }
}
