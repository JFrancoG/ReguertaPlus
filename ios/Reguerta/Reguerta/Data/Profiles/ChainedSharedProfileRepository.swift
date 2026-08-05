import Foundation

final class ChainedSharedProfileRepository<Primary: SharedProfileRepository, Fallback: SharedProfileRepository>:
    @unchecked Sendable, SharedProfileRepository {
    private let primary: Primary
    private let fallback: Fallback

    init(primary: Primary, fallback: Fallback) {
        self.primary = primary
        self.fallback = fallback
    }

    func allSharedProfiles() async throws -> [SharedProfile] {
        let primaryProfiles = try await primary.allSharedProfiles()
        return primaryProfiles.isEmpty ? try await fallback.allSharedProfiles() : primaryProfiles
    }

    func sharedProfile(userId: String) async throws -> SharedProfile? {
        if let profile = try await primary.sharedProfile(userId: userId) {
            return profile
        }
        return try await fallback.sharedProfile(userId: userId)
    }

    func upsert(profile: SharedProfile) async throws -> SharedProfile {
        try await primary.upsert(profile: profile)
    }

    func deleteSharedProfile(userId: String) async throws -> Bool {
        try await primary.deleteSharedProfile(userId: userId)
    }
}
