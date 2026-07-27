import Foundation

nonisolated enum UnauthorizedReason: Equatable, Sendable {
    case userNotFoundInAuthorizedUsers
    case userAccessRestricted
    case emailVerificationRequired
}

nonisolated enum AccessResolutionResult: Equatable, Sendable {
    case authorized(Member)
    case unauthorized(UnauthorizedReason)
}
