import FirebaseFirestore
import Foundation

struct ShiftsFeatureDependencies {
    let shiftRepository: any ShiftRepository
    let shiftSwapRequestRepository: any ShiftSwapRequestRepository
    let shiftPlanningRequestRepository: any ShiftPlanningRequestRepository
    let deliveryCalendarRepository: any DeliveryCalendarRepository
    let coverageRepositoryFactory: @MainActor (
        @escaping @MainActor () -> ShiftCoverageSession?
    ) -> any ShiftCoverageRepository
    let nowMillisProvider: @MainActor () -> Int64
    let environmentProvider: @MainActor () -> ReguertaFirestoreEnvironment

    static func live(
        db: Firestore,
        environmentProvider: any SessionEnvironmentSnapshotProviding,
        functionsClient: AuthenticatedFirebaseFunctionsClient,
        nowMillisProvider: @escaping @MainActor () -> Int64
    ) -> ShiftsFeatureDependencies {
        ShiftsFeatureDependencies(
            shiftRepository: FirestoreShiftRepository(firebaseAppName: db.app.name),
            shiftSwapRequestRepository: FirestoreShiftSwapRequestRepository(
                firebaseAppName: db.app.name,
                functionsClient: functionsClient
            ),
            shiftPlanningRequestRepository: FirestoreShiftPlanningRequestRepository(
                firebaseAppName: db.app.name,
                functionsClient: functionsClient
            ),
            deliveryCalendarRepository: FirestoreDeliveryCalendarRepository(
                firebaseAppName: db.app.name,
                functionsClient: functionsClient
            ),
            coverageRepositoryFactory: { currentSession in
                FirebaseShiftCoverageRepository(client: functionsClient, currentSession: currentSession)
            },
            nowMillisProvider: nowMillisProvider,
            environmentProvider: { environmentProvider.snapshot().environment }
        )
    }

    static func preview(
        shiftRepository: InMemoryShiftRepository = InMemoryShiftRepository(),
        shiftSwapRequestRepository: InMemoryShiftSwapRequestRepository = InMemoryShiftSwapRequestRepository(),
        shiftPlanningRequestRepository: InMemoryShiftPlanningRequestRepository = InMemoryShiftPlanningRequestRepository(
        ),
        deliveryCalendarRepository: InMemoryDeliveryCalendarRepository = InMemoryDeliveryCalendarRepository(),
        coverageRepositoryFactory: @escaping @MainActor (
            @escaping @MainActor () -> ShiftCoverageSession?
        ) -> any ShiftCoverageRepository = { _ in InactiveShiftCoverageRepository() },
        nowMillisProvider: @escaping @MainActor () -> Int64 = { 0 },
        environmentProvider: @escaping @MainActor () -> ReguertaFirestoreEnvironment = { .develop }
    ) -> ShiftsFeatureDependencies {
        ShiftsFeatureDependencies(
            shiftRepository: shiftRepository,
            shiftSwapRequestRepository: shiftSwapRequestRepository,
            shiftPlanningRequestRepository: shiftPlanningRequestRepository,
            deliveryCalendarRepository: deliveryCalendarRepository,
            coverageRepositoryFactory: coverageRepositoryFactory,
            nowMillisProvider: nowMillisProvider,
            environmentProvider: environmentProvider
        )
    }
}
