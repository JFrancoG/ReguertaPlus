//
//  ReguertaApp.swift
//  Reguerta
//
//  Created by Jesus Franco on 05.02.2026.
//

import Foundation
import SwiftUI

@main
struct ReguertaApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @AppStorage(AppAppearance.storageKey) private var appAppearanceRawValue = AppAppearance.system.rawValue

    private let appEnvironment: ReguertaAppEnvironment

    private var appAppearance: AppAppearance {
        AppAppearance(rawValue: appAppearanceRawValue) ?? .system
    }

    var body: some Scene {
        WindowGroup {
            ReguertaTheme {
                MainView()
                    .reguertaAppEnvironment(appEnvironment)
            }
            .preferredColorScheme(appAppearance.preferredColorScheme)
        }
    }
}

extension ReguertaApp {
    init() {
        let appConfiguration = ReguertaAppConfiguration(arguments: ProcessInfo.processInfo.arguments)
        let appEnvironment = ReguertaAppEnvironment.make(configuration: appConfiguration)
        self.appEnvironment = appEnvironment
        appDelegate.configure(
            appConfiguration: appConfiguration,
            authorizedDeviceRegistrar: appEnvironment.authorizedDeviceRegistrar
        )
    }
}
