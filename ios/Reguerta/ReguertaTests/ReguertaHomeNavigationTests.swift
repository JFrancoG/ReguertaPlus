import Testing

@testable import Reguerta

@MainActor
struct ReguertaHomeNavigationTests {
    @Test func notificationEditorBackReturnsToDashboard() {
        let rootViewModel = ReguertaAppEnvironment.preview().accessRootViewModel
        rootViewModel.homeDestination = .adminBroadcast

        rootViewModel.handleHomePrimaryAction()

        #expect(rootViewModel.homeDestination == .dashboard)
    }
}
