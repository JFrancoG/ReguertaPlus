import OSLog

let myOrderFreshnessLogger = Logger(
    subsystem: "com.reguerta.app",
    category: "CriticalFreshness"
)

enum MyOrderFreshnessState: Equatable, Sendable {
    case idle
    case checking
    case ready
    case timedOut
    case unavailable
}

struct FreshnessOperationHandle {
    let generation: UInt64
    let task: Task<Void, Never>
}
