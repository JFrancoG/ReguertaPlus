import Foundation

extension AccessRootRoutingView {
    func localizedDateTime(_ millis: Int64) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: Date(timeIntervalSince1970: TimeInterval(millis) / 1_000))
    }

    func localizedDateOnly(_ millis: Int64) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter.string(from: Date(timeIntervalSince1970: TimeInterval(millis) / 1_000))
    }

    func localizedNotificationDate(_ millis: Int64) -> String {
        let formatter = DateFormatter()
        formatter.locale = .current
        formatter.dateFormat = "dd MMMM yyyy"
        return formatter.string(from: Date(timeIntervalSince1970: TimeInterval(millis) / 1_000))
    }
}
