import Testing

@testable import Reguerta

@MainActor
struct ShiftNotificationPushRoutingTests {
    @Test func canonicalGenericReferenceIsAccepted() throws {
        let reference = try #require(ShiftNotificationPushReference.validated(
            eventID: "bundle-v2-1234567890abcdef12345678-notification-1",
            type: "shift_updated",
            target: "users"
        ))

        #expect(reference.eventID == "bundle-v2-1234567890abcdef12345678-notification-1")
    }

    @Test(arguments: [
        ("", "shift_updated", "users"),
        ("event/1", "shift_updated", "users"),
        ("event-1", "admin_broadcast", "users"),
        ("event-1", "shift_updated", "all")
    ])
    func malformedOrNonGenericReferenceIsRejected(eventID: String, type: String, target: String) {
        #expect(ShiftNotificationPushReference.validated(eventID: eventID, type: type, target: target) == nil)
    }

    @Test func consumingOlderReferencePreservesNewerPush() throws {
        let first = try #require(ShiftNotificationPushReference.validated(
            eventID: "event-1",
            type: "shift_updated",
            target: "users"
        ))
        let second = try #require(ShiftNotificationPushReference.validated(
            eventID: "event-2",
            type: "shift_updated",
            target: "users"
        ))
        let store = ShiftNotificationPushOpenStore()

        store.accept(first)
        store.accept(second)
        store.consume(first)

        #expect(store.pendingReference == second)
    }
}
