import Foundation
import Testing

@testable import Reguerta

@MainActor
struct ReguertaSessionFeatureViewModelTests {
    @Test
    func previewEnvironmentSharesFeedbackCenterAcrossRootSessionAndFeatures() {
        let environment = ReguertaAppEnvironment.preview()
        let rootViewModel = environment.accessRootViewModel

        #expect(environment.sessionViewModel.feedbackCenter === environment.feedbackCenter)
        #expect(rootViewModel.feedbackCenter === environment.feedbackCenter)
        #expect(rootViewModel.productsViewModel.feedbackCenter === environment.feedbackCenter)
        #expect(rootViewModel.shiftsViewModel.feedbackCenter === environment.feedbackCenter)
        #expect(rootViewModel.newsNotificationsViewModel.feedbackCenter === environment.feedbackCenter)
        #expect(rootViewModel.sharedProfileViewModel.feedbackCenter === environment.feedbackCenter)
        #expect(rootViewModel.usersViewModel.feedbackCenter === environment.feedbackCenter)
        #expect(rootViewModel.bylawsViewModel.feedbackCenter === environment.feedbackCenter)
    }

    @Test
    func globalFeedbackCenterStoresAndClearsMessageKey() {
        let feedbackCenter = GlobalFeedbackCenter()

        feedbackCenter.show("feedback.test")
        #expect(feedbackCenter.messageKey == "feedback.test")

        feedbackCenter.clear()
        #expect(feedbackCenter.messageKey == nil)
    }

    @Test
    func myOrderFreshnessResolvesReadyUnavailableAndTimedOutStates() async {
        let readyViewModel = makeFreshnessViewModel(config: validFreshnessConfig())

        readyViewModel.handleSessionModeChange(from: .signedOut, to: authorizedMode(uid: "uid_ready"))
        await waitForCondition { readyViewModel.state == .ready }
        #expect(readyViewModel.state == .ready)

        let unavailableViewModel = makeFreshnessViewModel(config: nil)
        unavailableViewModel.handleSessionModeChange(from: .signedOut, to: authorizedMode(uid: "uid_unavailable"))
        await waitForCondition { unavailableViewModel.state == .unavailable }
        #expect(unavailableViewModel.state == .unavailable)

        let timedOutViewModel = makeFreshnessViewModel(
            remoteRepository: SlowCriticalDataFreshnessRemoteRepository(
                config: validFreshnessConfig(),
                delayNanoseconds: 50_000_000
            ),
            timeoutNanoseconds: 1_000_000
        )
        timedOutViewModel.handleSessionModeChange(from: .signedOut, to: authorizedMode(uid: "uid_timeout"))
        await waitForCondition { timedOutViewModel.state == .timedOut }
        #expect(timedOutViewModel.state == .timedOut)
    }

    @Test
    func myOrderFreshnessSkipsSamePrincipalAndRefreshesChangedPrincipal() async {
        let samePrincipalRemoteRepository = CountingCriticalDataFreshnessRemoteRepository(config: validFreshnessConfig())
        let samePrincipalViewModel = makeFreshnessViewModel(remoteRepository: samePrincipalRemoteRepository)
        let previousMode = authorizedMode(uid: "uid_same", email: "same@reguerta.test")
        let newMode = authorizedMode(uid: "uid_same", email: "same@reguerta.test")
        samePrincipalViewModel.state = .ready

        samePrincipalViewModel.handleSessionModeChange(from: previousMode, to: newMode)
        try? await Task.sleep(nanoseconds: 20_000_000)

        #expect(await samePrincipalRemoteRepository.requestCount() == 0)
        #expect(samePrincipalViewModel.state == .ready)

        let changedPrincipalRemoteRepository = CountingCriticalDataFreshnessRemoteRepository(config: validFreshnessConfig())
        let changedPrincipalViewModel = makeFreshnessViewModel(remoteRepository: changedPrincipalRemoteRepository)
        changedPrincipalViewModel.handleSessionModeChange(
            from: authorizedMode(uid: "uid_old", email: "old@reguerta.test"),
            to: authorizedMode(uid: "uid_new", email: "new@reguerta.test")
        )
        await waitForCondition { changedPrincipalViewModel.state == .ready }

        #expect(await changedPrincipalRemoteRepository.requestCount() == 1)
        #expect(changedPrincipalViewModel.state == .ready)
    }

