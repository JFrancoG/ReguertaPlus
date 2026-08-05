import FirebaseFirestore
import Foundation
import Testing

@testable import Reguerta

@MainActor
struct StartupAndFreshnessConfigurationDecodingTests {
    @Test func startupConfigurationAcceptsValidDataAndRejectsMalformedData() throws {
        let validData: [String: Any] = [
            "versions": [
                "ios": [
                    "current": "1.2.0",
                    "min": "1.1.0",
                    "forceUpdate": false,
                    "storeUrl": "https://apps.apple.com/app/reguerta"
                ]
            ]
        ]

        #expect(
            try FirestoreStartupVersionPolicyRepository.policy(
                for: .ios,
                data: validData
            ).currentVersion == "1.2.0"
        )

        var invalidData = validData
        invalidData["versions"] = [
            "ios": [
                "current": "1.2.0",
                "min": "1.1.0",
                "forceUpdate": "false",
                "storeUrl": "https://apps.apple.com/app/reguerta"
            ]
        ]

        #expect(throws: RepositoryError.invalidData(resource: "config.public.versions.ios")) {
            try FirestoreStartupVersionPolicyRepository.policy(for: .ios, data: invalidData)
        }
    }

    @Test func freshnessConfigurationAcceptsValidDataAndRejectsMalformedData() throws {
        let timestamp = Timestamp(date: Date(timeIntervalSince1970: 1))
        let validData: [String: Any] = [
            "cacheExpirationMinutes": 15,
            "lastTimestamps": Dictionary(
                uniqueKeysWithValues: CriticalCollection.allCases.map { ($0.rawValue, timestamp) }
            )
        ]

        #expect(
            try FirestoreCriticalDataFreshnessRemoteRepository.config(
                data: validData
            ).remoteTimestampsMillis.count == CriticalCollection.allCases.count
        )

        var invalidData = validData
        invalidData["cacheExpirationMinutes"] = true

        #expect(throws: RepositoryError.invalidData(resource: "config.member")) {
            try FirestoreCriticalDataFreshnessRemoteRepository.config(data: invalidData)
        }
    }
}
