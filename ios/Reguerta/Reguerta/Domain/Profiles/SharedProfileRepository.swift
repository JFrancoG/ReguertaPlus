import Foundation

protocol SharedProfileRepository: Sendable {
    func allSharedProfiles() async throws -> [SharedProfile]
    func sharedProfile(userId: String) async throws -> SharedProfile?
    func upsert(profile: SharedProfile) async throws -> SharedProfile
    func deleteSharedProfile(userId: String) async throws -> Bool
}
