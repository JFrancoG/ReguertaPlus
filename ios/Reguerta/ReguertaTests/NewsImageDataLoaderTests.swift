import Foundation
import Testing

@testable import Reguerta

@MainActor
struct NewsImageDataLoaderTests {
    @Test
    func loadsNonEmptyDataFromSuccessfulHTTPResponse() async throws {
        let expectedData = Data([1, 2, 3])
        let loader = NewsImageDataLoader(
            fetcher: StubNewsImageDataFetcher(
                response: NewsImageDataResponse(data: expectedData, statusCode: 200)
            )
        )

        let data = try await loader.load(from: try #require(URL(string: "https://cdn.test/news.jpg")))

        #expect(data == expectedData)
    }

    @Test
    func rejectsUnsuccessfulHTTPResponse() async throws {
        let loader = NewsImageDataLoader(
            fetcher: StubNewsImageDataFetcher(
                response: NewsImageDataResponse(data: Data([1]), statusCode: 404)
            )
        )

        await #expect(throws: NewsImageDataLoaderError.httpStatus(404)) {
            try await loader.load(from: try #require(URL(string: "https://cdn.test/missing.jpg")))
        }
    }

    @Test
    func rejectsEmptyImagePayload() async throws {
        let loader = NewsImageDataLoader(
            fetcher: StubNewsImageDataFetcher(
                response: NewsImageDataResponse(data: Data(), statusCode: 200)
            )
        )

        await #expect(throws: NewsImageDataLoaderError.emptyData) {
            try await loader.load(from: try #require(URL(string: "https://cdn.test/empty.jpg")))
        }
    }
}

private struct StubNewsImageDataFetcher: NewsImageDataFetching {
    let response: NewsImageDataResponse

    func data(for request: URLRequest) async throws -> NewsImageDataResponse {
        response
    }
}
