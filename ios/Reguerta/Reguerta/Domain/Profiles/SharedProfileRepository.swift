import Foundation

protocol SharedProfileRepository: Sendable {
    func allSharedProfiles(environment: SessionEnvironment) async throws -> [SharedProfile]
    func sharedProfile(userId: String, environment: SessionEnvironment) async throws -> SharedProfile?
    func upsert(profile: SharedProfile, environment: SessionEnvironment) async throws -> SharedProfile
    func deleteSharedProfile(userId: String, environment: SessionEnvironment) async throws -> Bool
}
