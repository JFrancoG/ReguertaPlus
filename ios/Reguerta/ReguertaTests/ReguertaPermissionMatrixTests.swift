import Foundation
import Testing

@testable import Reguerta

@MainActor
struct ReguertaPermissionMatrixTests {
    @Test
    func canonicalMatrixCapabilitiesMatchIOSPermissionMatrix() throws {
        let matrix = try loadCanonicalMatrix()

        for role in CanonicalAccessRole.allCases {
            let expected = Set(
                matrix[role.rawValue, default: []]
                    .compactMap(AccessCapability.init(rawValue:))
            )
            #expect(MemberPermissionMatrix.capabilities(for: role) == expected)
        }
    }

    @Test
    func commonPurchaseManagerOverrideGrantsCatalogManagement() {
        let member = Member(
            id: "member_common_purchase_001",
            displayName: "Compra común",
            normalizedEmail: "compras@reguerta.app",
            authUid: nil,
            roles: [.member],
            isActive: true,
            producerCatalogEnabled: true,
            isCommonPurchaseManager: true
        )

        #expect(member.canManageProductCatalog)
    }

    @Test
    func inMemoryFixturesStayAlignedWithCanonicalMatrix() async {
        let repository = InMemoryMemberRepository()
        let membersById = Dictionary(
            uniqueKeysWithValues: await repository.allMembers().map { ($0.id, $0) }
        )

        if let admin = membersById["member_admin_001"] {
            #expect(admin.canManageMembers)
            #expect(admin.canGrantAdminRole)
            #expect(admin.canPublishNews)
            #expect(admin.canSendAdminNotifications)
        } else {
            Issue.record("Missing seeded admin fixture")
        }

        if let producer = membersById["member_producer_001"] {
            #expect(producer.canManageProductCatalog)
            #expect(producer.canAccessReceivedOrders)
        } else {
            Issue.record("Missing seeded producer fixture")
        }

        if let member = membersById["member_member_001"] {
            #expect(member.canAccessCommonHomeModules)
            #expect(member.canManageMembers == false)
            #expect(member.canAccessReceivedOrders == false)
        } else {
            Issue.record("Missing seeded member fixture")
        }
    }

    private func loadCanonicalMatrix() throws -> [String: Set<String>] {
        let matrixURL = try findCanonicalMatrixURL()
        let data = try Data(contentsOf: matrixURL)
        guard let root = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let roles = root["roles"] as? [String: [String: Any]] else {
            throw MatrixLoadError.invalidPayload
        }

        func resolveCapabilities(
            roleName: String,
            visiting: inout Set<String>
        ) throws -> Set<String> {
            guard let role = roles[roleName] else { return [] }
            if visiting.contains(roleName) {
                throw MatrixLoadError.inheritanceCycle(roleName)
            }
            visiting.insert(roleName)
            defer { visiting.remove(roleName) }

            let direct = Set(stringArray(role["capabilities"]))
            let inherited = stringArray(role["inherits"])
            let inheritedCapabilities = try inherited.reduce(into: Set<String>()) { partialResult, inheritedRole in
                partialResult.formUnion(try resolveCapabilities(roleName: inheritedRole, visiting: &visiting))
            }
            return direct.union(inheritedCapabilities)
        }

        return try roles.keys.reduce(into: [String: Set<String>]()) { partialResult, roleName in
            var visiting = Set<String>()
            partialResult[roleName] = try resolveCapabilities(roleName: roleName, visiting: &visiting)
        }
    }

    private func findCanonicalMatrixURL() throws -> URL {
        var cursor = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
        let fileManager = FileManager.default
        while true {
            let candidate = cursor.appendingPathComponent(Self.matrixRelativePath)
            if fileManager.fileExists(atPath: candidate.path) {
                return candidate
            }
            let parent = cursor.deletingLastPathComponent()
            if parent.path == cursor.path {
                break
            }
            cursor = parent
        }
        throw MatrixLoadError.fileNotFound
    }

    private func stringArray(_ value: Any?) -> [String] {
        (value as? [String])?
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty } ?? []
    }

    private enum MatrixLoadError: Error {
        case fileNotFound
        case invalidPayload
        case inheritanceCycle(String)
    }

    private static let matrixRelativePath =
        "spec/app/hu-044-canonical-role-permission-matrix-and-test-fixtures/role-permission-matrix.v1.json"
}