    @Test
    func myOrderFreshnessResetsAndClearsLocalMetadataOnSignedOut() async {
        let localRepository = InMemoryCriticalDataFreshnessLocalRepository()
        await localRepository.saveMetadata(
            CriticalDataFreshnessMetadata(
                validatedAtMillis: 1_000,
                acknowledgedTimestampsMillis: validFreshnessTimestamps()
            )
        )
        let viewModel = makeFreshnessViewModel(
            config: validFreshnessConfig(),
            localRepository: localRepository
        )
        viewModel.state = .ready

        viewModel.handleSessionModeChange(
            from: authorizedMode(uid: "uid_member"),
            to: .signedOut
        )
        await waitForCondition { viewModel.state == .idle }
        try? await Task.sleep(nanoseconds: 20_000_000)

        #expect(viewModel.state == .idle)
        #expect(await localRepository.getMetadata() == nil)
    }

    @Test
    func bylawsBlocksEmptyQuestionWithFeedback() {
        let feedbackCenter = GlobalFeedbackCenter()
        let viewModel = BylawsFeatureViewModel(
            feedbackCenter: feedbackCenter,
            answerer: RecordingBylawsAnswerer(),
            documentProvider: FixedBylawsDocumentProvider(pdfURL: nil)
        )
        viewModel.queryInput = "   "

        viewModel.askQuestion()

        #expect(feedbackCenter.messageKey == AccessL10nKey.bylawsQueryRequired)
        #expect(viewModel.isAsking == false)
    }

    @Test
    func bylawsValidQuestionStoresAnswerAndClearsState() async {
        let answerer = RecordingBylawsAnswerer()
        let viewModel = BylawsFeatureViewModel(
            feedbackCenter: GlobalFeedbackCenter(),
            answerer: answerer,
            documentProvider: FixedBylawsDocumentProvider(pdfURL: URL(string: "file:///tmp/bylaws.pdf"))
        )
        viewModel.queryInput = "Cuales son las cuotas?"

        viewModel.askQuestion()
        await waitForCondition { viewModel.answerResult != nil }

        #expect(await answerer.questions() == ["Cuales son las cuotas?"])
        #expect(viewModel.answerResult?.answer == "Respuesta test")
        #expect(viewModel.isAsking == false)

        viewModel.clearResult()
        #expect(viewModel.queryInput.isEmpty)
        #expect(viewModel.answerResult == nil)
    }

    @Test
    func bylawsPdfUnavailablePublishesFeedback() {
        let feedbackCenter = GlobalFeedbackCenter()
        let viewModel = BylawsFeatureViewModel(
            feedbackCenter: feedbackCenter,
            answerer: RecordingBylawsAnswerer(),
            documentProvider: FixedBylawsDocumentProvider(pdfURL: nil)
        )

        #expect(viewModel.pdfURL() == nil)
        viewModel.reportPdfUnavailable()

        #expect(feedbackCenter.messageKey == AccessL10nKey.bylawsPdfViewerUnavailable)
    }

    @Test
    func previewBylawsDependenciesAnswerWithoutLiveServices() async {
        let environment = ReguertaAppEnvironment.preview()
        let viewModel = environment.accessRootViewModel.bylawsViewModel
        viewModel.queryInput = "Que dice el reglamento?"

        viewModel.askQuestion()
        await waitForCondition { viewModel.answerResult != nil }

        #expect(viewModel.answerResult?.mode == .local)
        #expect(viewModel.pdfURL() == nil)
    }
}

