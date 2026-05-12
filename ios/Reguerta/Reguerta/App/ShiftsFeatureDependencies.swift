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
        notificationRepository: (any NotificationRepository)? = nil,
        nowMillisProvider: @escaping @MainActor () -> Int64
    ) -> ShiftsFeatureDependencies {
        ShiftsFeatureDependencies(
            shiftRepository: ChainedShiftRepository(
                primary: FirestoreShiftRepository(db: db),
                fallback: InMemoryShiftRepository()
            ),
            shiftSwapRequestRepository: ChainedShiftSwapRequestRepository(
                primary: FirestoreShiftSwapRequestRepository(db: db),
                fallback: InMemoryShiftSwapRequestRepository()
            ),
            shiftPlanningRequestRepository: ChainedShiftPlanningRequestRepository(
                primary: FirestoreShiftPlanningRequestRepository(db: db),
                fallback: InMemoryShiftPlanningRequestRepository()
            ),
            deliveryCalendarRepository: ChainedDeliveryCalendarRepository(
                primary: FirestoreDeliveryCalendarRepository(db: db),
                fallback: InMemoryDeliveryCalendarRepository()
            ),
            notificationRepository: notificationRepository ?? ChainedNotificationRepository(
                primary: FirestoreNotificationRepository(db: db),
                fallback: InMemoryNotificationRepository()
            ),
            nowMillisProvider: nowMillisProvider
        )
    }

    static func preview(
        shiftRepository: InMemoryShiftRepository = InMemoryShiftRepository(),
        shiftSwapRequestRepository: InMemoryShiftSwapRequestRepository = InMemoryShiftSwapRequestRepository(),
        shiftPlanningRequestRepository: InMemoryShiftPlanningRequestRepository = InMemoryShiftPlanningRequestRepository(),
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
