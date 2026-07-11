//
//  ReguertaApp.swift
//  Reguerta
//
//  Created by Jesus Franco on 05.02.2026.
//

import SwiftUI

@main
struct ReguertaApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @AppStorage(AppAppearance.storageKey) private var appAppearanceRawValue = AppAppearance.system.rawValue

    private let appEnvironment = ReguertaAppEnvironment.live()

    private var appAppearance: AppAppearance {
        AppAppearance(rawValue: appAppearanceRawValue) ?? .system
    }

    var body: some Scene {
        WindowGroup {
            ReguertaTheme {
                MainView()
                    .environment(\.reguertaAppEnvironment, appEnvironment)
            }
            .preferredColorScheme(appAppearance.preferredColorScheme)
        }
    }
}
