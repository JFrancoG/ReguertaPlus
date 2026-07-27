import Foundation

nonisolated enum AuthorizedDeviceRegistrationResult: Equatable, Sendable {
    case registered
    case skipped
    case failed
}

protocol AuthorizedDeviceRegistrar: Sendable {
    func register(member: Member) async -> AuthorizedDeviceRegistrationResult
}
