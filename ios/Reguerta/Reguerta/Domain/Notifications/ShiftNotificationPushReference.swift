import Foundation

struct ShiftNotificationPushReference: Equatable {
    let eventID: String

    var isCoverage: Bool { eventID.range(of: #"^coverage-[a-f0-9]{64}$"#, options: .regularExpression) != nil }

    static func validated(eventID: String?, type: String?, target: String?) -> ShiftNotificationPushReference? {
        guard type == "shift_updated",
              target == "users",
              let eventID,
              eventID.range(
                  of: #"^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$"#,
                  options: .regularExpression
              ) != nil else {
            return nil
        }
        return ShiftNotificationPushReference(eventID: eventID)
    }
}
