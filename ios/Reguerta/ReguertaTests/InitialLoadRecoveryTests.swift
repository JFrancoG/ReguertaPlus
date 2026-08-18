import Foundation
import Testing

@testable import Reguerta

@MainActor
struct InitialLoadRecoveryTests {
    @Test("La carga inicial reintenta a los diez segundos antes de informar de un fallo")
    func initialLoadRetriesAfterTenSeconds() async throws {
        let attempts = InitialLoadAttemptSequence(failuresBeforeSuccess: 1)
        let sleeper = InitialLoadRecoverySleeper()

        let value = try await performInitialLoadWithRecovery(
            enabled: true,
            sleeper: { duration in await sleeper.sleep(for: duration) },
            operation: { try await attempts.load() }
        )

        #expect(value == "loaded")
        #expect(await attempts.count == 2)
        #expect(await sleeper.requestedDurations == [.seconds(10)])
    }

    @Test("La carga inicial informa del fallo solo despues del reintento")
    func initialLoadReportsOnlyAfterRetryFails() async {
        let attempts = InitialLoadAttemptSequence(failuresBeforeSuccess: 2)
        let sleeper = InitialLoadRecoverySleeper()

        do {
            _ = try await performInitialLoadWithRecovery(
                enabled: true,
                sleeper: { duration in await sleeper.sleep(for: duration) },
                operation: { try await attempts.load() }
            )
            Issue.record("Los dos intentos debían fallar")
        } catch InitialLoadRecoveryTestError.rejected {
            #expect(await attempts.count == 2)
            #expect(await sleeper.requestedDurations == [.seconds(10)])
        } catch {
            Issue.record("Error inesperado: \(error)")
        }
    }

    @Test("Una carga manual no espera ni reintenta")
    func manualLoadFailsWithoutRecoveryDelay() async {
        let attempts = InitialLoadAttemptSequence(failuresBeforeSuccess: 1)
        let sleeper = InitialLoadRecoverySleeper()

        do {
            _ = try await performInitialLoadWithRecovery(
                enabled: false,
                sleeper: { duration in await sleeper.sleep(for: duration) },
                operation: { try await attempts.load() }
            )
            Issue.record("La primera lectura debía fallar")
        } catch InitialLoadRecoveryTestError.rejected {
            #expect(await attempts.count == 1)
            #expect(await sleeper.requestedDurations.isEmpty)
        } catch {
            Issue.record("Error inesperado: \(error)")
        }
    }

    @Test("Una carga inicial invalidada durante la espera no ejecuta un segundo intento")
    func invalidatedInitialLoadDoesNotRetry() async {
        let attempts = InitialLoadAttemptSequence(failuresBeforeSuccess: 1)
        var isCurrent = true

        do {
            _ = try await performInitialLoadWithRecovery(
                enabled: true,
                shouldRetry: { isCurrent },
                sleeper: { _ in isCurrent = false },
                operation: { try await attempts.load() }
            )
            Issue.record("La carga invalidada no debía recuperarse")
        } catch is CancellationError {
            #expect(await attempts.count == 1)
        } catch {
            Issue.record("Error inesperado: \(error)")
        }
    }
}

private enum InitialLoadRecoveryTestError: Error {
    case rejected
}

private actor InitialLoadAttemptSequence {
    private var remainingFailures: Int
    private(set) var count = 0

    init(failuresBeforeSuccess: Int) {
        self.remainingFailures = failuresBeforeSuccess
    }

    func load() throws -> String {
        count += 1
        if remainingFailures > 0 {
            remainingFailures -= 1
            throw InitialLoadRecoveryTestError.rejected
        }
        return "loaded"
    }
}

private actor InitialLoadRecoverySleeper {
    private(set) var requestedDurations: [Duration] = []

    func sleep(for duration: Duration) {
        requestedDurations.append(duration)
    }
}
