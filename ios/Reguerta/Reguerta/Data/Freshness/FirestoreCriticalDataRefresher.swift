import FirebaseFirestore
import Foundation

struct FirestoreCriticalDataRefresher: CriticalDataRefreshing {
    private let db: Firestore

    init(db: Firestore) {
        self.db = db
    }

    func refresh(
        collections: Set<CriticalCollection>,
        scope: CriticalDataRefreshScope
    ) async throws -> CriticalDataRefreshPayload {
        try Task.checkCancellation()
        let authenticatedMember = try await refreshMember(
            id: scope.authenticatedMemberID,
            scope: scope,
            resource: "criticalData.users.authenticatedMember"
        )
        try Task.checkCancellation()
        guard authenticatedMember.authUid == scope.principalUID else {
            throw RepositoryError.permissionDenied(
                resource: "criticalData.users.authenticatedMemberLink"
            )
        }
        guard authenticatedMember.canManageMembers == scope.canManageMembers else {
            return CriticalDataRefreshPayload(
                authenticatedMember: authenticatedMember,
                selectedMember: scope.authenticatedMemberID == scope.memberID
                    ? authenticatedMember
                    : nil
            )
        }
        let selectedMember = if scope.authenticatedMemberID == scope.memberID {
            authenticatedMember
        } else {
            try await refreshMember(
                id: scope.memberID,
                scope: scope,
                resource: "criticalData.users.selectedMember"
            )
        }
        try Task.checkCancellation()

        async let materializedState = refreshMaterializedState(
            collections: collections,
            scope: scope,
            authenticatedMember: authenticatedMember,
            selectedMember: selectedMember
        )
        async let cacheRefresh: Void = refreshCacheOnlyCollections(
            collections: collections,
            scope: scope
        )
        let (resolvedState, _) = try await (materializedState, cacheRefresh)
        try Task.checkCancellation()
        return CriticalDataRefreshPayload(
            authenticatedMember: authenticatedMember,
            selectedMember: selectedMember,
            members: resolvedState.members,
            products: resolvedState.products,
            seasonalCommitments: resolvedState.commitments
        )
    }

    private func refreshMaterializedState(
        collections: Set<CriticalCollection>,
        scope: CriticalDataRefreshScope,
        authenticatedMember: Member,
        selectedMember: Member
    ) async throws -> MaterializedCriticalDataState {
        async let members = collections.contains(.users)
            ? refreshMembers(
                scope: scope,
                authenticatedMember: authenticatedMember,
                selectedMember: selectedMember
            )
            : nil
        async let products = collections.contains(.products)
            ? refreshProducts(scope: scope)
            : nil
        async let commitments = refreshSeasonalCommitments(
            selectedMember: selectedMember,
            scope: scope
        )
        return try await MaterializedCriticalDataState(
            members: members,
            products: products,
            commitments: commitments
        )
    }

    private func refreshCacheOnlyCollections(
        collections: Set<CriticalCollection>,
        scope: CriticalDataRefreshScope
    ) async throws {
        async let orders: Void = collections.contains(.orders)
            ? refreshOwnedCollection(
                plusCollection: .orders,
                legacyCollectionName: "orders",
                scope: scope,
                resource: "criticalData.orders"
            )
            : ()
        async let orderlines: Void = collections.contains(.orderlines)
            ? refreshOwnedCollection(
                plusCollection: .orderlines,
                legacyCollectionName: "orderLines",
                scope: scope,
                resource: "criticalData.orderlines"
            )
            : ()
        async let containers: Void = collections.contains(.containers)
            ? refreshLegacyCollection(
                named: "containers",
                scope: scope,
                resource: "criticalData.containers"
            )
            : ()
        async let measures: Void = collections.contains(.measures)
            ? refreshLegacyCollection(
                named: "measures",
                scope: scope,
                resource: "criticalData.measures"
            )
            : ()
        _ = try await (orders, orderlines, containers, measures)
    }
}

private extension FirestoreCriticalDataRefresher {
    private func refreshMember(id: String, scope: CriticalDataRefreshScope, resource: String) async throws -> Member {
        let users = db.reguertaCollection(.users, environment: scope.environment)
        do {
            let snapshot = try await users.document(id)
                .getDocument(source: .server)
            guard snapshot.exists, let data = snapshot.data() else {
                throw RepositoryError.notFound(resource: resource)
            }
            let member = try FirestoreMemberRepository.member(
                documentID: snapshot.documentID,
                data: data
            )
            guard member.isActive else {
                throw RepositoryError.permissionDenied(resource: resource)
            }
            return member
        } catch {
            throw FirestoreRepositoryErrorMapper.map(error, resource: resource)
        }
    }

