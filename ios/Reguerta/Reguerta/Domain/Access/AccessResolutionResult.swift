import Foundation

enum UnauthorizedReason: Equatable, Sendable {
    case userNotFoundInAuthorizedUsers
    case userAccessRestricted
}

enum AccessResolutionResult: Equatable, Sendable {
    case authorized(Member)
    case unauthorized(UnauthorizedReason)
}
