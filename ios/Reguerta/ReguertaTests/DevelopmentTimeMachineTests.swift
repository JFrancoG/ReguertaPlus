import Foundation
import Testing

@testable import Reguerta

@MainActor
struct DevelopmentTimeMachineTests {
    @Test func fallsBackToInjectedSystemTimeWithoutAnOverride() {
        guard let isolatedDefaults = makeIsolatedDefaults() else { return }
        defer { isolatedDefaults.defaults.removePersistentDomain(forName: isolatedDefaults.suiteName) }
        let timeMachine = DevelopmentTimeMachine(
            defaults: isolatedDefaults.defaults,
            systemNowMillisProvider: { 1_234 }
        )

        #expect(timeMachine.overrideNowMillis == nil)
        #expect(timeMachine.nowMillis() == 1_234)
    }

    @Test func persistsOverrideForTheNextOwnerInstance() {
        guard let isolatedDefaults = makeIsolatedDefaults() else { return }
        defer { isolatedDefaults.defaults.removePersistentDomain(forName: isolatedDefaults.suiteName) }
        let firstOwner = DevelopmentTimeMachine(defaults: isolatedDefaults.defaults)
        firstOwner.setOverrideNowMillis(9_876)

        let restoredOwner = DevelopmentTimeMachine(defaults: isolatedDefaults.defaults)

        #expect(restoredOwner.overrideNowMillis == 9_876)
        #expect(restoredOwner.nowMillis() == 9_876)
    }

    @Test func typedInitialOverrideTakesPrecedenceOverPersistedProductionState() {
        guard let isolatedDefaults = makeIsolatedDefaults() else { return }
        defer { isolatedDefaults.defaults.removePersistentDomain(forName: isolatedDefaults.suiteName) }
        let persistedOwner = DevelopmentTimeMachine(defaults: isolatedDefaults.defaults)
        persistedOwner.setOverrideNowMillis(9_876)

        let launchConfiguredOwner = DevelopmentTimeMachine(
            defaults: isolatedDefaults.defaults,
            initialOverrideNowMillis: 1_778_760_000_000
        )

        #expect(launchConfiguredOwner.overrideNowMillis == 1_778_760_000_000)
        #expect(launchConfiguredOwner.nowMillis() == 1_778_760_000_000)
    }

    @Test func independentlyComposedOwnersDoNotShareOverrides() {
        guard let firstDefaults = makeIsolatedDefaults(),
              let secondDefaults = makeIsolatedDefaults() else {
            return
        }
        defer {
            firstDefaults.defaults.removePersistentDomain(forName: firstDefaults.suiteName)
            secondDefaults.defaults.removePersistentDomain(forName: secondDefaults.suiteName)
        }
        let firstOwner = DevelopmentTimeMachine(defaults: firstDefaults.defaults)
        let secondOwner = DevelopmentTimeMachine(
            defaults: secondDefaults.defaults,
            systemNowMillisProvider: { 42 }
        )

        firstOwner.setOverrideNowMillis(99)

        #expect(firstOwner.nowMillis() == 99)
        #expect(secondOwner.overrideNowMillis == nil)
        #expect(secondOwner.nowMillis() == 42)
    }

    @Test func transientOwnersRestoreOnlyTheirTypedInitialOverride() {
        let firstOwner = DevelopmentTimeMachine.transient(initialOverrideNowMillis: 1_778_760_000_000)
        firstOwner.setOverrideNowMillis(99)

        let secondOwner = DevelopmentTimeMachine.transient(initialOverrideNowMillis: 1_778_760_000_000)

        #expect(firstOwner.nowMillis() == 99)
        #expect(secondOwner.overrideNowMillis == 1_778_760_000_000)
        #expect(secondOwner.nowMillis() == 1_778_760_000_000)
    }

    private func makeIsolatedDefaults() -> (defaults: UserDefaults, suiteName: String)? {
        let suiteName = "DevelopmentTimeMachineTests.\(UUID().uuidString)"
        guard let defaults = UserDefaults(suiteName: suiteName) else {
            Issue.record("Could not create isolated UserDefaults suite")
            return nil
        }
        defaults.removePersistentDomain(forName: suiteName)
        return (defaults, suiteName)
    }
}
