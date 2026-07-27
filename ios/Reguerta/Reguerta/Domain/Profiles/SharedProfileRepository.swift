import Foundation

protocol SharedProfileRepository: Sendable {
    func allSharedProfiles() async -> [SharedProfile]
    func sharedProfile(userId: String) async -> SharedProfile?
    func upsert(profile: SharedProfile) async throws -> SharedProfile
    func deleteSharedProfile(userId: String) async throws -> Bool
}
