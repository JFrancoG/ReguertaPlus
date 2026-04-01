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

    func allSharedProfiles() async -> [SharedProfile] {
        let primaryProfiles = await primary.allSharedProfiles()
        return primaryProfiles.isEmpty ? await fallback.allSharedProfiles() : primaryProfiles
    }

    func sharedProfile(userId: String) async -> SharedProfile? {
        if let profile = await primary.sharedProfile(userId: userId) {
            return profile
        }
        return await fallback.sharedProfile(userId: userId)
    }

    func upsert(profile: SharedProfile) async -> SharedProfile {
        await primary.upsert(profile: profile)
    }

    func deleteSharedProfile(userId: String) async -> Bool {
        await primary.deleteSharedProfile(userId: userId)
    }
}
