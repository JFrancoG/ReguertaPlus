import Foundation

enum SessionRefreshTrigger: Sendable {
    case startup
    case foreground
}

struct SessionRefreshPolicy: Sendable {
    let minimumForegroundIntervalMillis: Int64

    init(minimumForegroundIntervalMillis: Int64 = 15_000) {
        self.minimumForegroundIntervalMillis = minimumForegroundIntervalMillis
    }

    func shouldRefresh(
        trigger: SessionRefreshTrigger,
        lastRefreshAtMillis: Int64?,
        nowMillis: Int64,
        isRefreshInFlight: Bool
    ) -> Bool {
        if isRefreshInFlight {
            return false
        }

        switch trigger {
        case .startup:
            return lastRefreshAtMillis == nil
        case .foreground:
            guard let lastRefreshAtMillis else { return true }
            return nowMillis - lastRefreshAtMillis >= minimumForegroundIntervalMillis
        }
    }
}
