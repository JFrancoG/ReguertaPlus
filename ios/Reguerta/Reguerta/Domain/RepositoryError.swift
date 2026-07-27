import Foundation

nonisolated enum RepositoryError: Error, Equatable, Sendable {
    case notFound(resource: String)
    case unavailable(resource: String)
    case permissionDenied(resource: String)
    case invalidData(resource: String)
    case unknown(resource: String)
}
