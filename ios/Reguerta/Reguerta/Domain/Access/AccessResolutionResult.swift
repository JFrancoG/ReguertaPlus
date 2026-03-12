import Foundation

enum UnauthorizedReason: Equatable, Sendable {
    case userNotAuthorized
}

enum AccessResolutionResult: Equatable, Sendable {
    case authorized(Member)
    case unauthorized(UnauthorizedReason)
}
