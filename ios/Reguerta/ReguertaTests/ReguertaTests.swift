import FirebaseAuth
import Foundation
import SwiftUI
import Testing

@testable import Reguerta

@MainActor
struct ReguertaTests {
    @Test func appAppearanceMapsSystemLightAndDarkModes() {
        #expect(AppAppearance(rawValue: "unexpected") == nil)
        #expect(AppAppearance.system.preferredColorScheme == nil)
        #expect(AppAppearance.light.preferredColorScheme == .light)
        #expect(AppAppearance.dark.preferredColorScheme == .dark)
    }

    @Test func unauthorizedEmailStaysRestricted() async throws {
        let repository = InMemoryMemberRepository()
        let useCase = makeInMemoryResolveUseCase(repository: repository)

        let result = try await useCase.execute(
            authPrincipal: AuthPrincipal(uid: "uid_unknown", email: "unknown@reguerta.app")
        )

        #expect(result == .unauthorized(.userNotFoundInAuthorizedUsers))
    }

    @Test func existingInactiveMemberDoesNotUseMissingUsersReason() async throws {
        let repository = InMemoryMemberRepository()
        let useCase = makeInMemoryResolveUseCase(repository: repository)

        _ = await repository.upsert(
            member: Member(
                id: "member_inactive_001",
                displayName: "Inactiva",
                normalizedEmail: "inactive@reguerta.app",
                authUid: nil,
                roles: [.member],
                isActive: false,
                producerCatalogEnabled: true
            )
        )

        let result = try await useCase.execute(
            authPrincipal: AuthPrincipal(uid: "uid_inactive", email: "inactive@reguerta.app")
        )

        #expect(result == .unauthorized(.userAccessRestricted))
    }

    @Test func firstAuthorizedLoginLinksAuthUid() async throws {
        let repository = InMemoryMemberRepository()
        let useCase = makeInMemoryResolveUseCase(repository: repository)

        let result = try await useCase.execute(
            authPrincipal: AuthPrincipal(uid: "uid_admin_1", email: "ana.admin@reguerta.app")
        )

        guard case .authorized(let member, _) = result else {
            Issue.record("Expected authorized session")
            return
        }

        #expect(member.authUid == "uid_admin_1")
    }

    @Test func preventRemovingLastActiveAdmin() async {
        let upsertUseCase = UpsertMemberByAdminUseCase(
            repository: RejectingMemberAdministrationRepository(error: .lastAdminRemoval)
        )
        let admin = Member(
            id: "member_admin_001",
            displayName: "Ana Admin",
            normalizedEmail: "ana.admin@reguerta.app",
            authUid: "uid_admin_2",
            roles: [.member, .admin],
            isActive: true,
            producerCatalogEnabled: true
        )

        do {
            _ = try await upsertUseCase.execute(
                target: Member(
                    id: admin.id,
                    displayName: admin.displayName,
                    normalizedEmail: admin.normalizedEmail,
                    authUid: admin.authUid,
                    roles: [.member],
                    isActive: admin.isActive,
                    producerCatalogEnabled: admin.producerCatalogEnabled
                ),
                environment: .develop
            )
            Issue.record("Expected last admin protection")
        } catch let error as MemberManagementError {
            #expect(error == .lastAdminRemoval)
        } catch {
            Issue.record("Unexpected error: \(error)")
        }
    }

    @Test func adminCanCreatePreAuthorizedMember() async throws {
        let repository = InMemoryMemberRepository()
        let resolveUseCase = makeInMemoryResolveUseCase(repository: repository)
        let upsertUseCase = UpsertMemberByAdminUseCase(
            repository: LocalMemberAdministrationRepository(repository: repository)
        )

        _ = try await resolveUseCase.execute(
            authPrincipal: AuthPrincipal(uid: "uid_admin_3", email: "ana.admin@reguerta.app")
        )

        let created = try await upsertUseCase.execute(
            target: Member(
                id: "member_new_001",
                displayName: "Nuevo Miembro",
                normalizedEmail: "nuevo@reguerta.app",
                authUid: nil,
                roles: [.member],
                isActive: true,
                producerCatalogEnabled: true
            ),
            environment: .develop
        )

        #expect(created.normalizedEmail == "nuevo@reguerta.app")
        #expect(await repository.findByEmailNormalized("nuevo@reguerta.app") != nil)
    }

