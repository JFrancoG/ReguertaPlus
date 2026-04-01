import FirebaseFirestore
import Foundation

final class FirestoreDeviceRegistrationRepository: @unchecked Sendable, DeviceRegistrationRepository {
    private let db: Firestore
    private let environment: ReguertaFirestoreEnvironment

    init(
        db: Firestore = Firestore.firestore(),
        environment: ReguertaFirestoreEnvironment = .develop
    ) {
        self.db = db
        self.environment = environment
    }

    func register(memberId: String, device: RegisteredDevice) async -> RegisteredDevice {
        let userDocument = db.document(
            ReguertaFirestorePath(environment: environment)
                .documentPath(in: .users, documentId: memberId)
        )
        let deviceDocument = userDocument.collection("devices").document(device.deviceId)

        var payload: [String: Any] = [
            "deviceId": device.deviceId,
            "platform": device.platform,
            "appVersion": device.appVersion,
            "osVersion": device.osVersion,
            "lastSeenAt": Timestamp(date: Date(timeIntervalSince1970: TimeInterval(device.lastSeenAtMillis) / 1_000)),
        ]
        if let apiLevel = device.apiLevel {
            payload["apiLevel"] = apiLevel
        }
        if let manufacturer = device.manufacturer {
            payload["manufacturer"] = manufacturer
        }
        if let model = device.model {
            payload["model"] = model
        }

        do {
            let existing = try await deviceDocument.getDocument()
            if !existing.exists {
                payload["firstSeenAt"] = Timestamp(date: Date(timeIntervalSince1970: TimeInterval(device.firstSeenAtMillis) / 1_000))
            }
            payload["fcmToken"] = device.fcmToken ?? NSNull()
            payload["tokenUpdatedAt"] = device.tokenUpdatedAtMillis.map {
                Timestamp(date: Date(timeIntervalSince1970: TimeInterval($0) / 1_000))
            } ?? NSNull()
            try await deviceDocument.setData(payload, merge: true)
            try await userDocument.setData(["lastDeviceId": device.deviceId], merge: true)
            return device
        } catch {
            return device
        }
    }
}
