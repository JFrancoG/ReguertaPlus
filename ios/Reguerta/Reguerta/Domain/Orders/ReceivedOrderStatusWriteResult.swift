enum ReceivedOrderStatusWriteResult: Equatable, Sendable {
    case success
    case permissionDenied
    case failure
}
