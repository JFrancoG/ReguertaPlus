/// Builds the environment-qualified identity used by local draft and confirmation snapshots.
///
/// Legacy keys omitted the environment and are intentionally not read through this constructor because their backend
/// ownership cannot be determined safely.
func myOrderLocalStateStorageKey(memberId: String?, weekKey: String, environment: SessionEnvironment) -> String {
    "environment_\(environment.rawValue)_member_\(memberId ?? "")_week_\(weekKey)"
}
