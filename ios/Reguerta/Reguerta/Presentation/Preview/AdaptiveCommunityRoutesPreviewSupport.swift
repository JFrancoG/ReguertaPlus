#if DEBUG
import Foundation
import SwiftUI

enum AdaptivePreviewImageDataError: Error {
    case unavailable
}

enum AdaptiveCommunityPreviewRoute {
    case products
    case users
    case sharedProfile
    case newsList
    case newsEditor
    case notificationsList
    case notificationEditor
}

enum AdaptiveCommunityPreviewScenario: CaseIterable {
    case productsLoading
    case productsEmpty
    case productsContent
    case productsFailure
    case productEditor
    case usersContent
    case userEditor
    case userAction
    case sharedProfileLoading
    case sharedProfileContent
    case newsLoading
    case newsContent
    case newsEditor
    case notificationsEmpty
    case notificationsContent
    case notificationEditor
    case routeError

    var route: AdaptiveCommunityPreviewRoute {
        switch self {
        case .productsLoading, .productsEmpty, .productsContent, .productsFailure, .productEditor:
            .products
        case .usersContent, .userEditor, .userAction:
            .users
        case .sharedProfileLoading, .sharedProfileContent:
            .sharedProfile
        case .newsLoading, .newsContent, .routeError:
            .newsList
        case .newsEditor:
            .newsEditor
        case .notificationsEmpty, .notificationsContent:
            .notificationsList
        case .notificationEditor:
            .notificationEditor
        }
    }

    var matrix: AdaptiveCommunityPreviewVariant {
        switch self {
        case .productsLoading:
            AdaptiveCommunityPreviewVariant(
                canvas: .compact,
                dynamicTypeSize: .large,
                localeIdentifier: "es",
                colorScheme: .light,
                requiresIncreasedContrastOverride: false,
                reducesMotion: false
            )
        case .productsEmpty:
            AdaptiveCommunityPreviewVariant(
                canvas: .split,
                dynamicTypeSize: .xxxLarge,
                localeIdentifier: "en",
                colorScheme: .dark,
                requiresIncreasedContrastOverride: true,
                reducesMotion: true
            )
        case .productsContent:
            AdaptiveCommunityPreviewVariant(
                canvas: .iPad,
                dynamicTypeSize: .accessibility5,
                localeIdentifier: "es",
                colorScheme: .light,
                requiresIncreasedContrastOverride: true,
                reducesMotion: false
            )
        case .productsFailure:
            AdaptiveCommunityPreviewVariant(
                canvas: .compact,
                dynamicTypeSize: .accessibility5,
                localeIdentifier: "en",
                colorScheme: .dark,
                requiresIncreasedContrastOverride: true,
                reducesMotion: true
            )
        case .productEditor:
            AdaptiveCommunityPreviewVariant(
                canvas: .compact,
                dynamicTypeSize: .accessibility5,
                localeIdentifier: "en",
                colorScheme: .dark,
                requiresIncreasedContrastOverride: false,
                reducesMotion: true
            )
        case .usersContent:
            AdaptiveCommunityPreviewVariant(
                canvas: .split,
                dynamicTypeSize: .large,
                localeIdentifier: "es",
                colorScheme: .light,
                requiresIncreasedContrastOverride: true,
                reducesMotion: false
            )
        case .userEditor:
            AdaptiveCommunityPreviewVariant(
                canvas: .iPad,
                dynamicTypeSize: .xxxLarge,
                localeIdentifier: "en",
                colorScheme: .dark,
                requiresIncreasedContrastOverride: false,
                reducesMotion: true
            )
        case .userAction:
            AdaptiveCommunityPreviewVariant(
                canvas: .compact,
                dynamicTypeSize: .accessibility5,
                localeIdentifier: "es",
                colorScheme: .light,
                requiresIncreasedContrastOverride: true,
                reducesMotion: true
            )
        case .sharedProfileLoading:
            AdaptiveCommunityPreviewVariant(
                canvas: .split,
                dynamicTypeSize: .large,
                localeIdentifier: "en",
                colorScheme: .dark,
                requiresIncreasedContrastOverride: false,
                reducesMotion: true
            )
        case .sharedProfileContent:
            AdaptiveCommunityPreviewVariant(
                canvas: .iPad,
                dynamicTypeSize: .xxxLarge,
                localeIdentifier: "es",
                colorScheme: .light,
                requiresIncreasedContrastOverride: true,
                reducesMotion: false
            )
        case .newsLoading:
            AdaptiveCommunityPreviewVariant(
                canvas: .compact,
                dynamicTypeSize: .accessibility5,
                localeIdentifier: "en",
                colorScheme: .dark,
                requiresIncreasedContrastOverride: false,
                reducesMotion: true
            )
        case .newsContent:
            AdaptiveCommunityPreviewVariant(
                canvas: .split,
                dynamicTypeSize: .large,
                localeIdentifier: "es",
                colorScheme: .light,
                requiresIncreasedContrastOverride: true,
                reducesMotion: false
            )
        case .newsEditor:
            AdaptiveCommunityPreviewVariant(
                canvas: .iPad,
                dynamicTypeSize: .xxxLarge,
                localeIdentifier: "en",
                colorScheme: .dark,
                requiresIncreasedContrastOverride: false,
                reducesMotion: true
            )
        case .notificationsEmpty:
            AdaptiveCommunityPreviewVariant(
                canvas: .compact,
                dynamicTypeSize: .large,
                localeIdentifier: "es",
                colorScheme: .light,
                requiresIncreasedContrastOverride: true,
                reducesMotion: false
            )
        case .notificationsContent:
            AdaptiveCommunityPreviewVariant(
                canvas: .split,
                dynamicTypeSize: .accessibility5,
                localeIdentifier: "en",
                colorScheme: .dark,
                requiresIncreasedContrastOverride: false,
                reducesMotion: true
            )
        case .notificationEditor:
            AdaptiveCommunityPreviewVariant(
                canvas: .iPad,
                dynamicTypeSize: .xxxLarge,
                localeIdentifier: "es",
                colorScheme: .light,
                requiresIncreasedContrastOverride: true,
                reducesMotion: false
            )
        case .routeError:
            AdaptiveCommunityPreviewVariant(
                canvas: .compact,
                dynamicTypeSize: .accessibility5,
                localeIdentifier: "en",
                colorScheme: .dark,
                requiresIncreasedContrastOverride: true,
                reducesMotion: true
            )
        }
    }
}

