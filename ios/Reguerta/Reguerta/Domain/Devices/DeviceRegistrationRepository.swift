import Foundation

nonisolated enum DeviceRegistrationRepositoryError: Error, Equatable, Sendable {
    case staleSession
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