    @Test func authUidMatchWinsOverEmailDuplicate() async throws {
        let repository = InMemoryMemberRepository()
        let useCase = makeInMemoryResolveUseCase(repository: repository)

        _ = try await useCase.execute(
            authPrincipal: AuthPrincipal(uid: "uid_admin_linked", email: "ana.admin@reguerta.app")
        )

        _ = await repository.upsert(
            member: Member(
                id: "member_duplicate_email",
                displayName: "Duplicado",
                normalizedEmail: "ana.admin@reguerta.app",
                authUid: nil,
                roles: [.member],
                isActive: true,
                producerCatalogEnabled: true
            )
        )

        let result = try await useCase.execute(
            authPrincipal: AuthPrincipal(uid: "uid_admin_linked", email: "ana.admin@reguerta.app")
        )

        guard case .authorized(let member, _) = result else {
            Issue.record("Expected linked authorization to succeed")
            return
        }
        #expect(member.authUid == "uid_admin_linked")
        #expect(member.roles.contains(.admin))
    }

    @Test func authShellRoutesSplashToWelcomeWhenNoSession() {
        let reduced = reduceAuthShell(
            state: AuthShellState(),
            action: .splashCompleted(isAuthenticated: false)
        )

        #expect(reduced.currentRoute == .welcome)
        #expect(reduced.canGoBack == false)
    }

    @Test func authShellDeterministicBackFlowForLoginRegister() {
        let welcome = AuthShellState(backStack: [.welcome])
        let login = reduceAuthShell(state: welcome, action: .continueFromWelcome)
        let register = reduceAuthShell(state: login, action: .openRegisterFromLogin)
        let backToLogin = reduceAuthShell(state: register, action: .back)
        let backToWelcome = reduceAuthShell(state: backToLogin, action: .back)

        #expect(login.currentRoute == .login)
        #expect(register.currentRoute == .register)
        #expect(backToLogin.currentRoute == .login)
        #expect(backToWelcome.currentRoute == .welcome)
    }
}

extension ReguertaTests {
    @Test func authShellCanOpenRegisterDirectlyFromWelcome() {
        let welcome = AuthShellState(backStack: [.welcome])
        let register = reduceAuthShell(state: welcome, action: .openRegisterFromWelcome)
        let backToWelcome = reduceAuthShell(state: register, action: .back)

        #expect(register.currentRoute == .register)
        #expect(backToWelcome.currentRoute == .welcome)
    }

    @Test func authShellResetsToHomeOnAuthenticatedSession() {
        let state = AuthShellState(backStack: [.welcome, .login, .recoverPassword])
        let reduced = reduceAuthShell(state: state, action: .sessionAuthenticated)

        #expect(reduced.currentRoute == .home)
        #expect(reduced.canGoBack == false)
    }

    @Test func authShellResetsToWelcomeOnSignOut() {
        let state = AuthShellState(backStack: [.home])
        let reduced = reduceAuthShell(state: state, action: .signedOut)

        #expect(reduced.currentRoute == .welcome)
        #expect(reduced.canGoBack == false)
    }

    @Test func inMemoryNewsRepositoryReturnsNewestFirst() async {
        let repository = InMemoryNewsRepository()

        _ = await repository.upsert(
            article: NewsArticle(
                id: "news_002",
                title: "Nueva noticia",
                body: "Texto",
                active: true,
                publishedBy: "Ana Admin",
                publishedAtMillis: 4_000_000_000_000,
                urlImage: nil
            ),
            environment: .develop
        )

        let news = await repository.allNews(environment: .develop)

        #expect(news.first?.id == "news_002")
    }