@MainActor
private func makeFreshnessViewModel(
    config: CriticalDataFreshnessConfig?,
    localRepository: InMemoryCriticalDataFreshnessLocalRepository = InMemoryCriticalDataFreshnessLocalRepository(),
    timeoutNanoseconds: UInt64 = 2_500_000_000
) -> MyOrderFreshnessViewModel {
    makeFreshnessViewModel(
        remoteRepository: FixedCriticalDataFreshnessRemoteRepository(config: config),
        localRepository: localRepository,
        timeoutNanoseconds: timeoutNanoseconds
    )
}

@MainActor
private func makeFreshnessViewModel(
    remoteRepository: any CriticalDataFreshnessRemoteRepository,
    localRepository: InMemoryCriticalDataFreshnessLocalRepository = InMemoryCriticalDataFreshnessLocalRepository(),
    timeoutNanoseconds: UInt64 = 2_500_000_000
) -> MyOrderFreshnessViewModel {
    MyOrderFreshnessViewModel(
        resolveCriticalDataFreshness: ResolveCriticalDataFreshnessUseCase(
            remoteRepository: remoteRepository,
            localRepository: localRepository,
            nowProvider: { 2_000 }
        ),
        criticalDataFreshnessLocalRepository: localRepository,
        timeoutNanoseconds: timeoutNanoseconds
    )
}

@MainActor
private func authorizedMode(
    uid: String,
    email: String? = nil,
    memberId: String? = nil
) -> SessionMode {
    let resolvedMemberId = memberId ?? uid
    let currentMember = member(id: resolvedMemberId, ecoCommitmentMode: .weekly)
    let resolvedEmail = email ?? currentMember.normalizedEmail

    return .authorized(
        AuthorizedSession(
            principal: AuthPrincipal(uid: uid, email: resolvedEmail),
            authenticatedMember: currentMember,
            member: currentMember,
            members: [currentMember]
        )
    )
}

private func validFreshnessConfig() -> CriticalDataFreshnessConfig {
    CriticalDataFreshnessConfig(
        cacheExpirationMinutes: 15,
        remoteTimestampsMillis: validFreshnessTimestamps()
    )
}

private func validFreshnessTimestamps() -> [CriticalCollection: Int64] {
    Dictionary(
        uniqueKeysWithValues: CriticalCollection.allCases.map { ($0, Int64(1_000)) }
    )
}

private actor CountingCriticalDataFreshnessRemoteRepository: CriticalDataFreshnessRemoteRepository {
    private let config: CriticalDataFreshnessConfig?
    private var count = 0

    init(config: CriticalDataFreshnessConfig?) {
        self.config = config
    }

    func getConfig() async -> CriticalDataFreshnessConfig? {
        count += 1
        return config
    }

    func requestCount() -> Int {
        count
    }
}

private struct SlowCriticalDataFreshnessRemoteRepository: CriticalDataFreshnessRemoteRepository {
    let config: CriticalDataFreshnessConfig?
    let delayNanoseconds: UInt64

    func getConfig() async -> CriticalDataFreshnessConfig? {
        try? await Task.sleep(nanoseconds: delayNanoseconds)
        return config
    }
}

private actor RecordingBylawsAnswerer: BylawsAnswering {
    private var recordedQuestions: [String] = []

    func ask(question: String) async -> BylawsAnswerResult {
        recordedQuestions.append(question)
        return BylawsAnswerResult(
            mode: .local,
            answer: "Respuesta test",
            citedPages: [1],
            trace: BylawsDecisionTrace(
                shouldEscalate: false,
                reasons: ["test"],
                localCoverage: 1,
                localConfidence: 1
            )
        )
    }

    func questions() -> [String] {
        recordedQuestions
    }
}

private struct FixedBylawsDocumentProvider: BylawsDocumentProviding {
    let pdfURL: URL?

    @MainActor
    func bundledPdfURL() -> URL? {
        pdfURL
    }
}
