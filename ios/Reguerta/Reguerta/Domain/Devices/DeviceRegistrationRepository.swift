import Foundation

enum DeviceRegistrationRepositoryError: Error, Equatable {
    case staleSession
    case unavailable
}

@MainActor
protocol DeviceRegistrationRepository: Sendable {
    func register(
        memberId: String,
        environment: SessionEnvironment,
        device: RegisteredDevice,
        isRegistrationCurrent: @escaping @Sendable () async throws -> Bool
    ) async throws -> RegisteredDevice
}
