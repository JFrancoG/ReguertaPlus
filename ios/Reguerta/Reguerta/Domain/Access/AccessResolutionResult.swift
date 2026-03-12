import Foundation

enum AccessResolutionResult: Equatable, Sendable {
    case authorized(Member)
    case unauthorized(String)
}
