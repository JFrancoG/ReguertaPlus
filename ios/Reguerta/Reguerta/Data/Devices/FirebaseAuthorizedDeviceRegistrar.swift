import FirebaseMessaging
import Foundation
import UIKit

final class FirebaseAuthorizedDeviceRegistrar: @unchecked Sendable, AuthorizedDeviceRegistrar {
    private let repository: any DeviceRegistrationRepository
    private let nowMillisProvider: @Sendable () -> Int64
    private let keyManager: KeyManager

    init(
        repository: any DeviceRegistrationRepository,
        keyManager: KeyManager = .shared,
        nowMillisProvider: @escaping @Sendable () -> Int64 = { Int64(Date().timeIntervalSince1970 * 1_000) }
    ) {
        self.repository = repository
        self.keyManager = keyManager
        self.nowMillisProvider = nowMillisProvider
    }

    func register(member: Member) async {
        await keyManager.save(member.id, for: .authorizedMemberId)
        let nowMillis = nowMillisProvider()
        let token = await fetchFcmTokenWithRetry()?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfBlank

        _ = await repository.register(
            memberId: member.id,
            device: RegisteredDevice(
                deviceId: UIDevice.current.identifierForVendor?.uuidString ?? "ios-\(UIDevice.current.model)",
                platform: "ios",
                appVersion: resolveInstalledAppVersion(),
                osVersion: UIDevice.current.systemVersion,
                apiLevel: nil,
                manufacturer: "Apple",
                model: UIDevice.current.model.nilIfBlank,
                fcmToken: token,
                firstSeenAtMillis: nowMillis,
                lastSeenAtMillis: nowMillis,
                tokenUpdatedAtMillis: token == nil ? nil : nowMillis
            )
        )
    }

    private func fetchFcmToken() async -> String? {
        await withCheckedContinuation { continuation in
            Messaging.messaging().token { token, _ in
                continuation.resume(returning: token)
            }
        }
    }

    private func fetchFcmTokenWithRetry() async -> String? {
        if let firstAttempt = await fetchFcmToken() {
            return firstAttempt
        }
        try? await Task.sleep(for: .milliseconds(1_500))
        if let secondAttempt = await fetchFcmToken() {
            return secondAttempt
        }
        return await keyManager.load(.fcmToken)
    }
}

private extension String {
    var nilIfBlank: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