    private func refreshMembers(
        scope: CriticalDataRefreshScope,
        authenticatedMember: Member,
        selectedMember: Member
    ) async throws -> [Member] {
        let visibleMembersQuery: Query = if scope.canManageMembers {
            db.reguertaCollection(.users, environment: scope.environment)
        } else {
            db.reguertaCollection(.memberDirectory, environment: scope.environment)
                .whereField("isActive", isEqualTo: true)
        }

        do {
            let visibleSnapshot = try await visibleMembersQuery.getDocuments(source: .server)
            let visibleMembers: [Member]

            if scope.canManageMembers {
                visibleMembers = try visibleSnapshot.documents.map { document in
                    try FirestoreMemberRepository.member(
                        documentID: document.documentID,
                        data: document.data()
                    )
                }
            } else {
                visibleMembers = try visibleSnapshot.documents.map { document in
                    try FirestoreMemberRepository.directoryMember(
                        documentID: document.documentID,
                        data: document.data()
                    )
                }
            }
            return (
                visibleMembers.filter {
                    $0.id != authenticatedMember.id && $0.id != selectedMember.id
                } + [authenticatedMember, selectedMember]
            )
                .reduce(into: [String: Member]()) { result, member in
                    result[member.id] = member
                }
                .values
                .sorted { lhs, rhs in
                    lhs.displayName.localizedCaseInsensitiveCompare(rhs.displayName) == .orderedAscending
                }
        } catch {
            throw FirestoreRepositoryErrorMapper.map(error, resource: "criticalData.users")
        }
    }

    private func refreshProducts(scope: CriticalDataRefreshScope) async throws -> [Product] {
        do {
            let snapshot = try await db
                .reguertaCollection(.products, environment: scope.environment)
                .getDocuments(source: .server)
            return try snapshot.documents.map { document in
                try FirestoreProductRepository.product(
                    documentID: document.documentID,
                    data: document.data()
                )
            }
        } catch {
            throw FirestoreRepositoryErrorMapper.map(error, resource: "criticalData.products")
        }
    }

    private func refreshSeasonalCommitments(
        selectedMember: Member,
        scope: CriticalDataRefreshScope
    ) async throws -> [SeasonalCommitment] {
        let repository = FirestoreSeasonalCommitmentRepository(
            db: db,
            environment: scope.environment
        )
        let commitmentsByLookup = try await withThrowingTaskGroup(
            of: [SeasonalCommitment].self
        ) { group in
            for lookupKey in selectedMember.seasonalCommitmentLookupKeys {
                group.addTask {
                    try await repository.activeCommitmentsFromServer(userId: lookupKey)
                }
            }
            var collected: [SeasonalCommitment] = []
            for try await commitments in group {
                collected.append(contentsOf: commitments)
            }
            return collected
        }
        return Dictionary(
            commitmentsByLookup.map { ($0.id, $0) },
            uniquingKeysWith: { _, latest in latest }
        ).values.sorted { lhs, rhs in
            if lhs.seasonKey.localizedCaseInsensitiveCompare(rhs.seasonKey) != .orderedSame {
                return lhs.seasonKey.localizedCaseInsensitiveCompare(rhs.seasonKey) == .orderedAscending
            }
            return lhs.productId.localizedCaseInsensitiveCompare(rhs.productId) == .orderedAscending
        }
    }

    private func refreshOwnedCollection(
        plusCollection: ReguertaFirestoreCollection,
        legacyCollectionName: String,
        scope: CriticalDataRefreshScope,
        resource: String
    ) async throws {
        let plusPath = ReguertaFirestorePath(environment: scope.environment)
            .collectionPath(plusCollection)
        let legacyPath = legacyCollectionPath(
            named: legacyCollectionName,
            environment: scope.environment
        )

        do {
            async let plusUserID: Void = refreshOwnedQuery(
                path: plusPath,
                ownerField: "userId",
                memberID: scope.memberID
            )
            async let plusMemberID: Void = refreshOwnedQuery(
                path: plusPath,
                ownerField: "memberId",
                memberID: scope.memberID
            )
            async let legacyUserID: Void = refreshOwnedQuery(
                path: legacyPath,
                ownerField: "userId",
                memberID: scope.memberID
            )
            async let legacyMemberID: Void = refreshOwnedQuery(
                path: legacyPath,
                ownerField: "memberId",
                memberID: scope.memberID
            )
            _ = try await (plusUserID, plusMemberID, legacyUserID, legacyMemberID)
        } catch {
            throw FirestoreRepositoryErrorMapper.map(error, resource: resource)
        }
    }

    private func refreshOwnedQuery(path: String, ownerField: String, memberID: String) async throws {
        _ = try await db.collection(path)
            .whereField(ownerField, isEqualTo: memberID)
            .getDocuments(source: .server)
    }

    private func refreshLegacyCollection(
        named collectionName: String,
        scope: CriticalDataRefreshScope,
        resource: String
    ) async throws {
        do {
            _ = try await db.collection(
                legacyCollectionPath(named: collectionName, environment: scope.environment)
            ).getDocuments(source: .server)
        } catch {
            throw FirestoreRepositoryErrorMapper.map(error, resource: resource)
        }
    }

    private func legacyCollectionPath(named collectionName: String, environment: SessionEnvironment) -> String {
        "\(environment.rawValue)/collections/\(collectionName)"
    }
}

private nonisolated struct MaterializedCriticalDataState: Sendable {
    let members: [Member]?
    let products: [Product]?
    let commitments: [SeasonalCommitment]
}
