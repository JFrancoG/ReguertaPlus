import Foundation

struct RegisteredDevice: Equatable, Sendable {
    let deviceId: String
    let platform: String
    let appVersion: String
    let osVersion: String
    let apiLevel: Int?
    let manufacturer: String?
    let model: String?
    let fcmToken: String?
    let firstSeenAtMillis: Int64
    let lastSeenAtMillis: Int64
    let tokenUpdatedAtMillis: Int64?
}
