import SwiftUI

extension ContentView {
    @ViewBuilder
    var dashboardRoute: some View {
        nextShiftsCard

        switch viewModel.mode {
        case .signedOut:
            cardContainer {
                Text(localizedKey(AccessL10nKey.signedOutHint))
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textSecondary)
            }
        case .unauthorized:
            EmptyView()
        case .authorized(let session):
            authorizedHome(session: session)
        }

        latestNewsCard
    }

    @ViewBuilder
    func authorizedHome(session: AuthorizedSession) -> some View {
        operationalModules(
            modulesEnabled: true,
            canOpenProducts: session.member.roles.contains(.producer) || session.member.isCommonPurchaseManager,
            myOrderFreshnessState: viewModel.myOrderFreshnessState
        )

        if session.member.isAdmin {
            adminToolsCard(session: session)
        }
    }

    var nextShiftsCard: some View {
        NextShiftsCardView(
            tokens: tokens,
            isLoading: viewModel.isLoadingShifts,
            nextDeliverySummary: viewModel.nextDeliveryShift.map(shiftSummary) ?? l10n(AccessL10nKey.shiftsNextPending),
            nextMarketSummary: viewModel.nextMarketShift.map(shiftSummary) ?? l10n(AccessL10nKey.shiftsNextPending),
            onViewAll: {
                homeDestination = .shifts
                viewModel.refreshShifts()
            }
        )
    }

    var latestNewsCard: some View {
        LatestNewsCardView(
            tokens: tokens,
            latestNews: viewModel.latestNews,
            onViewAll: {
                homeDestination = .news
                viewModel.refreshNews()
            }
        )
    }

    @ViewBuilder
    func operationalModules(
        modulesEnabled: Bool,
        canOpenProducts: Bool,
        myOrderFreshnessState: MyOrderFreshnessState,
        disabledMessageKey: String? = nil
    ) -> some View {
        OperationalModulesCardView(
            tokens: tokens,
            modulesEnabled: modulesEnabled,
            canOpenProducts: canOpenProducts,
            myOrderFreshnessState: myOrderFreshnessState,
            disabledMessageKey: disabledMessageKey,
            onOpenMyOrder: {},
            onOpenProducts: {
                homeDestination = .products
                viewModel.refreshProducts()
            },
            onOpenShifts: {
                homeDestination = .shifts
                viewModel.refreshShifts()
            },
            onRetryFreshness: {
                viewModel.refreshMyOrderFreshness()
            }
        )
    }

    @ViewBuilder
    func adminToolsCard(session: AuthorizedSession) -> some View {
        AdminToolsCardView(
            tokens: tokens,
            session: session,
            isExpanded: $isAdminToolsExpanded,
            memberDraft: memberDraftBinding,
            onCreateMember: viewModel.createAuthorizedMember,
            onToggleAdmin: { memberId in
                viewModel.toggleAdmin(memberId: memberId)
            },
            onToggleActive: { memberId in
                viewModel.toggleActive(memberId: memberId)
            }
        )
    }
}
