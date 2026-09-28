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

    #if DEBUG
    private let coverageRehearsal: CoverageRehearsalViewModel?
    private let coverageAccessibilityRehearsal: Bool
    #endif

    private let appEnvironment: ReguertaAppEnvironment

    private var appAppearance: AppAppearance {
        AppAppearance(rawValue: appAppearanceRawValue) ?? .system
    }

    var body: some Scene {
        WindowGroup {
            ReguertaTheme {
                #if DEBUG
                if let coverageRehearsal {
                    CoverageRehearsalView(
                        model: coverageRehearsal,
                        rehearsalNote: CoverageCopy.text(coverageAccessibilityRehearsal ? "offline_note" : "local_note")
                    )
                        .task {
                            if coverageAccessibilityRehearsal {
                                await coverageRehearsal.coverage.refresh()
                            }
                        }
                        .onChange(of: appEnvironment.shiftNotificationPushOpenStore.pendingReference, initial: true) {
                            guard let reference = appEnvironment.shiftNotificationPushOpenStore.pendingReference else {
                                return
                            }
                            coverageRehearsal.acceptPush(reference)
                            appEnvironment.shiftNotificationPushOpenStore.consume(reference)
                        }
                } else {
                    MainView().reguertaAppEnvironment(appEnvironment)
                }
                #else
                MainView().reguertaAppEnvironment(appEnvironment)
                #endif
            }
            .preferredColorScheme(appAppearance.preferredColorScheme)
        }
    }
}

extension ReguertaApp {
    init() {
        let arguments = ProcessInfo.processInfo.arguments
        #if DEBUG
        coverageAccessibilityRehearsal = arguments.contains("-coverageAccessibilityRehearsal")
        #if targetEnvironment(simulator)
        // An explicit simulator preference preserves the isolated route when an OS tap launches without arguments.
        let resumesCoverageRehearsal = UserDefaults.standard.bool(forKey: "coverageColdLaunchRehearsal")
        #else
        let resumesCoverageRehearsal = false
        #endif
        let rehearsesCoverage = arguments.contains("-coverageRehearsal") || resumesCoverageRehearsal
        if coverageAccessibilityRehearsal {
            coverageRehearsal = CoveragePreviewAccess.model()
        } else if rehearsesCoverage {
            do {
                coverageRehearsal = CoverageRehearsalViewModel(access: try LocalCoverageRehearsalAccess())
            } catch {
                preconditionFailure("Invalid fixed local coverage configuration")
            }
        } else {
            coverageRehearsal = nil
        }
        let usesRehearsal = rehearsesCoverage || coverageAccessibilityRehearsal
        let appConfiguration = usesRehearsal ? .uiTesting : ReguertaAppConfiguration(arguments: arguments)
        #else
        let appConfiguration = ReguertaAppConfiguration(arguments: arguments)
        #endif
        let appEnvironment = ReguertaAppEnvironment.make(configuration: appConfiguration)
        self.appEnvironment = appEnvironment
        #if DEBUG
        let requestsLocalPush = arguments.contains("-coveragePushRehearsal") || resumesCoverageRehearsal
        if rehearsesCoverage && requestsLocalPush && !coverageAccessibilityRehearsal {
            appDelegate.enableLocalCoveragePush()
        }
        #endif
        appDelegate.configure(
            appConfiguration: appConfiguration,
            authorizedDeviceRegistrar: appEnvironment.authorizedDeviceRegistrar,
            shiftNotificationPushOpenStore: appEnvironment.shiftNotificationPushOpenStore
        )
    }
}
