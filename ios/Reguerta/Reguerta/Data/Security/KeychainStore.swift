import Foundation
import Security

nonisolated enum KeychainKey: String, Equatable, Sendable {
    case fcmToken = "push.fcm_token"
    case authorizedDeviceContext = "push.authorized_device_context.v1"
    case legacyAuthorizedMemberId = "push.authorized_member_id"
}

nonisolated enum KeychainOperation: Equatable, Sendable {
    case read
    case update
    case add
    case delete
}

nonisolated enum KeychainStoreError: Error, Equatable, Sendable {
    case operationFailed(operation: KeychainOperation, status: OSStatus)
    case corruptedValue(key: KeychainKey)
    case encodingFailed(key: KeychainKey)
}

nonisolated struct KeychainReadResult {
    let status: OSStatus
    let data: Data?
}

nonisolated protocol KeychainClient: Sendable {
    func read(service: String, account: String) -> KeychainReadResult
    func update(service: String, account: String, data: Data) -> OSStatus
    func add(service: String, account: String, data: Data) -> OSStatus
    func delete(service: String, account: String) -> OSStatus
}

nonisolated struct SystemKeychainClient: KeychainClient {
    func read(service: String, account: String) -> KeychainReadResult {
        let query: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: account,
            kSecReturnData: true,
            kSecMatchLimit: kSecMatchLimitOne
        ]
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        return KeychainReadResult(status: status, data: item as? Data)
    }

    func update(service: String, account: String, data: Data) -> OSStatus {
        let query = itemQuery(service: service, account: account)
        let attributes: [CFString: Any] = [
            kSecValueData: data,
            kSecAttrAccessible: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        ]
        return SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
    }

    func add(service: String, account: String, data: Data) -> OSStatus {
        var query = itemQuery(service: service, account: account)
        query[kSecValueData] = data
        query[kSecAttrAccessible] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        return SecItemAdd(query as CFDictionary, nil)
    }

    func delete(service: String, account: String) -> OSStatus {
        SecItemDelete(itemQuery(service: service, account: account) as CFDictionary)
    }

    private func itemQuery(service: String, account: String) -> [CFString: Any] {
        [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: account
        ]
    }
}

actor KeychainStore {
    private let client: any KeychainClient
    private let service: String

    init(client: any KeychainClient = SystemKeychainClient(), service: String = "com.reguerta.app.secure-storage") {
        self.client = client
        self.service = service
    }

    func loadString(for key: KeychainKey) throws -> String? {
        guard let data = try loadData(for: key) else { return nil }
        guard
            let value = String(data: data, encoding: .utf8),
            let normalizedValue = normalize(value)
        else {
            throw KeychainStoreError.corruptedValue(key: key)
        }
        return normalizedValue
    }

    func saveString(_ value: String?, for key: KeychainKey) throws {
        guard let normalizedValue = normalize(value) else {
            try remove(key)
            return
        }
        try upsert(Data(normalizedValue.utf8), for: key)
    }

    func load<Value: Decodable & Sendable>(
        _ type: Value.Type,
        for key: KeychainKey
    ) throws -> Value? {
        guard let data = try loadData(for: key) else { return nil }
        do {
            return try JSONDecoder().decode(type, from: data)
        } catch {
            throw KeychainStoreError.corruptedValue(key: key)
        }
    }

    func save<Value: Encodable & Sendable>(
        _ value: Value,
        for key: KeychainKey
    ) throws {
        let data: Data
        do {
            data = try JSONEncoder().encode(value)
        } catch {
            throw KeychainStoreError.encodingFailed(key: key)
        }
        try upsert(data, for: key)
    }

    func remove(_ key: KeychainKey) throws {
        let status = client.delete(service: service, account: key.rawValue)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw KeychainStoreError.operationFailed(operation: .delete, status: status)
        }
    }

    func remove<Value: Decodable & Equatable & Sendable>(
        _ key: KeychainKey,
        ifMatching expectedValue: Value
    ) throws -> Bool {
        guard let storedValue = try load(Value.self, for: key) else { return false }
        guard storedValue == expectedValue else { return false }
        try remove(key)
        return true
    }

    private func loadData(for key: KeychainKey) throws -> Data? {
        let result = client.read(service: service, account: key.rawValue)
        if result.status == errSecItemNotFound {
            return nil
        }
        guard result.status == errSecSuccess else {
            throw KeychainStoreError.operationFailed(operation: .read, status: result.status)
        }
        guard let data = result.data, !data.isEmpty else {
            throw KeychainStoreError.corruptedValue(key: key)
        }
        return data
    }

    private func upsert(_ data: Data, for key: KeychainKey) throws {
        let updateStatus = client.update(
            service: service,
            account: key.rawValue,
            data: data
        )
        if updateStatus == errSecSuccess {
            return
        }
        guard updateStatus == errSecItemNotFound else {
            throw KeychainStoreError.operationFailed(operation: .update, status: updateStatus)
        }

        let addStatus = client.add(
            service: service,
            account: key.rawValue,
            data: data
        )
        if addStatus == errSecSuccess {
            return
        }
        if addStatus == errSecDuplicateItem {
            let retryStatus = client.update(
                service: service,
                account: key.rawValue,
                data: data
            )
            guard retryStatus == errSecSuccess else {
                throw KeychainStoreError.operationFailed(operation: .update, status: retryStatus)
            }
            return
        }
        throw KeychainStoreError.operationFailed(operation: .add, status: addStatus)
    }

    private func normalize(_ value: String?) -> String? {
        guard let value else { return nil }
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
