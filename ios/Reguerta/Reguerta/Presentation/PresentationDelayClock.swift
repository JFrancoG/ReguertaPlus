import Foundation

/// Provides a cancellation-aware delay boundary for transient presentation state.
///
/// Implementations must propagate cancellation from the awaiting task. This keeps the ViewModel that owns a delayed
/// mutation authoritative, while tests can control suspension without depending on wall-clock time.
struct PresentationDelayClock {
    let sleep: @Sendable (Duration) async throws -> Void
}

extension PresentationDelayClock {
    static let continuous = PresentationDelayClock(
        sleep: { duration in
            try await ContinuousClock().sleep(for: duration)
        }
    )
}
