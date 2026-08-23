import Testing

@testable import Reguerta

@Suite("Home dashboard initial VoiceOver focus")
struct HomeDashboardInitialVoiceOverFocusTests {
    @Test func disabledVoiceOverDoesNotConsumeTheRouteEntryRequest() {
        var gate = HomeDashboardInitialVoiceOverFocusGate()

        let disabledRequest = gate.requestFocusIfNeeded(isVoiceOverEnabled: false, isTargetMounted: true)
        let enabledRequest = gate.requestFocusIfNeeded(isVoiceOverEnabled: true, isTargetMounted: true)

        #expect(disabledRequest == false)
        #expect(enabledRequest)
    }

    @Test func anUnavailableTargetDoesNotConsumeTheRouteEntryRequest() {
        var gate = HomeDashboardInitialVoiceOverFocusGate()

        let unavailableRequest = gate.requestFocusIfNeeded(isVoiceOverEnabled: true, isTargetMounted: false)
        let mountedRequest = gate.requestFocusIfNeeded(isVoiceOverEnabled: true, isTargetMounted: true)

        #expect(unavailableRequest == false)
        #expect(mountedRequest)
    }

    @Test func aRefreshCannotRequestInitialFocusAgain() {
        var gate = HomeDashboardInitialVoiceOverFocusGate()

        let initialRequest = gate.requestFocusIfNeeded(isVoiceOverEnabled: true, isTargetMounted: true)
        let refreshRequest = gate.requestFocusIfNeeded(isVoiceOverEnabled: true, isTargetMounted: true)

        #expect(initialRequest)
        #expect(refreshRequest == false)
    }

    @Test func aNewDashboardRouteEntryReceivesANewFocusRequest() {
        var firstEntryGate = HomeDashboardInitialVoiceOverFocusGate()
        var secondEntryGate = HomeDashboardInitialVoiceOverFocusGate()

        let firstEntryRequest = firstEntryGate.requestFocusIfNeeded(
            isVoiceOverEnabled: true,
            isTargetMounted: true
        )
        let repeatedFirstEntryRequest = firstEntryGate.requestFocusIfNeeded(
            isVoiceOverEnabled: true,
            isTargetMounted: true
        )
        let secondEntryRequest = secondEntryGate.requestFocusIfNeeded(
            isVoiceOverEnabled: true,
            isTargetMounted: true
        )

        #expect(firstEntryRequest)
        #expect(repeatedFirstEntryRequest == false)
        #expect(secondEntryRequest)
    }
}
