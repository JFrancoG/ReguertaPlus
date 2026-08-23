import Testing

@testable import Reguerta

@Suite("My Order local-state resolution")
struct MyOrderLocalStateUseCaseTests {
    @Test func confirmedStateWinsWithoutReadingTheDraft() async {
        let store = RecordingMyOrderLocalStateStore()
        let scope = localStateScope()
        await store.persistCart(
            storageKey: scope.storageKey,
            snapshot: MyOrderCartSnapshot(selectedQuantities: ["draft": 2], selectedEcoBasketOptions: [:])
        )
        await store.persistConfirmed(
            storageKey: scope.storageKey,
            snapshot: MyOrderCartSnapshot(selectedQuantities: ["confirmed": 1], selectedEcoBasketOptions: [:])
        )
        let useCase = ResolveMyOrderLocalStateUseCase(cartStore: store)

        let state = await useCase.execute(scope: scope)
        let reads = await store.readCounts()

        #expect(state == .confirmed)
        #expect(reads.confirmed == 1)
        #expect(reads.cart == 0)
    }

    @Test func draftAndEmptyStatesAreResolvedFromTheInjectedStore() async {
        let store = RecordingMyOrderLocalStateStore()
        let draftScope = localStateScope()
        let emptyScope = localStateScope(memberId: "other_member")
        await store.persistCart(
            storageKey: draftScope.storageKey,
            snapshot: MyOrderCartSnapshot(selectedQuantities: ["draft": 2], selectedEcoBasketOptions: [:])
        )
        let useCase = ResolveMyOrderLocalStateUseCase(cartStore: store)

        #expect(await useCase.execute(scope: draftScope) == .draft)
        #expect(await useCase.execute(scope: emptyScope) == .empty)
    }

    @Test func localStateIsIsolatedByMemberWeekAndEnvironment() async {
        let store = InMemoryMyOrderCartStore()
        let baseScope = localStateScope()
        await store.seedConfirmed(
            MyOrderCartSnapshot(selectedQuantities: ["confirmed": 1], selectedEcoBasketOptions: [:]),
            storageKey: baseScope.storageKey
        )
        let useCase = ResolveMyOrderLocalStateUseCase(cartStore: store)
        let neighboringScopes = [
            localStateScope(memberId: "other_member"),
            localStateScope(weekKey: "2026-W20"),
            localStateScope(environment: .production)
        ]

        #expect(await useCase.execute(scope: baseScope) == .confirmed)
        for scope in neighboringScopes {
            #expect(await useCase.execute(scope: scope) == .empty)
        }
    }

    private func localStateScope(
        memberId: String? = "member_1",
        weekKey: String = "2026-W19",
        environment: SessionEnvironment = .develop
    ) -> MyOrderLocalStateScope {
        MyOrderLocalStateScope(memberId: memberId, weekKey: weekKey, environment: environment)
    }
}

private actor RecordingMyOrderLocalStateStore: MyOrderCartStore {
    private var cartByKey: [String: MyOrderCartSnapshot] = [:]
    private var confirmedByKey: [String: MyOrderCartSnapshot] = [:]
    private var cartReadCount = 0
    private var confirmedReadCount = 0

    func readCart(storageKey: String) async -> MyOrderCartSnapshot {
        cartReadCount += 1
        return cartByKey[storageKey] ?? .empty
    }

    func persistCart(storageKey: String, snapshot: MyOrderCartSnapshot) async {
        cartByKey[storageKey] = snapshot.normalized
    }

    func readConfirmed(storageKey: String) async -> MyOrderCartSnapshot {
        confirmedReadCount += 1
        return confirmedByKey[storageKey] ?? .empty
    }

    func persistConfirmed(storageKey: String, snapshot: MyOrderCartSnapshot) async {
        confirmedByKey[storageKey] = snapshot.normalized
    }

    func readCounts() -> (cart: Int, confirmed: Int) {
        (cartReadCount, confirmedReadCount)
    }
}
