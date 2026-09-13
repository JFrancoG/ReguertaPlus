import FirebaseMessaging
import OSLog
import UIKit
import UserNotifications

final class AppDelegate: NSObject, UIApplicationDelegate {
    nonisolated private static let logger = Logger(subsystem: "com.reguerta.app", category: "PushRegistration")
    private var appConfiguration: ReguertaAppConfiguration?
    private var authorizedDeviceRegistrar: (any AuthorizedDeviceRegistrar)?
    private var shiftNotificationPushOpenStore: ShiftNotificationPushOpenStore?
    #if DEBUG
    private var localCoveragePushEnabled = false
    func enableLocalCoveragePush() {
        localCoveragePushEnabled = true
    }
    #endif
    private var pendingRegistrationToken: PendingRegistrationToken?

    /// Installs launch policy and the shared device coordinator before application lifecycle callbacks begin.
    func configure(
        appConfiguration: ReguertaAppConfiguration,
        authorizedDeviceRegistrar: any AuthorizedDeviceRegistrar,
        shiftNotificationPushOpenStore: ShiftNotificationPushOpenStore
    ) {
        self.appConfiguration = appConfiguration
        self.authorizedDeviceRegistrar = authorizedDeviceRegistrar
        self.shiftNotificationPushOpenStore = shiftNotificationPushOpenStore
        guard case .received(let token) = pendingRegistrationToken else { return }
        pendingRegistrationToken = nil
        forwardRegistrationToken(token, to: authorizedDeviceRegistrar)
    }

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        ReguertaFontRegistrar.registerDesignFonts()
        UNUserNotificationCenter.current().delegate = self
        #if DEBUG
        if localCoveragePushEnabled {
            requestPushAuthorization(registerRemotely: false)
        }
        #endif
        guard pushNotificationsEnabled else { return true }
        FirebaseBootstrapper.configureIfNeeded()
        Messaging.messaging().delegate = self
        requestPushAuthorization()
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        guard pushNotificationsEnabled else { return }
        Messaging.messaging().apnsToken = deviceToken
        Messaging.messaging().token { _, error in
            if let error {
                Self.logger.error(
                    "Unable to fetch FCM token after APNs registration: \(String(describing: error), privacy: .private)"
                )
                return
            }
        }
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: any Error) {
        guard pushNotificationsEnabled else { return }
        print("APNs registration failed: \(error.localizedDescription)")
    }

    private func requestPushAuthorization(registerRemotely: Bool = true) {
        Task { @MainActor in
            do {
                let granted = try await UNUserNotificationCenter.current().requestAuthorization(
                    options: [.alert, .badge, .sound]
                )
                guard granted else {
                    print("Push authorization denied by user")
                    return
                }
                if registerRemotely {
                    UIApplication.shared.registerForRemoteNotifications()
                }
            } catch {
                print("Push authorization request failed: \(error.localizedDescription)")
            }
        }
    }
}

extension AppDelegate: MessagingDelegate {
    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        guard pushNotificationsEnabled else { return }
        guard let authorizedDeviceRegistrar else {
            pendingRegistrationToken = .received(fcmToken)
            return
        }
        forwardRegistrationToken(fcmToken, to: authorizedDeviceRegistrar)
    }

    var pushNotificationsEnabled: Bool {
        guard let appConfiguration else {
            preconditionFailure("AppDelegate must receive App configuration before lifecycle callbacks")
        }
        return appConfiguration.pushNotifications == .enabled
    }

    private func forwardRegistrationToken(
        _ token: String?,
        to authorizedDeviceRegistrar: any AuthorizedDeviceRegistrar
    ) {
        Task {
            do {
                try await authorizedDeviceRegistrar.updateRegistrationToken(token)
            } catch is CancellationError {
                return
            } catch {
                // The coordinator records private diagnostics; push registration remains best-effort.
            }
        }
    }
}

extension AppDelegate: UNUserNotificationCenterDelegate {}

private enum PendingRegistrationToken {
    case received(String?)
}

extension AppDelegate {
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        print("Foreground push received: \(notification.request.identifier)")
        return [.banner, .sound, .badge, .list]
    }

    /// Finishes on MainActor because UIKit may restore its scene inside the completion callback.
    /// Extracts the immutable reference before hopping actors; no SDK notification crosses that boundary.
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping @Sendable () -> Void
    ) {
        let userInfo = response.notification.request.content.userInfo
        let reference = ShiftNotificationPushReference.validated(
            eventID: userInfo["eventId"] as? String,
            type: userInfo["type"] as? String,
            target: userInfo["target"] as? String
        )
        Task { @MainActor in
            if let reference {
                acceptOpenedShiftNotificationPush(reference)
            }
            completionHandler()
        }
    }

    @MainActor
    private func acceptOpenedShiftNotificationPush(_ reference: ShiftNotificationPushReference) {
        shiftNotificationPushOpenStore?.accept(reference)
    }
}