    @Test func inMemoryNewsRepositoryDeletesExistingNews() async {
        let repository = InMemoryNewsRepository()

        let deleted = await repository.delete(newsId: "news_welcome_001", environment: .develop)
        let remaining = await repository.allNews(environment: .develop)

        #expect(deleted == true)
        #expect(remaining.contains(where: { $0.id == "news_welcome_001" }) == false)
    }

    @Test func inMemoryNotificationRepositoryReturnsNewestFirst() async {
        let repository = InMemoryNotificationRepository()

        _ = await repository.send(
            event: NotificationEvent(
                id: "notification_002",
                title: "Aviso",
                body: "Texto",
                type: "admin_broadcast",
                target: "all",
                userIds: [],
                segmentType: nil,
                targetRole: nil,
                createdBy: "adminUid",
                sentAtMillis: 4_000_000_000_000,
                weekKey: nil
            ),
            environment: .develop
        )

        let notifications = await repository.allNotifications(environment: .develop)

        #expect(notifications.first?.id == "notification_002")
    }

    @Test func firebaseAuthErrorMappingCoversKnownCodes() {
        let invalidEmail = NSError(domain: AuthErrorDomain, code: AuthErrorCode.invalidEmail.rawValue)
        let wrongPassword = NSError(domain: AuthErrorDomain, code: AuthErrorCode.wrongPassword.rawValue)
        let emailAlreadyInUse = NSError(domain: AuthErrorDomain, code: AuthErrorCode.emailAlreadyInUse.rawValue)
        let weakPassword = NSError(domain: AuthErrorDomain, code: AuthErrorCode.weakPassword.rawValue)
        let notFound = NSError(domain: AuthErrorDomain, code: AuthErrorCode.userNotFound.rawValue)
        let disabled = NSError(domain: AuthErrorDomain, code: AuthErrorCode.userDisabled.rawValue)
        let tooMany = NSError(domain: AuthErrorDomain, code: AuthErrorCode.tooManyRequests.rawValue)
        let network = NSError(domain: AuthErrorDomain, code: AuthErrorCode.networkError.rawValue)

        #expect(mapFirebaseAuthError(invalidEmail) == .invalidEmail)
        #expect(mapFirebaseAuthError(wrongPassword) == .invalidCredentials)
        #expect(mapFirebaseAuthError(emailAlreadyInUse) == .emailAlreadyInUse)
        #expect(mapFirebaseAuthError(weakPassword) == .weakPassword)
        #expect(mapFirebaseAuthError(notFound) == .userNotFound)
        #expect(mapFirebaseAuthError(disabled) == .userDisabled)
        #expect(mapFirebaseAuthError(tooMany) == .tooManyRequests)
        #expect(mapFirebaseAuthError(network) == .network)
    }

    @Test func receivedOrderStatusWriteResultMapsPermissionDenied() {
        let error = NSError(
            domain: "FIRFirestoreErrorDomain",
            code: 7
        )

        #expect(receivedOrderStatusWriteResult(from: error) == .permissionDenied)
    }

    @Test func receivedOrderStatusWriteResultMapsUnknownAsFailure() {
        let error = NSError(domain: "example", code: -99)

        #expect(receivedOrderStatusWriteResult(from: error) == .failure)
    }

    @Test func authErrorPresentationMappingByFlow() {
        let signIn = mapAuthFailure(.invalidCredentials, flow: .signIn)
        #expect(signIn.passwordErrorKey == AccessL10nKey.authErrorInvalidCredentials)
        #expect(signIn.emailErrorKey == nil)

        let signUp = mapAuthFailure(.emailAlreadyInUse, flow: .signUp)
        #expect(signUp.emailErrorKey == AccessL10nKey.authErrorEmailAlreadyInUse)

        let passwordReset = mapAuthFailure(.invalidCredentials, flow: .passwordReset)
        #expect(passwordReset.globalMessageKey == AccessL10nKey.authErrorUnknown)
    }

