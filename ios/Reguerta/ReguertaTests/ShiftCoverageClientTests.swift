import Foundation
import Testing
@testable import Reguerta

@MainActor
struct ShiftCoverageClientTests {
    @Test func inboxAndAcceptanceUseThePrivateProjectionAndReadBack() async throws {
        let harness = try CoverageClientHarness()
        await harness.model.refresh()
        #expect(harness.model.snapshot?.cases.first?.status == .offered)
        #expect(harness.model.snapshot?.credits.first?.state == .pending)
        #expect(harness.model.snapshot?.cases.first?.administration == nil)
        await harness.model.submit(harness.command)
        #expect(harness.model.snapshot?.cases.first?.status == .accepted)
        #expect(harness.model.pendingCommand == nil)
        #expect(harness.transport.commands.count == 1)
    }

    @Test func uncertainAcceptanceRetriesTheExactIntentAndPreventsAnotherMutation() async throws {
        let harness = try CoverageClientHarness()
        await harness.model.refresh()
        harness.transport.loseFirstCommandResponse = true
        await harness.model.submit(harness.command)
        #expect(harness.model.snapshot == nil)
        #expect(harness.model.pendingCommand == harness.command)
        var other = harness.command
        other.reason = "another intent"
        await harness.model.submit(other)
        #expect(harness.transport.commands.count == 1)
        await harness.model.retryPending()
        #expect(harness.transport.commands.count == 2)
        let first = try JSONDecoder().decode(CoverageSentCommand.self, from: #require(harness.transport.commands.first))
        let last = try JSONDecoder().decode(CoverageSentCommand.self, from: #require(harness.transport.commands.last))
        #expect(first == last)
        #expect(harness.model.pendingCommand == nil)
        #expect(harness.model.snapshot?.cases.first?.status == .accepted)
    }

    @Test func successfulWriteWithFailedReadBackIsNotReplayed() async throws {
        let harness = try CoverageClientHarness()
        await harness.model.refresh()
        harness.transport.failReadBack = true
        await harness.model.submit(harness.command)
        #expect(harness.model.snapshot == nil)
        #expect(harness.model.pendingCommand == nil)
        await harness.model.retryPending()
        #expect(harness.transport.commands.count == 1)
        harness.transport.failReadBack = false
        await harness.model.refresh()
        #expect(harness.model.snapshot?.cases.first?.status == .accepted)
    }

    @Test func authorizationChangeDuringTokenRefreshPreventsAnyHTTP() async throws {
        let harness = try CoverageClientHarness()
        harness.onToken = { harness.bind(revision: 2) }
        await harness.model.refresh()
        #expect(harness.transport.requests == 0)
        #expect(harness.model.snapshot == nil)
        #expect(harness.model.session?.authorizationRevision == 2)
        harness.onToken = nil
        await harness.model.refresh()
        #expect(harness.model.snapshot != nil)
    }

    @Test func oldSessionHTTPCompletionCannotPopulateTheNewSession() async throws {
        let harness = try CoverageClientHarness()
        harness.transport.beforeResponse = { harness.bind(revision: 2) }
        await harness.model.refresh()
        #expect(harness.model.snapshot == nil)
        #expect(!harness.model.isBusy)
        harness.transport.beforeResponse = nil
        await harness.model.refresh()
        #expect(harness.model.snapshot != nil)
    }

    @Test(arguments: ["signed", "project", "uid"])
    func productionAndMismatchedCredentialsNeverReachHTTP(_ alteration: String) async throws {
        let harness = try CoverageClientHarness()
        switch alteration {
        case "signed": harness.token += "signature"
        case "project": harness.token = CoverageClientHarness.token(project: "reguerta-real", uid: "auth-a")
        default: harness.token = CoverageClientHarness.token(project: "demo-reguerta-hu084-coverage", uid: "auth-b")
        }
        await harness.model.refresh()
        #expect(harness.model.failure == .localOnly)
        #expect(harness.transport.requests == 0)
    }

    @Test(arguments: ["member", "version", "status", "policy"])
    func incompatibleOrForeignInboxCannotEnableCommands(_ alteration: String) async throws {
        let harness = try CoverageClientHarness()
        let replacements = [
            "member": ("\"memberId\": \"member-a\"", "\"memberId\": \"someone-else\""),
            "version": ("\"schemaVersion\": 1", "\"schemaVersion\": 2"),
            "status": ("\"offered\"", "\"unknown\""),
            "policy": ("hu084-provisional-v1", "unratified-v2")
        ]
        let replacement = try #require(replacements[alteration])
        harness.transport.overview = harness.transport.overview.replacingOccurrences(
            of: replacement.0,
            with: replacement.1
        )
        await harness.model.refresh()
        await harness.model.submit(harness.command)
        #expect(harness.model.failure == .invalidResponse)
        #expect(harness.model.snapshot == nil)
        #expect(harness.transport.commands.isEmpty)
    }

    @Test func mismatchedReceiptStaysUncertainAndRevocationDropsPrivateState() async throws {
        let harness = try CoverageClientHarness()
        await harness.model.refresh()
        harness.transport.wrongReceipt = true
        await harness.model.submit(harness.command)
        #expect(harness.model.pendingCommand != nil)
        harness.transport.rejectionStatus = 401
        await harness.model.retryPending()
        #expect(harness.model.session == nil)
        #expect(harness.model.snapshot == nil)
        #expect(harness.model.pendingCommand == nil)
    }

    @Test(arguments: [400, 403, 409])
    func definitiveRejectionClearsTheIntentAndRequiresFreshAuthority(_ status: Int) async throws {
        let harness = try CoverageClientHarness()
        await harness.model.refresh()
        harness.transport.rejectionStatus = status
        await harness.model.submit(harness.command)
        #expect(harness.model.pendingCommand == nil)
        #expect(harness.model.snapshot == nil)
        #expect(!harness.model.isBusy)
        #expect((harness.model.session == nil) == (status == 403))
        await harness.model.retryPending()
        #expect(harness.transport.commands.count == 1)
    }

    @Test func cancellationAfterSendingKeepsTheIntentForExplicitReplay() async throws {
        let harness = try CoverageClientHarness()
        await harness.model.refresh()
        var running: Task<Void, Never>?
        harness.transport.beforeResponse = { running?.cancel() }
        running = Task { await harness.model.submit(harness.command) }
        await running?.value
        #expect(harness.model.pendingCommand == harness.command)
        #expect(harness.model.snapshot == nil)
        #expect(!harness.model.isBusy)
        harness.transport.beforeResponse = nil
        await harness.model.retryPending()
        #expect(harness.model.pendingCommand == nil)
        #expect(harness.transport.commands.count == 2)
        #expect(harness.model.snapshot?.cases.first?.status == .accepted)
    }

}