enum AdaptiveCommunityPreviewCanvas: CaseIterable, Hashable {
    case compact
    case split
    case iPad

    var size: CGSize {
        switch self {
        case .compact:
            CGSize(width: 320, height: 844)
        case .split:
            CGSize(width: 600, height: 900)
        case .iPad:
            CGSize(width: 820, height: 1_180)
        }
    }
}

struct AdaptiveCommunityPreviewVariant {
    let canvas: AdaptiveCommunityPreviewCanvas
    let dynamicTypeSize: DynamicTypeSize
    let localeIdentifier: String
    let colorScheme: ColorScheme
    /// Requires the preview renderer's Increased Contrast variant; SwiftUI exposes the value read-only.
    let requiresIncreasedContrastOverride: Bool
    let reducesMotion: Bool

    var width: CGFloat { canvas.size.width }
    var height: CGFloat { canvas.size.height }
}

@MainActor
struct AdaptiveCommunityPreviewFixture {
    private static let previewNowMillis: Int64 = 1_735_689_600_000

    let environment: ReguertaAppEnvironment
    let session: AuthorizedSession

    var rootViewModel: AccessRootViewModel { environment.accessRootViewModel }

    static func make(for scenario: AdaptiveCommunityPreviewScenario) -> AdaptiveCommunityPreviewFixture {
        let session = previewSession()
        let environment = ReguertaAppEnvironment.preview(
            developmentTimeMachine: .transient(initialOverrideNowMillis: previewNowMillis)
        )
        environment.sessionViewModel.mode = .authorized(session)

        let fixture = AdaptiveCommunityPreviewFixture(environment: environment, session: session)
        fixture.seedAuthorizedFeatureState()
        fixture.seed(scenario)
        return fixture
    }

    func displayName(for memberID: String) -> String {
        session.members.first(where: { $0.id == memberID })?.displayName ?? memberID
    }

    private func seedAuthorizedFeatureState() {
        let productsViewModel = rootViewModel.productsViewModel
        productsViewModel.adoptCurrentSessionOwner(session)

        _ = rootViewModel.usersViewModel.adoptAuthorizedSession(
            session,
            sourceMayContainPrivateMembers: false
        )

        let sharedProfileViewModel = rootViewModel.sharedProfileViewModel
        sharedProfileViewModel.currentSession = session
        sharedProfileViewModel.currentMember = session.member

        let newsViewModel = rootViewModel.newsNotificationsViewModel
        newsViewModel.currentSession = session
        newsViewModel.currentMember = session.member
        newsViewModel.currentEnvironment = session.environment
    }

    private func seed(_ scenario: AdaptiveCommunityPreviewScenario) {
        switch scenario.route {
        case .products:
            seedProducts(scenario)
        case .users:
            seedUsers(scenario)
        case .sharedProfile:
            seedSharedProfile(scenario)
        case .newsList:
            seedNewsList(scenario)
        case .newsEditor:
            seedNewsEditor()
        case .notificationsList:
            seedNotificationsList(scenario)
        case .notificationEditor:
            seedNotificationEditor()
        }
    }

