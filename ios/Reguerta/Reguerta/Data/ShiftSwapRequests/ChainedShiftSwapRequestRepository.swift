import Foundation

struct ChainedShiftSwapRequestRepository: ShiftSwapRequestRepository {
    let primary: any ShiftSwapRequestRepository
    let fallback: any ShiftSwapRequestRepository

    func allShiftSwapRequests() async -> [ShiftSwapRequest] {
        let primaryResult = await primary.allShiftSwapRequests()
        return primaryResult.isEmpty ? await fallback.allShiftSwapRequests() : primaryResult
    }

    func upsert(request: ShiftSwapRequest) async -> ShiftSwapRequest {
        await primary.upsert(request: request)
    }
}
