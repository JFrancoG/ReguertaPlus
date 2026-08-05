import Testing

@testable import Reguerta

@MainActor
struct FirebaseAuthenticationMutationFlowTests {
    @Test("Un checkpoint Firebase limpia una mutación que termina después de cancelar")
    func checkpointSignsOutBeforeReturning() async {
        let phase = ControlledFirebaseMutationPhase()
        var events: [FirebaseMutationCheckpointEvent] = []
        let task = Task { @MainActor in
            do {
                _ = try await awaitFirebaseAuthenticationMutation {
                    await phase.run()
                    return "authenticated"
                } signOut: {
                    events.append(.signedOut)
                    return true
                }
                events.append(.continued)
            } catch let failure as FirebaseAuthenticationContinuationError {
                #expect(failure.underlyingError is CancellationError)
                #expect(failure.signedOut)
                events.append(.cancelled)
            } catch {
                Issue.record("El checkpoint propagó un error inesperado: \(error)")
            }
        }

        guard await phase.waitUntilStarted() else { return }
        task.cancel()
        await phase.complete()
        await task.value
        #expect(events == [.signedOut, .cancelled])
    }

    @Test("El checkpoint limpia también si Firebase lanza cancelación")
    func checkpointSignsOutForMutationCancellationError() async {
        var signOutCallCount = 0
        let mutation: () async throws -> String = { throw CancellationError() }
        do {
            _ = try await awaitFirebaseAuthenticationMutation(mutation) {
                signOutCallCount += 1
                return false
            }
            Issue.record("La cancelación de Firebase no se propagó")
        } catch let failure as FirebaseAuthenticationContinuationError {
            #expect(failure.underlyingError is CancellationError)
            #expect(failure.signedOut == false)
            #expect(signOutCallCount == 1)
        } catch {
            Issue.record("La mutación propagó un error inesperado: \(error)")
        }
    }

    @Test("El flujo no vuelve a envolver una cancelación ya limpiada")
    func flowPreservesNestedMutationCleanupResult() async {
        var signOutCallCount = 0
        do {
            let _: String = try await awaitFirebaseAuthenticationFlow {
                "authenticated"
            } continuation: { _ in
                try await awaitFirebaseAuthenticationMutation {
                    throw CancellationError()
                } signOut: {
                    signOutCallCount += 1
                    return false
                }
            } signOut: {
                signOutCallCount += 1
                return true
            }
            Issue.record("La cancelación posterior a Auth no se propagó")
        } catch let failure as FirebaseAuthenticationContinuationError {
            #expect(failure.underlyingError is CancellationError)
            #expect(failure.signedOut == false)
            #expect(signOutCallCount == 1)
        } catch {
            Issue.record("El flujo propagó un error inesperado: \(error)")
        }
    }

    @Test("Una cancelación directa de la continuación conserva el cleanup")
    func directContinuationCancellationPreservesCleanupResult() async {
        var signOutCallCount = 0
        do {
            let _: String = try await awaitFirebaseAuthenticationFlow {
                "authenticated"
            } continuation: { _ in
                throw CancellationError()
            } signOut: {
                signOutCallCount += 1
                return true
            }
            Issue.record("La cancelación de continuación no se propagó")
        } catch let failure as FirebaseAuthenticationContinuationError {
            #expect(failure.underlyingError is CancellationError)
            #expect(failure.signedOut)
            #expect(signOutCallCount == 1)
        } catch {
            Issue.record("El flujo propagó un error inesperado: \(error)")
        }
    }

    @Test("Un fallo tras mutar Auth fuerza sign-out y conserva su resultado")
    func continuationFailureForcesSignOut() async {
        var signOutCallCount = 0
        do {
            let _: String = try await awaitFirebaseAuthenticationFlow {
                "authenticated"
            } continuation: { _ in
                throw FirebaseAuthenticationMutationTestError.continuation
            } signOut: {
                signOutCallCount += 1
                return false
            }
            Issue.record("El fallo posterior a la mutación no se propagó")
        } catch let failure as FirebaseAuthenticationContinuationError {
            #expect(failure.underlyingError is FirebaseAuthenticationMutationTestError)
            #expect(failure.signedOut == false)
            #expect(signOutCallCount == 1)
        } catch {
            Issue.record("El flujo propagó un error inesperado: \(error)")
        }
    }

    @Test("Un fallo previo a mutar Auth no cierra una sesión ajena") func initialMutationFailureDoesNotSignOut() async {
        var signOutCallCount = 0
        let mutation: () async throws -> String = {
            throw FirebaseAuthenticationMutationTestError.initial
        }
        do {
            let _: String = try await awaitFirebaseAuthenticationFlow(
                mutation,
                continuation: { $0 },
                signOut: {
                    signOutCallCount += 1
                    return true
                }
            )
            Issue.record("El fallo inicial de Firebase no se propagó")
        } catch FirebaseAuthenticationMutationTestError.initial {
            #expect(signOutCallCount == 0)
        } catch {
            Issue.record("El flujo propagó un error inesperado: \(error)")
        }
    }
}

private enum FirebaseAuthenticationMutationTestError: Error {
    case initial
    case continuation
}

private enum FirebaseMutationCheckpointEvent: Equatable {
    case signedOut
    case continued
    case cancelled
}

private actor ControlledFirebaseMutationPhase {
    private var started = false
    private var continuation: CheckedContinuation<Void, Never>?

    func run() async {
        started = true
        await withCheckedContinuation { continuation in
            self.continuation = continuation
        }
    }

    func waitUntilStarted() async -> Bool {
        for _ in 0 ..< 1_000 {
            if started {
                return true
            }
            await Task.yield()
        }
        Issue.record("La mutación Firebase controlada no se inició")
        return false
    }

    func complete() {
        let continuation = continuation
        self.continuation = nil
        continuation?.resume()
    }
}
