struct MyOrderLocalStateScope: Equatable, Hashable {
    let memberId: String?
    let weekKey: String
    let environment: SessionEnvironment

    /// The environment-qualified identity shared by draft and confirmation persistence.
    ///
    /// The environment is part of the identity so a routed member cannot observe local state
    /// created for the same member and week against another backend.
    var storageKey: String {
        myOrderLocalStateStorageKey(memberId: memberId, weekKey: weekKey, environment: environment)
    }

    func hash(into hasher: inout Hasher) {
        hasher.combine(memberId)
        hasher.combine(weekKey)
        hasher.combine(environment.rawValue)
    }
}

/// Builds the environment-qualified identity used by local draft and confirmation snapshots.
///
/// Legacy keys omitted the environment and are intentionally not read through this constructor because their backend
/// ownership cannot be determined safely. This compatibility wrapper remains available to existing Orders callers while
/// new consumers can carry `MyOrderLocalStateScope` instead of reconstructing the identity.
func myOrderLocalStateStorageKey(memberId: String?, weekKey: String, environment: SessionEnvironment) -> String {
    "environment_\(environment.rawValue)_member_\(memberId ?? "")_week_\(weekKey)"
}