    @Test func semanticComparatorSupportsVariableVersionSegments() {
        #expect(SemanticVersionComparator.compare("0.3", "0.3.0") == 0)
        #expect(SemanticVersionComparator.compare("0.3.0.1", "0.3.0") == 1)
        #expect(SemanticVersionComparator.compare("0.2.9", "0.3.0") == -1)
        #expect(SemanticVersionComparator.compare("0.3-beta", "0.3.0") == nil)
    }

    @Test func orderReadsUseBothOwnerAliasesWithinTheRequestedWeek() {
        let scopes = myOrderOwnedWeekQueryScopes(
            memberId: "member_1",
            weekKey: "2026-W30"
        )

        #expect(
            scopes == [
                MyOrderOwnedWeekQueryScope(
                    ownerField: "userId",
                    ownerId: "member_1",
                    weekKey: "2026-W30"
                ),
                MyOrderOwnedWeekQueryScope(
                    ownerField: "memberId",
                    ownerId: "member_1",
                    weekKey: "2026-W30"
                )
            ]
        )
    }

    @Test func previousOrderCandidatesKeepTheDeterministicIdAndDeduplicateDiscoveredOrders() {
        let candidateIds = myOrderCandidateOrderIds(
            deterministicOrderId: "member_1_2026-W30",
            discoveredOrderIds: [
                "legacy_member_1_2026-W30",
                "member_1_2026-W30",
                " ",
                "legacy_member_1_2026-W30"
            ]
        )

        #expect(candidateIds == ["member_1_2026-W30", "legacy_member_1_2026-W30"])
    }

    @Test func checkoutUsesTheSingleHistoricalOrderIdInsteadOfCreatingADuplicate() throws {
        let resolvedOrderId = try resolveMyOrderCheckoutDocumentId(
            newOrderId: "member_1_2026-W30",
            existingOrderIds: ["-O-historical-order"]
        )

        #expect(resolvedOrderId == "-O-historical-order")
    }

    @Test func checkoutUsesTheNewIdOnlyWhenTheOwnedWeekHasNoOrder() throws {
        let resolvedOrderId = try resolveMyOrderCheckoutDocumentId(
            newOrderId: "member_1_2026-W30",
            existingOrderIds: []
        )

        #expect(resolvedOrderId == "member_1_2026-W30")
    }

    @Test func checkoutRejectsAnAmbiguousOwnedWeekBeforeSelectingAnOrder() {
        #expect(throws: MyOrderCheckoutResolutionError.ambiguousExistingOrders) {
            try resolveMyOrderCheckoutDocumentId(
                newOrderId: "member_1_2026-W30",
                existingOrderIds: ["-O-order-one", "-O-order-two"]
            )
        }
    }

    @Test func memberVisibleFirestorePathsUseSanitizedDirectoryAndConfig() {
        let path = ReguertaFirestorePath(environment: .develop)

        #expect(path.collectionPath(.memberDirectory) == "develop/plus-collections/memberDirectory")
        #expect(
            path.documentPath(in: .config, documentId: ReguertaFirestoreDocument.memberConfiguration.rawValue)
                == "develop/plus-collections/config/member"
        )
    }

}

@MainActor
private func makeInMemoryResolveUseCase(
    repository: any LocalMemberRepository
) -> ResolveAuthorizedSessionUseCase {
    ResolveAuthorizedSessionUseCase(
        repository: repository,
        resolver: InMemoryAuthorizedMemberResolver(repository: repository),
        environmentRouter: FixedSessionEnvironmentRouter()
    )
}

private struct RejectingMemberAdministrationRepository: MemberAdministrationRepository {
    let error: MemberManagementError

    func upsertMember(_ member: Member, environment _: SessionEnvironment) async throws -> Member {
        throw error
    }
}
