import Foundation

protocol DeviceRegistrationRepository: Sendable {
    func register(memberId: String, device: RegisteredDevice) async -> RegisteredDevice
}
