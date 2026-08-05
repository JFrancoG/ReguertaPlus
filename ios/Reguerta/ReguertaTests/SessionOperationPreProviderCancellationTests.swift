import Testing

@testable import Reguerta

extension SessionOperationInvalidationTests {
    @Test("Un cierre inmediato termina el login antes de invocar al proveedor")
    func immediateSignOutFinishesPreProviderSignIn() async {
        let scenario = makeSessionTimeoutScenario()
        populateValidPreProviderSignIn(in: scenario)

        scenario.viewModel.signIn()
        guard let operation = scenario.viewModel.sessionOperationTask else {
            Issue.record("El login no conserva su operación propietaria")
            return
        }
        scenario.viewModel.signOut()
        await operation.value

        assertPreProviderTermination(in: scenario)
        #expect(scenario.provider.signInRequestCount == 0)
    }

    @Test("Un cierre inmediato termina el alta antes de invocar al proveedor")
    func immediateSignOutFinishesPreProviderSignUp() async {
        let scenario = makeSessionTimeoutScenario()
        scenario.viewModel.registerEmailInput = "new-member@example.com"
        scenario.viewModel.registerPasswordInput = "secret12"
        scenario.viewModel.registerRepeatPasswordInput = "secret12"

        scenario.viewModel.signUp()
        guard let operation = scenario.viewModel.sessionOperationTask else {
            Issue.record("El alta no conserva su operación propietaria")
            return
        }
        scenario.viewModel.signOut()
        await operation.value

        assertPreProviderTermination(in: scenario)
        #expect(scenario.provider.signUpRequestCount == 0)
    }

    @Test("Un cierre inmediato termina el refresh antes de invocar al proveedor")
    func immediateSignOutFinishesPreProviderRefresh() async {
        let scenario = makeSessionTimeoutScenario(isAuthenticated: true)
        scenario.viewModel.mode = timeoutAuthorizedMode(
            member: scenario.member,
            principal: scenario.principal
        )

        scenario.viewModel.refreshSession(trigger: .startup)
        guard let operation = scenario.viewModel.sessionOperationTask else {
            Issue.record("El refresh no conserva su operación propietaria")
            return
        }
        scenario.viewModel.signOut()
        await operation.value

        assertPreProviderTermination(in: scenario)
        #expect(scenario.provider.refreshRequestCount == 0)
    }
}

@MainActor private func populateValidPreProviderSignIn(in scenario: SessionTimeoutScenario) {
    scenario.viewModel.emailInput = scenario.member.normalizedEmail
    scenario.viewModel.passwordInput = "secret12"
}

@MainActor private func assertPreProviderTermination(in scenario: SessionTimeoutScenario) {
    #expect(scenario.viewModel.mode == .signedOut)
    #expect(scenario.viewModel.sessionOperationState == .idle)
    #expect(scenario.viewModel.sessionOperationTask == nil)
    #expect(scenario.viewModel.sessionOperationTimeoutTask == nil)
    #expect(scenario.provider.isAuthenticated == false)
}
