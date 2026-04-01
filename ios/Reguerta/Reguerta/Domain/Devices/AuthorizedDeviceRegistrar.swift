import Foundation

protocol AuthorizedDeviceRegistrar: Sendable {
    func register(member: Member) async
}
