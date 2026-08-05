import FirebaseFirestore
import Foundation
import OSLog

nonisolated enum FirestoreRepositoryErrorMapper {
    private static let logger = Logger(
        subsystem: "com.reguerta.app",
        category: "FirestoreRepository"
    )

    static func map(_ error: any Error, resource: String) -> any Error {
        if error is CancellationError {
            return error
        }
        if let repositoryError = error as? RepositoryError {
            return repositoryError
        }

        let nsError = error as NSError
        guard nsError.domain == FirestoreErrorDomain,
              let code = FirestoreErrorCode.Code(rawValue: nsError.code) else {
            log(error: error, resource: resource)
            return RepositoryError.unknown(resource: resource)
        }

        let mappedError: any Error = switch code {
        case .cancelled:
            CancellationError()
        case .notFound:
            RepositoryError.notFound(resource: resource)
        case .permissionDenied, .unauthenticated:
            RepositoryError.permissionDenied(resource: resource)
        case .deadlineExceeded, .resourceExhausted, .aborted, .internal, .unavailable:
            RepositoryError.unavailable(resource: resource)
        case .dataLoss:
            RepositoryError.invalidData(resource: resource)
        default:
            RepositoryError.unknown(resource: resource)
        }

        if !(mappedError is CancellationError) {
            log(error: error, resource: resource)
        }
        return mappedError
    }

    private static func log(error: any Error, resource: String) {
        logger.error(
            // swiftlint:disable:next line_length
            "Firestore operation failed for \(resource, privacy: .private): \(String(describing: error), privacy: .private)"
        )
    }
}
