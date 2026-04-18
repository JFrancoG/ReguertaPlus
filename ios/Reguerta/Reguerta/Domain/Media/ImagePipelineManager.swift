import Foundation

enum ImageUploadNamespace: String, Sendable {
    case products
    case news
    case sharedProfiles = "shared_profiles"
}

struct ImageUploadRequest: Sendable {
    let ownerId: String
    let namespace: ImageUploadNamespace
    let entityId: String?
    let nameHint: String?
}

struct ImageUploadResult: Sendable {
    let downloadURL: String
    let widthPx: Int
    let heightPx: Int
    let byteSize: Int
    let mimeType: String
}

enum ImagePipelineError: Error, Sendable {
    case invalidInput
    case processingFailed
    case uploadFailed
    case downloadURLMissing
}

protocol ImagePipelineManager: Sendable {
    func processAndUpload(
        imageData: Data,
        request: ImageUploadRequest
    ) async throws -> ImageUploadResult
}

struct NoOpImagePipelineManager: ImagePipelineManager {
    func processAndUpload(
        imageData: Data,
        request: ImageUploadRequest
    ) async throws -> ImageUploadResult {
        throw ImagePipelineError.uploadFailed
    }
}
