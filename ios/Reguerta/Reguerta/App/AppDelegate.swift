import FirebaseMessaging
import OSLog
import UIKit
import UserNotifications

final class AppDelegate: NSObject, UIApplicationDelegate {
    private static let logger = Logger(subsystem: "com.reguerta.app", category: "PushRegistration")
    private var authorizedDeviceRegistrar: (any AuthorizedDeviceRegistrar)?
    private var pendingRegistrationToken: PendingRegistrationToken?
    private static var usesMockAuth: Bool {
        ProcessInfo.processInfo.arguments.contains("-useMockAuth")
    }

    func configure(authorizedDeviceRegistrar: any AuthorizedDeviceRegistrar) {
        self.authorizedDeviceRegistrar = authorizedDeviceRegistrar
        guard case .received(let token) = pendingRegistrationToken else { return }
        pendingRegistrationToken = nil
        forwardRegistrationToken(token, to: authorizedDeviceRegistrar)
    }

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        ReguertaFontRegistrar.registerDesignFonts()
        guard !Self.usesMockAuth else { return true }
        FirebaseBootstrapper.configureIfNeeded()
        Messaging.messaging().delegate = self
        UNUserNotificationCenter.current().delegate = self
        requestPushAuthorization(application)
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        guard !Self.usesMockAuth else { return }
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
        guard !Self.usesMockAuth else { return }
        print("APNs registration failed: \(error.localizedDescription)")
    }

    private func requestPushAuthorization(_ application: UIApplication) {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, error in
            if let error {
                print("Push authorization request failed: \(error.localizedDescription)")
                return
            }
            guard granted else {
                print("Push authorization denied by user")
                return
            }
            DispatchQueue.main.async {
                application.registerForRemoteNotifications()
            }
        }
    }
}

extension AppDelegate: MessagingDelegate {
    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        guard !Self.usesMockAuth else { return }
        guard let authorizedDeviceRegistrar else {
            pendingRegistrationToken = .received(fcmToken)
            return
        }
        forwardRegistrationToken(fcmToken, to: authorizedDeviceRegistrar)
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

    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse
    ) async {
        print("Push opened by user: \(response.notification.request.identifier)")
    }
}
