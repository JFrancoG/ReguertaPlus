import Foundation

extension SessionMode {
    var isAuthenticatedSession: Bool {
        switch self {
        case .authorized, .unauthorized:
            return true
        case .signedOut:
            return false
        }
    }
}
