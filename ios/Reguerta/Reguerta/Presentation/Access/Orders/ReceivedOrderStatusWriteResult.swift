import FirebaseFirestore
import Foundation

enum ReceivedOrderStatusWriteResult: Equatable {
    case success
    case permissionDenied
    case failure
}

func receivedOrderStatusWriteResult(from error: Error) -> ReceivedOrderStatusWriteResult {
    let nsError = error as NSError
    return nsError.code == 7 ? .permissionDenied : .failure
}
