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

    private let appEnvironment = ReguertaAppEnvironment.live()

    var body: some Scene {
        WindowGroup {
            ReguertaTheme {
                ContentView()
                    .environment(\.reguertaAppEnvironment, appEnvironment)
            }
        }
    }
}
