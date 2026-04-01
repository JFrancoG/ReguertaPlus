import Foundation
import Security

actor KeyManager {
    private static let service = "com.reguerta.app.secure-storage"

    enum Key: String {
        case fcmToken = "push.fcm_token"
        case authorizedMemberId = "push.authorized_member_id"
    }

    static let shared = KeyManager()

    func save(_ value: String?, for key: Key) {
        let normalizedValue = normalize(value)
        if let normalizedValue {
            upsert(normalizedValue, for: key)
        } else {
            remove(key)
        }
    }

    func load(_ key: Key) -> String? {
        let query: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: Self.service,
            kSecAttrAccount: key.rawValue,
            kSecReturnData: true,
            kSecMatchLimit: kSecMatchLimitOne,
        ]

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard
            status == errSecSuccess,
            let data = item as? Data,
            let value = String(data: data, encoding: .utf8)
        else {
            return nil
        }
        return normalize(value)
    }

    func remove(_ key: Key) {
        let query: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: Self.service,
            kSecAttrAccount: key.rawValue,
        ]
        SecItemDelete(query as CFDictionary)
    }

    private func upsert(_ value: String, for key: Key) {
        let data = Data(value.utf8)
        let query: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: Self.service,
            kSecAttrAccount: key.rawValue,
        ]
        let attributes: [CFString: Any] = [
            kSecValueData: data,
            kSecAttrAccessible: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
        ]

        let status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            var insertQuery = query
            insertQuery[kSecValueData] = data
            insertQuery[kSecAttrAccessible] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            SecItemAdd(insertQuery as CFDictionary, nil)
        }
    }

    private func normalize(_ value: String?) -> String? {
        guard let value else { return nil }
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
