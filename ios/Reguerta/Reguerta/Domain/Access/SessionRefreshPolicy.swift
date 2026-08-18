import Foundation

enum SessionRefreshTrigger: Sendable {
    case startup
    case foreground
}

struct SessionRefreshPolicy {
    private let storedMinimumForegroundIntervalMillis: Int64

    var minimumForegroundIntervalMillis: Int64 { storedMinimumForegroundIntervalMillis }

    /// Decides whether the current session should be refreshed for a lifecycle trigger.
    ///
    /// Startup refreshes only when no successful refresh has been recorded. Foreground
    /// refreshes occur when there is no prior timestamp or the minimum interval has elapsed.
    /// A refresh already in flight always suppresses a second request.
    ///
    /// - Parameters:
    ///   - trigger: The lifecycle event requesting the refresh.
    ///   - lastRefreshAtMillis: The last successful refresh time in Unix milliseconds.
    ///   - nowMillis: The current time in Unix milliseconds.
    ///   - isRefreshInFlight: Whether another refresh currently owns the operation.
    /// - Returns: `true` when the caller should begin a new refresh.
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

extension SessionRefreshPolicy {
    init(minimumForegroundIntervalMillis: Int64 = 15_000) {
        self.storedMinimumForegroundIntervalMillis = minimumForegroundIntervalMillis
    }
}
