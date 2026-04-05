import Foundation

protocol ShiftSwapRequestRepository: Sendable {
    func allShiftSwapRequests() async -> [ShiftSwapRequest]
    func upsert(request: ShiftSwapRequest) async -> ShiftSwapRequest
}

