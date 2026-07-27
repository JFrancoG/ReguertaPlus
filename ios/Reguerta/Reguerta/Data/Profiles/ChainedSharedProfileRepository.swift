import Foundation

final class ChainedSharedProfileRepository: @unchecked Sendable, SharedProfileRepository {
    private let primary: any SharedProfileRepository
    private let fallback: any SharedProfileRepository

    init(
        primary: any SharedProfileRepository,
        fallback: any SharedProfileRepository
    ) {
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
