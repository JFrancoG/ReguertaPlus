import Foundation

actor InMemorySharedProfileRepository: SharedProfileRepository {
    private var profiles: [String: SharedProfile] = [
        "member_admin_001": SharedProfile(
            userId: "member_admin_001",
            familyNames: "Ana, Mario y Leo",
            photoUrl: nil,
            about: "Nos encanta la verdura de temporada y venir a recoger los pedidos en familia.",
            updatedAtMillis: 1_742_800_000_000
        ),
        "member_member_001": SharedProfile(
            userId: "member_member_001",
            familyNames: "Marta y Alba",
            photoUrl: nil,
            about: "Somos nuevas en la comunidad y nos apuntamos para aprender a comer mejor.",
            updatedAtMillis: 1_742_860_000_000
        ),
    ]

    func allSharedProfiles() async -> [SharedProfile] {
        profiles.values.sorted { $0.updatedAtMillis > $1.updatedAtMillis }
    }

    func sharedProfile(userId: String) async -> SharedProfile? {
        profiles[userId]
    }

    func upsert(profile: SharedProfile) async -> SharedProfile {
        profiles[profile.userId] = profile
        return profile
    }

    func deleteSharedProfile(userId: String) async -> Bool {
        profiles.removeValue(forKey: userId) != nil
    }
}
