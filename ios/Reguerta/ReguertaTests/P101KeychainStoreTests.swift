import Foundation
import Security
import Testing
@testable import Reguerta

struct P101KeychainStoreTests {
    @Test
    func missingItemIsTheOnlyReadThatBecomesNil() async throws {
        let store = KeychainStore(
            client: StubKeychainClient(readResult: .init(status: errSecItemNotFound, data: nil))
        )

        #expect(try await store.loadString(for: .fcmToken) == nil)
    }

    @Test
    func readFailureIsPropagatedWithItsOperationAndStatus() async {
        let store = KeychainStore(
            client: StubKeychainClient(readResult: .init(status: errSecInteractionNotAllowed, data: nil))
        )

        await #expect(
            throws: KeychainStoreError.operationFailed(
                operation: .read,
                status: errSecInteractionNotAllowed
            )
        ) {
            try await store.loadString(for: .fcmToken)
        }
    }

    @Test(arguments: [Data(), Data([0xFF]), Data(" \n".utf8)])
    func invalidSuccessfulStringReadsAreCorruption(data: Data) async {
        let store = KeychainStore(
            client: StubKeychainClient(readResult: .init(status: errSecSuccess, data: data))
        )

        await #expect(throws: KeychainStoreError.corruptedValue(key: .fcmToken)) {
            try await store.loadString(for: .fcmToken)
        }
    }

    @Test
    func successfulUpdateConfirmsTheSave() async throws {
        let store = KeychainStore(
            client: StubKeychainClient(updateStatus: errSecSuccess)
        )

        try await store.saveString(" token ", for: .fcmToken)
    }

    @Test
    func updateFailureIsNotReportedAsSuccess() async {
        let store = KeychainStore(
            client: StubKeychainClient(updateStatus: errSecAuthFailed)
        )

        await #expect(
            throws: KeychainStoreError.operationFailed(
                operation: .update,
                status: errSecAuthFailed
            )
        ) {
            try await store.saveString("token", for: .fcmToken)
        }
    }

    @Test
    func missingUpdateAddsAndChecksTheResult() async throws {
        let store = KeychainStore(
            client: StubKeychainClient(
                updateStatus: errSecItemNotFound,
                addStatus: errSecSuccess
            )
        )

        try await store.saveString("token", for: .fcmToken)
    }

    @Test
    func addFailureIsNotReportedAsSuccess() async {
        let store = KeychainStore(
            client: StubKeychainClient(
                updateStatus: errSecItemNotFound,
                addStatus: errSecNotAvailable
            )
        )

        await #expect(
            throws: KeychainStoreError.operationFailed(
                operation: .add,
                status: errSecNotAvailable
            )
        ) {
            try await store.saveString("token", for: .fcmToken)
        }
    }

    @Test(arguments: [errSecSuccess, errSecItemNotFound])
    func deleteTreatsSuccessAndAbsenceAsSuccessful(status: OSStatus) async throws {
        let store = KeychainStore(
            client: StubKeychainClient(deleteStatus: status)
        )

        try await store.remove(.fcmToken)
    }

    @Test
    func deleteFailureIsNotReportedAsSuccess() async {
        let store = KeychainStore(
            client: StubKeychainClient(deleteStatus: errSecInteractionNotAllowed)
        )

        await #expect(
            throws: KeychainStoreError.operationFailed(
                operation: .delete,
                status: errSecInteractionNotAllowed
            )
        ) {
            try await store.remove(.fcmToken)
        }
    }

    @Test
    func blankSaveUsesTheCheckedDeletePath() async {
        let store = KeychainStore(
            client: StubKeychainClient(deleteStatus: errSecNotAvailable)
        )

        await #expect(
            throws: KeychainStoreError.operationFailed(
                operation: .delete,
                status: errSecNotAvailable
            )
        ) {
            try await store.saveString(" \n", for: .fcmToken)
        }
    }

    @Test
    func invalidCodablePayloadIsCorruption() async {
        let store = KeychainStore(
            client: StubKeychainClient(
                readResult: .init(status: errSecSuccess, data: Data("not-json".utf8))
            )
        )

        await #expect(throws: KeychainStoreError.corruptedValue(key: .authorizedDeviceContext)) {
            try await store.load(
                KeychainTestPayload.self,
                for: .authorizedDeviceContext
            )
        }
    }
}

nonisolated private struct KeychainTestPayload: Codable, Equatable, Sendable {
    let value: String
}

nonisolated private struct StubKeychainClient: KeychainClient {
    let readResult: KeychainReadResult
    let updateStatus: OSStatus
    let addStatus: OSStatus
    let deleteStatus: OSStatus

    init(
        readResult: KeychainReadResult = .init(status: errSecItemNotFound, data: nil),
        updateStatus: OSStatus = errSecItemNotFound,
        addStatus: OSStatus = errSecSuccess,
        deleteStatus: OSStatus = errSecSuccess
    ) {
        self.readResult = readResult
        self.updateStatus = updateStatus
        self.addStatus = addStatus
        self.deleteStatus = deleteStatus
    }

    func read(service: String, account: String) -> KeychainReadResult {
        readResult
    }

    func update(service: String, account: String, data: Data) -> OSStatus {
        updateStatus
    }

    func add(service: String, account: String, data: Data) -> OSStatus {
        addStatus
    }

    func delete(service: String, account: String) -> OSStatus {
        deleteStatus
    }
}
