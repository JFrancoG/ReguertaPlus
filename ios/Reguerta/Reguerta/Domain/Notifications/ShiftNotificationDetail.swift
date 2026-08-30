import Foundation

struct ShiftNotificationDetail: Equatable {
    let eventID: String
    let assignmentRevision: Int64
    let documentRevision: Int64
    let shift: ShiftAssignment
}

protocol ShiftNotificationDetailRepository: Sendable {
    @MainActor func currentDetail(
        eventID: String,
        memberID: String,
        environment: SessionEnvironment
    ) async throws -> ShiftNotificationDetail
}

struct UnavailableShiftNotificationDetailRepository: ShiftNotificationDetailRepository {
    @MainActor func currentDetail(
        eventID _: String,
        memberID _: String,
        environment _: SessionEnvironment
    ) async throws -> ShiftNotificationDetail {
        throw RepositoryError.unavailable(resource: "notifications.shiftDetail")
    }
}
