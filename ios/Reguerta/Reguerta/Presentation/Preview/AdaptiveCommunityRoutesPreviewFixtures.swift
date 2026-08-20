#if DEBUG
import Foundation

let previewAdminID = "preview-admin"
let previewProducerID = "preview-producer"
let previewMemberID = "preview-member"
let previewReadNotificationID = "preview-notification-read"

func previewSession() -> AuthorizedSession {
    let admin = Member(
        id: previewAdminID,
        displayName: "Alejandra Administración Comunitaria",
        companyName: "Regüerta",
        phoneNumber: "+34 600 000 001",
        normalizedEmail: "admin@example.test",
        authUid: "preview-auth",
        roles: [.member, .admin],
        isActive: true,
        producerCatalogEnabled: true,
        isCommonPurchaseManager: true
    )
    let members = [admin, previewProducer(), previewMember()]
    return AuthorizedSession(
        principal: AuthPrincipal(uid: "preview-auth", email: admin.normalizedEmail),
        authenticatedMember: admin,
        member: admin,
        members: members,
        environment: .develop
    )
}

func previewProducer() -> Member {
    Member(
        id: previewProducerID,
        displayName: "María de los Ángeles Fernández",
        companyName: "Huerta comunitaria La Acequia",
        phoneNumber: "+34 600 000 002",
        normalizedEmail: "producer@example.test",
        authUid: "preview-producer-auth",
        roles: [.member, .producer],
        isActive: true,
        producerCatalogEnabled: true,
        producerParity: .even
    )
}

func previewMember() -> Member {
    Member(
        id: previewMemberID,
        displayName: "Familia Rodríguez de la Fuente",
        normalizedEmail: "member@example.test",
        authUid: "preview-member-auth",
        roles: [.member],
        isActive: true,
        producerCatalogEnabled: false
    )
}

func previewProducts() -> [Product] {
    [previewActiveProduct(), previewArchivedProduct()]
}

private func previewActiveProduct() -> Product {
    Product(
        id: "preview-product-active",
        vendorId: previewProducerID,
        companyName: "Huerta comunitaria La Acequia",
        name: "Cesta grande de verduras ecológicas de temporada",
        description: "Tomate, calabacín, berenjena y otras variedades según la cosecha semanal.",
        productImageUrl: nil,
        price: 18.50,
        pricingMode: .fixed,
        unitName: "cesta",
        unitAbbreviation: "ud",
        unitPlural: "cestas",
        unitQty: 1,
        packContainerName: nil,
        packContainerAbbreviation: nil,
        packContainerPlural: nil,
        packContainerQty: nil,
        isAvailable: true,
        stockMode: .finite,
        stockQty: 12,
        isEcoBasket: false,
        isCommonPurchase: false,
        commonPurchaseType: nil,
        archived: false,
        createdAtMillis: 1_735_603_200_000,
        updatedAtMillis: 1_735_689_600_000
    )
}

private func previewArchivedProduct() -> Product {
    Product(
        id: "preview-product-archived",
        vendorId: previewProducerID,
        companyName: "Huerta comunitaria La Acequia",
        name: "Conserva artesanal de tomate",
        description: "Producto archivado para validar la jerarquía y las acciones disponibles.",
        productImageUrl: nil,
        price: 5.75,
        pricingMode: .fixed,
        unitName: "tarro",
        unitAbbreviation: "ud",
        unitPlural: "tarros",
        unitQty: 1,
        packContainerName: nil,
        packContainerAbbreviation: nil,
        packContainerPlural: nil,
        packContainerQty: nil,
        isAvailable: false,
        stockMode: .infinite,
        stockQty: nil,
        isEcoBasket: false,
        isCommonPurchase: false,
        commonPurchaseType: nil,
        archived: true,
        createdAtMillis: 1_735_516_800_000,
        updatedAtMillis: 1_735_603_200_000
    )
}

func previewSharedProfiles() -> [SharedProfile] {
    [
        SharedProfile(
            userId: previewAdminID,
            familyNames: "Alejandra, Marcos y sus dos peques",
            photoUrl: nil,
            about: "Participamos en la organización y disfrutamos aprendiendo sobre cada cosecha.",
            updatedAtMillis: 1_735_689_600_000
        ),
        SharedProfile(
            userId: previewMemberID,
            familyNames: "Familia Rodríguez de la Fuente",
            photoUrl: nil,
            about: "Nos interesa la alimentación sostenible y compartir experiencias con el barrio.",
            updatedAtMillis: 1_735_603_200_000
        )
    ]
}

func previewNews() -> [NewsArticle] {
    [
        NewsArticle(
            id: "preview-news-active",
            title: "Cambios importantes en el calendario de entregas comunitarias",
            body: "Consulta los nuevos horarios, puntos de encuentro y recomendaciones de accesibilidad.",
            active: true,
            publishedBy: "Alejandra Administración Comunitaria",
            publishedAtMillis: 1_735_689_600_000,
            urlImage: nil
        ),
        NewsArticle(
            id: "preview-news-inactive",
            title: "Borrador archivado para la próxima asamblea",
            body: "Este contenido permite comprobar las acciones de edición y eliminación para administradores.",
            active: false,
            publishedBy: "Alejandra Administración Comunitaria",
            publishedAtMillis: 1_735_603_200_000,
            urlImage: nil
        )
    ]
}

func previewNotifications() -> [NotificationEvent] {
    [
        NotificationEvent(
            id: previewReadNotificationID,
            title: "Pedido preparado para recoger",
            body: "Tu pedido estará disponible en el punto habitual durante el nuevo horario de entrega.",
            type: "order_reminder",
            target: "all",
            userIds: [],
            segmentType: nil,
            targetRole: nil,
            createdBy: previewAdminID,
            sentAtMillis: 1_735_689_600_000,
            weekKey: "2025-W01"
        ),
        NotificationEvent(
            id: "preview-notification-unread",
            title: "Convocatoria de asamblea extraordinaria",
            body: "Revisaremos el calendario, los turnos y las propuestas de mejora del espacio común.",
            type: "admin_broadcast",
            target: "all",
            userIds: [],
            segmentType: nil,
            targetRole: nil,
            createdBy: previewAdminID,
            sentAtMillis: 1_735_603_200_000,
            weekKey: nil
        )
    ]
}
#endif
