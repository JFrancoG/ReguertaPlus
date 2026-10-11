@MainActor
protocol CoverageRehearsalAccess {
    var repository: any ShiftCoverageRepository { get }
    func signIn(email: String, password: String) async throws -> ShiftCoverageSession
    func signOut()
}