    private func seedProducts(_ scenario: AdaptiveCommunityPreviewScenario) {
        switch scenario {
        case .productsLoading:
            rootViewModel.productsViewModel.isLoadingCatalog = true
        case .productsEmpty:
            rootViewModel.productsViewModel.catalogProducts = []
        case .productsContent:
            rootViewModel.productsViewModel.catalogProducts = previewProducts()
        case .productsFailure:
            rootViewModel.productsViewModel.catalogProducts = []
            environment.feedbackCenter.show(AccessL10nKey.feedbackUnableLoadData)
        case .productEditor:
            seedProductEditor()
        default:
            break
        }
    }

    private func seedUsers(_ scenario: AdaptiveCommunityPreviewScenario) {
        switch scenario {
        case .usersContent:
            rootViewModel.usersViewModel.membersFeed = session.members
        case .userEditor:
            seedUserEditor()
        case .userAction:
            rootViewModel.usersViewModel.pendingToggleActiveMemberId = previewProducerID
        default:
            break
        }
    }

    private func seedSharedProfile(_ scenario: AdaptiveCommunityPreviewScenario) {
        switch scenario {
        case .sharedProfileLoading:
            rootViewModel.sharedProfileViewModel.isLoading = true
        case .sharedProfileContent:
            seedSharedProfileContent()
        default:
            break
        }
    }

    private func seedNewsList(_ scenario: AdaptiveCommunityPreviewScenario) {
        switch scenario {
        case .newsLoading:
            rootViewModel.newsNotificationsViewModel.isLoadingNews = true
        case .newsContent:
            rootViewModel.newsNotificationsViewModel.newsFeed = previewNews()
        case .routeError:
            rootViewModel.newsNotificationsViewModel.newsFeed = []
            environment.feedbackCenter.show(AccessL10nKey.feedbackUnableLoadData)
        default:
            break
        }
    }

    private func seedNotificationsList(_ scenario: AdaptiveCommunityPreviewScenario) {
        switch scenario {
        case .notificationsEmpty:
            rootViewModel.newsNotificationsViewModel.notificationsFeed = []
        case .notificationsContent:
            let viewModel = rootViewModel.newsNotificationsViewModel
            viewModel.notificationsFeed = previewNotifications()
            viewModel.readNotificationIds = [previewReadNotificationID]
        default:
            break
        }
    }

    private func seedProductEditor() {
        let viewModel = rootViewModel.productsViewModel
        var draft = ProductDraft()
        draft.name = "Cesta cooperativa de verduras de temporada"
        draft.description = "Selección semanal de la huerta con variedades sujetas a la cosecha."
        draft.price = "18.50"
        draft.unitName = "cesta"
        draft.unitAbbreviation = "ud"
        draft.unitPlural = "cestas"
        draft.stockMode = .finite
        draft.stockQty = "12"
        viewModel.draft = draft
        viewModel.editingProductId = ""
    }

    private func seedUserEditor() {
        let viewModel = rootViewModel.usersViewModel
        viewModel.draft = MemberDraft(
            displayName: "María de los Ángeles Fernández",
            email: "maria.fernandez@example.test",
            companyName: "Huerta comunitaria La Acequia",
            phoneNumber: "+34 600 123 456",
            isMember: true,
            isProducer: true,
            isAdmin: false,
            isCommonPurchaseManager: false,
            isActive: true
        )
        viewModel.editingMemberId = nil
        viewModel.isEditorOpen = true
    }

    private func seedSharedProfileContent() {
        let viewModel = rootViewModel.sharedProfileViewModel
        viewModel.profiles = previewSharedProfiles()
        viewModel.draft = viewModel.profiles
            .first(where: { $0.userId == session.member.id })?
            .toDraft() ?? SharedProfileDraft()
    }

    private func seedNewsEditor() {
        let viewModel = rootViewModel.newsNotificationsViewModel
        viewModel.newsDraft = NewsDraft(
            title: "Asamblea extraordinaria de la comunidad",
            body: "Revisaremos el calendario, los turnos y las propuestas de mejora del espacio compartido.",
            urlImage: "",
            active: true
        )
        viewModel.editingNewsId = nil
    }

    private func seedNotificationEditor() {
        rootViewModel.newsNotificationsViewModel.notificationDraft = NotificationDraft(
            title: "Cambio de horario para la entrega comunitaria",
            body: "La entrega comenzará treinta minutos más tarde para facilitar el acceso de todas las familias.",
            audience: .all
        )
    }
}
#endif
