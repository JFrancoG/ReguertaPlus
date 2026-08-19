import Foundation
import Testing

@testable import Reguerta

@MainActor
struct FirestoreMemberRepositoryContractTests {
    @Test func memberDirectoryContractRequiresCanonicalPublicFieldsAndIdentity() throws {
        let validDirectory = validDirectoryData()
        let member = try FirestoreMemberRepository.directoryMember(documentID: "member_1", data: validDirectory)

        #expect(member.displayName == "Member One")
        #expect(member.normalizedEmail.isEmpty)
        #expect(member.authUid == nil)
        #expect(member.roles == [.member, .producer])
        #expect(member.ecoCommitmentMode == .biweekly)

        var mismatchedIdentity = validDirectory
        mismatchedIdentity["userId"] = "member_2"
        #expect(throws: RepositoryError.invalidData(resource: "members.directory.document")) {
            try FirestoreMemberRepository.directoryMember(documentID: "member_1", data: mismatchedIdentity)
        }

        var unknownRole = validDirectory
        unknownRole["roles"] = ["member", "observer"]
        #expect(throws: RepositoryError.invalidData(resource: "members.directory.document")) {
            try FirestoreMemberRepository.directoryMember(documentID: "member_1", data: unknownRole)
        }

        var invalidCommitment = validDirectory
        invalidCommitment["ecoCommitment"] = "weekly"
        #expect(throws: RepositoryError.invalidData(resource: "members.directory.document")) {
            try FirestoreMemberRepository.directoryMember(documentID: "member_1", data: invalidCommitment)
        }
    }

    @Test func fullMemberContractKeepsLegacyAliasesButRejectsConflictingTypes() throws {
        let legacyMember = legacyMemberData()

        try assertLegacyAliasesDecode(from: legacyMember)
        try assertBlankLegacyCommitmentValuesDecode(from: legacyMember)
        try assertConflictingCanonicalTypeIsRejected(from: legacyMember)
        try assertLegacyDirectoryAliasesAreRejected()
    }

    private func assertLegacyAliasesDecode(from legacyMember: [String: Any]) throws {
        let member = try FirestoreMemberRepository.member(documentID: "member_1", data: legacyMember)

        #expect(member.displayName == "Ana Reguerta")
        #expect(member.normalizedEmail == "ana@example.com")
        #expect(member.roles == [.member, .producer])
        #expect(member.producerParity == .even)
        #expect(member.ecoCommitmentMode == .biweekly)
        #expect(member.ecoCommitmentParity == .odd)
    }

    private func assertBlankLegacyCommitmentValuesDecode(from legacyMember: [String: Any]) throws {
        var blankLegacyParity = legacyMember
        blankLegacyParity["ecoCommitment"] = ["mode": "weekly", "parity": "  "]
        let memberWithoutParity = try FirestoreMemberRepository.member(documentID: "member_1", data: blankLegacyParity)
        #expect(memberWithoutParity.ecoCommitmentParity == nil)

        var blankLegacyMode = legacyMember
        blankLegacyMode["ecoCommitment"] = ["mode": "  ", "parity": ""]
        let memberWithDefaultMode = try FirestoreMemberRepository.member(documentID: "member_1", data: blankLegacyMode)
        #expect(memberWithDefaultMode.ecoCommitmentMode == .weekly)
        #expect(memberWithDefaultMode.ecoCommitmentParity == nil)
    }

    private func assertConflictingCanonicalTypeIsRejected(from legacyMember: [String: Any]) throws {
        var conflictingCanonicalType = legacyMember
        conflictingCanonicalType["normalizedEmail"] = 123
        #expect(throws: RepositoryError.invalidData(resource: "members.document")) {
            try FirestoreMemberRepository.member(documentID: "member_1", data: conflictingCanonicalType)
        }
    }

    private func assertLegacyDirectoryAliasesAreRejected() throws {
        let legacyParityInDirectory = legacyDirectoryData()
        #expect(throws: RepositoryError.invalidData(resource: "members.directory.document")) {
            try FirestoreMemberRepository.directoryMember(documentID: "member_1", data: legacyParityInDirectory)
        }

        var blankParityInDirectory = legacyParityInDirectory
        blankParityInDirectory["producerParity"] = "odd"
        blankParityInDirectory["ecoCommitment"] = ["mode": "weekly", "parity": ""]
        #expect(throws: RepositoryError.invalidData(resource: "members.directory.document")) {
            try FirestoreMemberRepository.directoryMember(documentID: "member_1", data: blankParityInDirectory)
        }

        var blankModeInDirectory = legacyParityInDirectory
        blankModeInDirectory["producerParity"] = "odd"
        blankModeInDirectory["ecoCommitment"] = ["mode": "", "parity": "even"]
        #expect(throws: RepositoryError.invalidData(resource: "members.directory.document")) {
            try FirestoreMemberRepository.directoryMember(documentID: "member_1", data: blankModeInDirectory)
        }
    }

    private func validDirectoryData() -> [String: Any] {
        [
            "userId": "member_1",
            "displayName": " Member One ",
            "companyName": NSNull(),
            "roles": ["member", "producer"],
            "isActive": true,
            "producerCatalogEnabled": true,
            "isCommonPurchaseManager": false,
            "producerParity": "odd",
            "ecoCommitment": ["mode": "biweekly", "parity": "even"],
            "normalizedEmail": 123,
            "authUid": ["ignored"]
        ]
    }

    private func legacyMemberData() -> [String: Any] {
        [
            "name": "Ana",
            "surname": "Reguerta",
            "email": " ANA@EXAMPLE.COM ",
            "isProducer": true,
            "producerParity": "par",
            "ecoCommitment": ["mode": "biweekly", "parity": "impar"]
        ]
    }

    private func legacyDirectoryData() -> [String: Any] {
        [
            "userId": "member_1",
            "displayName": "Member One",
            "companyName": NSNull(),
            "roles": ["member", "producer"],
            "isActive": true,
            "producerCatalogEnabled": true,
            "isCommonPurchaseManager": false,
            "producerParity": "par",
            "ecoCommitment": ["mode": "biweekly", "parity": "even"]
        ]
    }
}
