//
//  ReguertaApp.swift
//  Reguerta
//
//  Created by Jesús Franco on 05.02.2026.
//

import SwiftUI
import FirebaseCore
import FirebaseMessaging
import UIKit
import UserNotifications

@main
struct ReguertaApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    var body: some Scene {
        WindowGroup {
            ReguertaTheme {
                ContentView()
            }
        }
    }
}

final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        ReguertaFontRegistrar.registerDesignFonts()
        FirebaseApp.configure()
        Messaging.messaging().delegate = self
        UNUserNotificationCenter.current().delegate = self
        requestPushAuthorization(application)
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Messaging.messaging().apnsToken = deviceToken
        Messaging.messaging().token { token, error in
            if let error {
                print("Unable to fetch FCM token after APNs registration: \(error.localizedDescription)")
                return
            }
            print("FCM token refreshed after APNs registration: \(token ?? "nil")")
        }
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: any Error) {
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
        print("FCM registration token received: \(fcmToken ?? "nil")")
        Task {
            await KeyManager.shared.save(fcmToken, for: .fcmToken)
            let token = fcmToken?.trimmingCharacters(in: .whitespacesAndNewlines)
            guard let token, !token.isEmpty else {
                return
            }
            let memberId = await KeyManager.shared.load(.authorizedMemberId)
            guard let memberId else {
                return
            }

            let repository = FirestoreDeviceRegistrationRepository()
            let nowMillis = Int64(Date().timeIntervalSince1970 * 1_000)
            _ = await repository.register(
                memberId: memberId,
                device: RegisteredDevice(
                    deviceId: UIDevice.current.identifierForVendor?.uuidString ?? "ios-\(UIDevice.current.model)",
                    platform: "ios",
                    appVersion: resolveInstalledAppVersion(),
                    osVersion: UIDevice.current.systemVersion,
                    apiLevel: nil,
                    manufacturer: "Apple",
                    model: UIDevice.current.model,
                    fcmToken: token,
                    firstSeenAtMillis: nowMillis,
                    lastSeenAtMillis: nowMillis,
                    tokenUpdatedAtMillis: nowMillis
                )
            )
        }
    }
}

extension AppDelegate: UNUserNotificationCenterDelegate {}

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

func resolveInstalledAppVersion(bundle: Bundle = .main) -> String {
    let shortVersion = (bundle.infoDictionary?["CFBundleShortVersionString"] as? String)?
        .trimmingCharacters(in: .whitespacesAndNewlines)
    let buildNumber = (bundle.infoDictionary?["CFBundleVersion"] as? String)?
        .trimmingCharacters(in: .whitespacesAndNewlines)

    let normalizedShortVersion = shortVersion?.isEmpty == false ? shortVersion : nil
    let normalizedBuildNumber = buildNumber?.isEmpty == false ? buildNumber : nil

    switch (normalizedShortVersion, normalizedBuildNumber) {
    case let (version?, build?) where version.hasSuffix(".\(build)"):
        return version
    case let (version?, build?):
        return "\(version).\(build)"
    case let (version?, nil):
        return version
    case let (nil, build?):
        return build
    case (nil, nil):
        return "0.0.0"
    }
}
