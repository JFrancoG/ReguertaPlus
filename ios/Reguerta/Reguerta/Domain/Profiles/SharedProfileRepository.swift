import Foundation

protocol SharedProfileRepository: Sendable {
    func allSharedProfiles() async -> [SharedProfile]
    func sharedProfile(userId: String) async -> SharedProfile?
    func upsert(profile: SharedProfile) async -> SharedProfile
    func deleteSharedProfile(userId: String) async -> Bool
}
