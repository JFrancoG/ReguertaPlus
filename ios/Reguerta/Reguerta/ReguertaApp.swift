//
//  ReguertaApp.swift
//  Reguerta
//
//  Created by Jesús Franco on 05.02.2026.
//

import SwiftUI
import FirebaseCore

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
        return true
    }
}
