import Foundation

struct ShiftNotificationPushReference: Equatable {
    let eventID: String

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
