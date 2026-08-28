import Foundation
import Testing

@testable import Reguerta

@Suite("App scenario composition", .timeLimit(.minutes(1)))
@MainActor
struct ReguertaAppScenarioTests {
    @Test func appDelegateConsumesTypedLiveAndUITestingPushPoliciesWithoutStartingFirebase() {
        let liveDelegate = AppDelegate()
        let uiTestingDelegate = AppDelegate()

        liveDelegate.configure(
            appConfiguration: ReguertaAppConfiguration(arguments: ["Reguerta"]),
            authorizedDeviceRegistrar: NoOpAuthorizedDeviceRegistrar()
        )
        uiTestingDelegate.configure(
            appConfiguration: .uiTesting,
            authorizedDeviceRegistrar: NoOpAuthorizedDeviceRegistrar()
        )

        #expect(liveDelegate.pushNotificationsEnabled)
        #expect(uiTestingDelegate.pushNotificationsEnabled == false)
    }

    @Test func defaultLaunchArgumentsSelectTheCompleteLiveScenario() {
        let configuration = ReguertaAppConfiguration(arguments: ["Reguerta"])

        #expect(configuration.scenario == .live)
        #expect(configuration.productData == .live)
        #expect(configuration.freshnessData == .live)
        #expect(configuration.pushNotifications == .enabled)
        #expect(configuration.skipsSplash == false)
        #expect(configuration.initialNowOverrideMillis == nil)
    }

    @Test func launchArgumentsDecodeLiveScenarioAndTypedFeaturePolicies() {
        let configuration = ReguertaAppConfiguration(
            arguments: ["Reguerta", "-useMockProductData", "-skipSplash"]
        )

        #expect(configuration.scenario == .live)
        #expect(configuration.productData == .mock)
        #expect(configuration.freshnessData == .live)
        #expect(configuration.pushNotifications == .enabled)
        #expect(configuration.skipsSplash)
    }

    @Test func mockAuthenticationSelectsOnlyTheUITestingScenarioPolicies() {
        let configuration = ReguertaAppConfiguration(
            arguments: [
                "Reguerta",
                "-useMockAuth",
                "-skipSplash",
                "-reguerta_dev_time_machine.override_now_millis",
                "1778760000000"
            ]
        )

        #expect(configuration.scenario == .uiTesting)
        #expect(configuration.productData == .mock)
        #expect(configuration.freshnessData == .mock)
        #expect(configuration.pushNotifications == .disabled)
        #expect(configuration.skipsSplash)
        #expect(configuration.initialNowOverrideMillis == 1_778_760_000_000)
    }

    @Test func explicitPreviewConfigurationDoesNotEnableLiveInfrastructure() {
        let configuration = ReguertaAppConfiguration.preview

        #expect(configuration.scenario == .preview)
        #expect(configuration.productData == .mock)
        #expect(configuration.freshnessData == .mock)
        #expect(configuration.pushNotifications == .disabled)
        #expect(configuration.skipsSplash == false)
    }

    @Test func scenarioDispatchInvokesExactlyTheSelectedFactoryWithoutFallback() {
        var invocations: [ReguertaAppScenario] = []
        let configuration = ReguertaAppConfiguration.uiTesting

        let selected = configuration.compose(
            live: {
                invocations.append(.live)
                return "live"
            },
            preview: {
                invocations.append(.preview)
                return "preview"
            },
            uiTesting: {
                invocations.append(.uiTesting)
                return "uiTesting"
            }
        )

        #expect(selected == "uiTesting")
        #expect(invocations == [.uiTesting])
    }

