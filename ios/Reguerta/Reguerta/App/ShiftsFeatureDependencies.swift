import FirebaseFirestore
import Foundation

struct ShiftsFeatureDependencies {
    let shiftRepository: any ShiftRepository
    let shiftSwapRequestRepository: any ShiftSwapRequestRepository
    let shiftPlanningRequestRepository: any ShiftPlanningRequestRepository
    let deliveryCalendarRepository: any DeliveryCalendarRepository
    let notificationRepository: any NotificationRepository
    let nowMillisProvider: @MainActor () -> Int64

    static func live(
        db: Firestore,
        functionsClient: AuthenticatedFirebaseFunctionsClient,
        notificationRepository: (any NotificationRepository)? = nil,
        nowMillisProvider: @escaping @MainActor () -> Int64
    ) -> ShiftsFeatureDependencies {
        ShiftsFeatureDependencies(
            shiftRepository: FirestoreShiftRepository(db: db),
            shiftSwapRequestRepository: FirestoreShiftSwapRequestRepository(
                db: db,
                functionsClient: functionsClient
            ),
            shiftPlanningRequestRepository: FirestoreShiftPlanningRequestRepository(db: db),
            deliveryCalendarRepository: FirestoreDeliveryCalendarRepository(db: db),
            notificationRepository: notificationRepository ?? FirestoreNotificationRepository(db: db),
            nowMillisProvider: nowMillisProvider
        )
    }

    static func preview(
        shiftRepository: InMemoryShiftRepository = InMemoryShiftRepository(),
        shiftSwapRequestRepository: InMemoryShiftSwapRequestRepository = InMemoryShiftSwapRequestRepository(),
        shiftPlanningRequestRepository: InMemoryShiftPlanningRequestRepository = InMemoryShiftPlanningRequestRepository(
        ),
        deliveryCalendarRepository: InMemoryDeliveryCalendarRepository = InMemoryDeliveryCalendarRepository(),
        notificationRepository: InMemoryNotificationRepository = InMemoryNotificationRepository(),
        nowMillisProvider: @escaping @MainActor () -> Int64 = { 0 }
    ) -> ShiftsFeatureDependencies {
        ShiftsFeatureDependencies(
            shiftRepository: shiftRepository,
            shiftSwapRequestRepository: shiftSwapRequestRepository,
            shiftPlanningRequestRepository: shiftPlanningRequestRepository,
            deliveryCalendarRepository: deliveryCalendarRepository,
            notificationRepository: notificationRepository,
            nowMillisProvider: nowMillisProvider
        )
    }
}
