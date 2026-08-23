import FirebaseFirestore
import Foundation

struct ShiftsFeatureDependencies {
    let shiftRepository: any ShiftRepository
    let shiftSwapRequestRepository: any ShiftSwapRequestRepository
    let shiftPlanningRequestRepository: any ShiftPlanningRequestRepository
    let deliveryCalendarRepository: any DeliveryCalendarRepository
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
            shiftPlanningRequestRepository: FirestoreShiftPlanningRequestRepository(firebaseAppName: db.app.name),
            deliveryCalendarRepository: FirestoreDeliveryCalendarRepository(firebaseAppName: db.app.name),
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
        nowMillisProvider: @escaping @MainActor () -> Int64 = { 0 },
        environmentProvider: @escaping @MainActor () -> ReguertaFirestoreEnvironment = { .develop }
    ) -> ShiftsFeatureDependencies {
        ShiftsFeatureDependencies(
            shiftRepository: shiftRepository,
            shiftSwapRequestRepository: shiftSwapRequestRepository,
            shiftPlanningRequestRepository: shiftPlanningRequestRepository,
            deliveryCalendarRepository: deliveryCalendarRepository,
            nowMillisProvider: nowMillisProvider,
            environmentProvider: environmentProvider
        )
    }
}