    @Test func independentlyComposedPreviewAndUITestingGraphsDoNotShareRootState() async {
        let firstPreview = ReguertaAppEnvironment.make(configuration: .preview)
        let originalOverride = firstPreview.accessRootViewModel.nowOverrideMillis
        defer { firstPreview.accessRootViewModel.setNowOverrideMillis(originalOverride) }

        firstPreview.accessRootViewModel.setNowOverrideMillis(1_234_567)
        let secondPreview = ReguertaAppEnvironment.make(configuration: .preview)
        let uiTestingConfiguration = ReguertaAppConfiguration(
            arguments: [
                "Reguerta",
                "-useMockAuth",
                "-reguerta_dev_time_machine.override_now_millis",
                "1778760000000"
            ]
        )
        let firstUITesting = ReguertaAppEnvironment.make(configuration: uiTestingConfiguration)

        #expect(secondPreview.accessRootViewModel.nowOverrideMillis == nil)
        #expect(firstUITesting.accessRootViewModel.nowOverrideMillis == 1_778_760_000_000)
        #expect(firstUITesting.sessionViewModel.nowMillisProvider() == 1_778_760_000_000)
        #expect(firstUITesting.accessRootViewModel.productsViewModel.nowMillisProvider() == 1_778_760_000_000)
        #expect(firstUITesting.accessRootViewModel.myOrderViewModel.nowMillisProvider() == 1_778_760_000_000)
        #expect(firstUITesting.accessRootViewModel.shiftsViewModel.nowMillisProvider() == 1_778_760_000_000)
        #expect(firstUITesting.accessRootViewModel.newsNotificationsViewModel.nowMillisProvider() == 1_778_760_000_000)
        #expect(firstUITesting.accessRootViewModel.sharedProfileViewModel.nowMillisProvider() == 1_778_760_000_000)

        firstUITesting.accessRootViewModel.setNowOverrideMillis(7_654_321)
        let secondUITesting = ReguertaAppEnvironment.make(configuration: uiTestingConfiguration)

        #expect(firstPreview.feedbackCenter !== secondPreview.feedbackCenter)
        #expect(firstPreview.sessionViewModel !== secondPreview.sessionViewModel)
        #expect(firstPreview.accessRootViewModel !== secondPreview.accessRootViewModel)
        #expect(firstPreview.sessionViewModel.feedbackCenter === firstPreview.feedbackCenter)
        #expect(firstPreview.accessRootViewModel.feedbackCenter === firstPreview.feedbackCenter)
        #expect(firstPreview.accessRootViewModel.sessionViewModel === firstPreview.sessionViewModel)
        #expect(firstUITesting.feedbackCenter !== secondUITesting.feedbackCenter)
        #expect(firstUITesting.sessionViewModel !== secondUITesting.sessionViewModel)
        #expect(firstUITesting.accessRootViewModel !== secondUITesting.accessRootViewModel)
        #expect(secondUITesting.accessRootViewModel.nowOverrideMillis == 1_778_760_000_000)
        #expect(firstUITesting.sessionViewModel.feedbackCenter === firstUITesting.feedbackCenter)
        #expect(firstUITesting.accessRootViewModel.feedbackCenter === firstUITesting.feedbackCenter)
        #expect(firstUITesting.accessRootViewModel.sessionViewModel === firstUITesting.sessionViewModel)

        firstPreview.feedbackCenter.show("preview.first")
        firstUITesting.feedbackCenter.show("uiTesting.first")

        #expect(secondPreview.feedbackCenter.messageKey == nil)
        #expect(secondUITesting.feedbackCenter.messageKey == nil)

        let nonLiveImageURL = URL(fileURLWithPath: "/non-live-news-image")
        await #expect(throws: NewsImageDataLoaderError.emptyData) {
            try await secondPreview.loadNewsImageData(nonLiveImageURL)
        }
        await #expect(throws: NewsImageDataLoaderError.emptyData) {
            try await secondUITesting.loadNewsImageData(nonLiveImageURL)
        }
    }

    @Test func pureAppAssemblerPreservesEveryIntentionalSharedReferenceWithoutNetwork() throws {
        try withIsolatedDevelopmentTimeMachine { developmentTimeMachine in
            let fixture = makePureAppAssemblyFixture(developmentTimeMachine: developmentTimeMachine)
            let environment = fixture.environment
            let environmentRouter = fixture.environmentRouter
            let sessionViewModel = environment.sessionViewModel
            let rootViewModel = environment.accessRootViewModel

            #expect(rootViewModel.feedbackCenter === environment.feedbackCenter)
            #expect(sessionViewModel.feedbackCenter === environment.feedbackCenter)
            #expect(rootViewModel.sessionViewModel === sessionViewModel)
            #expect(
                sessionViewModel.repository as AnyObject ===
                    rootViewModel.usersViewModel.memberRepository as AnyObject
            )
            #expect(
                sessionViewModel.authorizedDeviceRegistrar as AnyObject ===
                    environment.authorizedDeviceRegistrar as AnyObject
            )
            #expect(
                sessionViewModel.criticalDataFreshnessLocalRepository as AnyObject ===
                    rootViewModel.myOrderFreshnessViewModel.criticalDataFreshnessLocalRepository as AnyObject
            )
            #expect(
                rootViewModel.productsViewModel.imagePipelineManager as AnyObject ===
                    rootViewModel.newsNotificationsViewModel.imagePipelineManager as AnyObject
            )
            #expect(
                rootViewModel.productsViewModel.imagePipelineManager as AnyObject ===
                    rootViewModel.sharedProfileViewModel.imagePipelineManager as AnyObject
            )
            #expect(
                environmentRouter.transitionSignal ===
                    rootViewModel.newsNotificationsViewModel.environmentRoutingSignal
            )

            let lease = SessionEnvironmentLease()
            environmentRouter.applyResolvedEnvironment(.production, lease: lease)
            defer { environmentRouter.resetToBaseEnvironment(ifOwnedBy: lease) }

            #expect(rootViewModel.shiftsViewModel.environmentProvider() == .production)
            #expect(rootViewModel.newsNotificationsViewModel.environmentProvider() == .production)
        }
    }

    @Test(arguments: [ReguertaAppScenario.preview, .uiTesting])
    func nonLiveScenariosShareOneInjectableDevelopmentClock(_ scenario: ReguertaAppScenario) throws {
        try withIsolatedDevelopmentTimeMachine(systemNowMillis: 1_000) { developmentTimeMachine in
            let environment: ReguertaAppEnvironment
            switch scenario {
            case .preview:
                environment = .preview(developmentTimeMachine: developmentTimeMachine)
            case .uiTesting:
                environment = .uiTesting(developmentTimeMachine: developmentTimeMachine)
            case .live:
                Issue.record("Only non-live scenarios belong in this test")
                return
            }

            environment.accessRootViewModel.setNowOverrideMillis(9_876_543)

            #expect(environment.accessRootViewModel.nowOverrideMillis == 9_876_543)
            #expect(environment.sessionViewModel.nowMillisProvider() == 9_876_543)
            #expect(environment.accessRootViewModel.productsViewModel.nowMillisProvider() == 9_876_543)
            #expect(environment.accessRootViewModel.myOrderViewModel.nowMillisProvider() == 9_876_543)
            #expect(environment.accessRootViewModel.shiftsViewModel.nowMillisProvider() == 9_876_543)
            #expect(environment.accessRootViewModel.newsNotificationsViewModel.nowMillisProvider() == 9_876_543)
            #expect(environment.accessRootViewModel.sharedProfileViewModel.nowMillisProvider() == 9_876_543)
        }
    }
}

