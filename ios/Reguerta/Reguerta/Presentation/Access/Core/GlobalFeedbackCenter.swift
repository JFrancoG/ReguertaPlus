import Observation

@Observable
final class GlobalFeedbackCenter {
    var messageKey: String?

    func show(_ messageKey: String?) {
        self.messageKey = messageKey
    }

    func clear() {
        messageKey = nil
    }
}
