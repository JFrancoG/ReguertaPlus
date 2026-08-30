import FirebaseFirestore
import Foundation

@MainActor
final class FirestoreDeviceRegistrationRepository: DeviceRegistrationRepository {
    private let db: Firestore

    init(db: Firestore = Firestore.firestore()) {
        self.db = db
    }

    func register(
        memberId: String,
        environment: SessionEnvironment,
        device: RegisteredDevice,
        isRegistrationCurrent: @escaping @Sendable () async throws -> Bool
    ) async throws -> RegisteredDevice {
        guard try await isRegistrationCurrent() else { throw DeviceRegistrationRepositoryError.staleSession }
        let userDocument = db.document(
            ReguertaFirestorePath(environment: environment)
                .documentPath(in: .users, documentId: memberId)
        )
        let deviceDocument = userDocument.collection("devices").document(device.deviceId)

        var payload = registrationPayload(for: device)

        let existing: DocumentSnapshot
        do {
            existing = try await deviceDocument.getDocument()
        } catch is CancellationError {
            throw CancellationError()
        } catch {
            throw DeviceRegistrationRepositoryError.unavailable
        }
        guard try await isRegistrationCurrent() else { throw DeviceRegistrationRepositoryError.staleSession }
        if !existing.exists {
            payload["firstSeenAt"] = Timestamp(
                date: Date(timeIntervalSince1970: TimeInterval(device.firstSeenAtMillis) / 1_000)
            )
        }
        payload["fcmToken"] = device.fcmToken ?? NSNull()
        payload["tokenUpdatedAt"] = device.tokenUpdatedAtMillis.map {
            Timestamp(
                date: Date(timeIntervalSince1970: TimeInterval($0) / 1_000)
            )
        } ?? NSNull()

        let batch = db.batch()
        batch.setData(payload, forDocument: deviceDocument, merge: true)
        batch.setData(["lastDeviceId": device.deviceId], forDocument: userDocument, merge: true)
        guard try await isRegistrationCurrent() else { throw DeviceRegistrationRepositoryError.staleSession }
        do {
            try await batch.commit()
        } catch is CancellationError {
            throw CancellationError()
        } catch {
            throw deviceRegistrationCommitError(from: error)
        }
        return device
    }

    private func registrationPayload(for device: RegisteredDevice) -> [String: Any] {
        var payload: [String: Any] = [
            "deviceId": device.deviceId,
            "platform": device.platform,
            "appVersion": device.appVersion,
            "osVersion": device.osVersion,
            "lastSeenAt": Timestamp(date: Date(timeIntervalSince1970: TimeInterval(device.lastSeenAtMillis) / 1_000))
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
        return payload
    }
}

func deviceRegistrationCommitError(from error: any Error) -> DeviceRegistrationRepositoryError {
    let nsError = error as NSError
    guard nsError.domain == FirestoreErrorDomain,
          let code = FirestoreErrorCode.Code(rawValue: nsError.code),
          code == .permissionDenied else {
        return .unavailable
    }
    return .temporarilyBlocked
}
