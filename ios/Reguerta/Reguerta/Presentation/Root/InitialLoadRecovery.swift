import Foundation

/// Retries an automatic initial load once before allowing its failure to reach global feedback.
///
/// Cancellation, stale operation fences, and explicitly non-recoverable loads never retry. A recovered second attempt
/// returns normally, so callers only publish the generic load-failure banner when both attempts fail for the same
/// fenced operation.
@MainActor
func performInitialLoadWithRecovery<Value>(
    enabled: Bool,
    retryDelay: Duration = .seconds(10),
    shouldRetry: @MainActor () -> Bool = { true },
    sleeper: @MainActor (Duration) async throws -> Void = {
        try await ContinuousClock().sleep(for: $0)
    },
    operation: @MainActor () async throws -> Value
) async throws -> Value {
    do {
        return try await operation()
    } catch is CancellationError {
        throw CancellationError()
    } catch {
        guard enabled, shouldRetry() else { throw error }
        try await sleeper(retryDelay)
        try Task.checkCancellation()
        guard shouldRetry() else { throw CancellationError() }
        return try await operation()
    }
}