@Suite("Composition boundary structure", .timeLimit(.minutes(1)))
struct ReguertaAppCompositionBoundaryTests {
    @Test func structuralEnumerationRejectsMissingOrEmptySourceDirectories() {
        #expect(throws: (any Error).self) {
            _ = try swiftSources(in: "Reguerta/DirectoryThatDoesNotExist")
        }
        #expect(throws: (any Error).self) {
            _ = try swiftSources(in: "TestPlans")
        }
    }

    @Test func productionPresentationDoesNotImportFirebaseOrReferenceConcreteDataTypes() throws {
        let concreteDataTypes = try concreteDataTypeNames()

        #expect(concreteDataTypes.contains("FirestoreOrdersRepository"))
        #expect(concreteDataTypes.contains("FirebaseImagePipelineManager"))
        #expect(concreteDataTypes.contains("NewsImageDataLoader"))
        #expect(concreteDataTypes.contains("UserDefaultsCriticalDataFreshnessLocalRepository"))

        for sourceURL in try swiftSources(in: "Reguerta/Presentation") {
            let source = try String(contentsOf: sourceURL, encoding: .utf8)
            #expect(source.contains("import Firebase") == false, "Firebase import in \(sourceURL.lastPathComponent)")
            for typeName in concreteDataTypes.sorted() {
                let pattern = #"\b"# + NSRegularExpression.escapedPattern(for: typeName) + #"\b"#
                #expect(
                    source.range(of: pattern, options: .regularExpression) == nil,
                    "Concrete Data type \(typeName) in \(sourceURL.lastPathComponent)"
                )
            }
        }
    }

    private func concreteDataTypeNames() throws -> Set<String> {
        let declarationPattern = try Regex(
            #"^\s*((?:(?:public|package|internal|open|final|nonisolated|indirect|private|fileprivate)\s+)*)"# +
                #"(actor|class|enum|struct)\s+([A-Za-z_][A-Za-z0-9_]*)\b"#
        )
        return try Set(swiftSources(in: "Reguerta/Data").flatMap { sourceURL in
            let source = try String(contentsOf: sourceURL, encoding: .utf8)
            return source.components(separatedBy: .newlines).compactMap { line -> String? in
                guard let match = line.firstMatch(of: declarationPattern),
                      let modifiersText = match.output[1].substring,
                      let typeName = match.output[3].substring else { return nil }
                let modifiers = modifiersText.split(whereSeparator: \.isWhitespace)
                guard modifiers.contains("private") == false,
                      modifiers.contains("fileprivate") == false else {
                    return nil
                }
                return String(typeName)
            }
        })
    }

    @Test func sessionDependenciesRemainAPassivePresentationBundle() throws {
        let source = try source(at: "Reguerta/Presentation/Root/SessionViewModelDependencies.swift")

        #expect(source.contains("import Firebase") == false)
        #expect(source.contains("ProcessInfo.processInfo.arguments") == false)
        #expect(source.contains("static func live") == false)
        #expect(source.contains("static func preview") == false)
        #expect(source.contains("FirestoreMemberRepository") == false)
        #expect(source.contains("FirebaseAuthSessionProvider") == false)
    }

    @Test func scenarioConsumersDoNotDecodeProcessArguments() throws {
        let relativePaths = [
            "Reguerta/App/AppDelegate.swift",
            "Reguerta/App/ProductsFeatureDependencies.swift",
            "Reguerta/App/MyOrderFreshnessFeatureDependencies.swift",
            "Reguerta/App/ReguertaAppEnvironment.swift",
            "Reguerta/Presentation/Root/SessionViewModelDependencies.swift"
        ]

        for relativePath in relativePaths {
            let source = try source(at: relativePath)
            #expect(
                source.contains("ProcessInfo.processInfo.arguments") == false,
                "\(relativePath) must consume typed App configuration"
            )
        }
    }

    @Test func launchArgumentsHaveOneAppOwnedReadAuthority() throws {
        let argumentReaders = try swiftSources(in: "Reguerta").filter { sourceURL in
            let source = try String(contentsOf: sourceURL, encoding: .utf8)
            return source.contains("ProcessInfo.processInfo.arguments")
        }

        #expect(argumentReaders.map(\.lastPathComponent) == ["ReguertaApp.swift"])
        let appSource = try source(at: "Reguerta/ReguertaApp.swift")
        #expect(appSource.components(separatedBy: "ProcessInfo.processInfo.arguments").count - 1 == 1)
    }

    @Test func liveEnvironmentCannotDelegateToTheUITestingFactory() throws {
        let source = try source(at: "Reguerta/App/ReguertaAppEnvironment.swift")
        let liveFactory = try #require(source.slice(from: "static func live", to: "static func preview"))

        #expect(liveFactory.contains("uiTesting()") == false)
        #expect(liveFactory.contains("return uiTesting") == false)
    }

    @Test func liveFunctionsCompositionUsesOneClientForEveryDependentRole() throws {
        let source = try source(at: "Reguerta/App/ReguertaAppEnvironment.swift")

        #expect(source.occurrenceCount(of: "AuthenticatedFirebaseFunctionsClient(") == 1)
        #expect(source.contains("tokenProvider: authSessionProvider"))
        #expect(source.contains("FirebaseMemberAdministrationRepository(client: functionsClient)"))
        #expect(source.contains("resolver: FirebaseAuthorizedMemberResolver(client: dependencies.functionsClient)"))
        #expect(source.occurrenceCount(of: "functionsClient: dependencies.functionsClient") == 2)
    }

    @Test func liveConcreteCompositionRoutesSharedDependenciesThroughThePureAssembler() throws {
        let source = try source(at: "Reguerta/App/ReguertaAppEnvironment.swift")
        let liveFactory = try #require(source.slice(from: "static func live", to: "static func preview"))

        #expect(liveFactory.contains("return assemble(makeLiveAppAssembly("))
        #expect(
            liveFactory.contains(
                "LiveRootDependencies(initialNowOverrideMillis: configuration.initialNowOverrideMillis)"
            )
        )
        #expect(source.occurrenceCount(of: "repository: dependencies.memberRepository") == 2)
        #expect(source.occurrenceCount(of: "authorizedDeviceRegistrar: dependencies.authorizedDeviceRegistrar") == 1)
        #expect(source.occurrenceCount(of: "notificationRepository: dependencies.notificationRepository") == 1)
        #expect(source.occurrenceCount(of: "imagePipelineManager: dependencies.imagePipelineManager") == 3)
        #expect(source.occurrenceCount(of: "environmentProvider: dependencies.environmentStore") == 2)
        #expect(source.occurrenceCount(of: "environmentRouter: dependencies.environmentRouter") == 1)
        #expect(source.occurrenceCount(of: "developmentTimeMachine: dependencies.developmentTimeMachine") == 1)
        #expect(source.occurrenceCount(of: "memberRepository: dependencies.memberRepository") == 1)
        #expect(source.occurrenceCount(of: "environment: dependencies.environmentStore.baseEnvironment") == 1)
    }

    @Test func appEntrypointPassesTheGraphRegistrarToTheConfiguredDelegate() throws {
        let source = try source(at: "Reguerta/ReguertaApp.swift")

        #expect(
            source.occurrenceCount(
                of: "authorizedDeviceRegistrar: appEnvironment.authorizedDeviceRegistrar"
            ) == 1
        )
    }

    @Test func previewAndUITestingRouteOneClockThroughSessionFeaturesAndFreshness() throws {
        let source = try source(at: "Reguerta/App/ReguertaAppEnvironment.swift")
        let previewFactory = try #require(source.slice(from: "static func preview", to: "static func uiTesting"))
        let uiTestingFactory = try #require(
            source.slice(from: "static func uiTesting", to: "struct ReguertaAppAssemblyDependencies")
        )

        for factory in [String(previewFactory), String(uiTestingFactory)] {
            #expect(factory.occurrenceCount(of: "let nowMillisProvider: @Sendable () -> Int64") == 1)
            #expect(factory.contains("makeNonLiveClock(configuration, injected: injectedDevelopmentTimeMachine)"))
            #expect(factory.contains("nowProvider: nowMillisProvider"))
            #expect(factory.occurrenceCount(of: "nowMillisProvider: nowMillisProvider") == 6)
            #expect(factory.contains("NewsImageDataLoader()") == false)
            #expect(factory.contains("makeLiveNewsImageDataProvider") == false)
            #expect(factory.contains("loadNewsImageData: { _ in throw NewsImageDataLoaderError.emptyData }"))
        }
        #expect(source.occurrenceCount(of: "makeNonLiveClock(configuration, injected:") == 2)
        #expect(source.contains(".transient(initialOverrideNowMillis: configuration.initialNowOverrideMillis)"))
    }

    @Test func liveValueCompositionRoutesOneFreshnessLocalRepositoryToBothConsumers() throws {
        let source = try source(at: "Reguerta/App/ReguertaAppEnvironment.swift")
        let liveFreshness = try #require(
            source.slice(
                from: "myOrderFreshness: MyOrderFreshnessFeatureDependencies.live(",
                to: "bylaws: .live()"
            )
        )

        #expect(source.occurrenceCount(of: "UserDefaultsCriticalDataFreshnessLocalRepository()") == 1)
        #expect(
            source.occurrenceCount(
                of: "criticalDataFreshnessLocalRepository: dependencies.criticalDataFreshnessLocalRepository"
            ) == 1
        )
        #expect(
            source.occurrenceCount(of: "localRepository: dependencies.criticalDataFreshnessLocalRepository") == 1
        )
        #expect(liveFreshness.contains("nowProvider:") == false)
    }

    private func source(at relativePath: String) throws -> String {
        let sourceURL = projectDirectoryURL().appending(path: relativePath)
        return try String(contentsOf: sourceURL, encoding: .utf8)
    }

    private func swiftSources(in relativePath: String) throws -> [URL] {
        let directoryURL = projectDirectoryURL().appending(path: relativePath)
        let resourceKeys: [URLResourceKey] = [.isRegularFileKey]
        guard let enumerator = FileManager.default.enumerator(
            at: directoryURL,
            includingPropertiesForKeys: resourceKeys
        ) else {
            throw SwiftSourceEnumerationError.unavailable(directoryURL)
        }
        let sources: [URL] = try enumerator.compactMap { element in
            guard let sourceURL = element as? URL,
                  sourceURL.pathExtension == "swift",
                  try sourceURL.resourceValues(forKeys: Set(resourceKeys)).isRegularFile == true else {
                return nil
            }
            return sourceURL
        }.sorted { $0.path < $1.path }
        guard !sources.isEmpty else {
            throw SwiftSourceEnumerationError.empty(directoryURL)
        }
        return sources
    }

    private func projectDirectoryURL() -> URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
    }
}

private enum SwiftSourceEnumerationError: Error {
    case unavailable(URL)
    case empty(URL)
}

private extension String {
    func occurrenceCount(of value: String) -> Int {
        components(separatedBy: value).count - 1
    }

    func slice(from start: String, to end: String) -> Substring? {
        guard let startRange = range(of: start),
              let endRange = range(of: end, range: startRange.upperBound..<endIndex) else {
            return nil
        }
        return self[startRange.lowerBound..<endRange.lowerBound]
    }
}
