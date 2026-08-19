import Foundation

enum ImageUploadNamespace: String, Sendable {
    case products
    case news
    case sharedProfiles = "shared_profiles"
}

struct ImageUploadRequest {
    let environment: SessionEnvironment
    let ownerId: String
    let namespace: ImageUploadNamespace
    let entityId: String?
    let nameHint: String?
}

struct ImageUploadResult {
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
    /// Processes an image and uploads it under the immutable routing context carried by `request`.
    ///
    /// Implementations must derive the complete remote path from that request before suspending and
    /// must not consult ambient session state later. Cancellation prevents a late URL from being
    /// returned, but it does not guarantee deletion when the remote upload has already completed.
    ///
    /// - Parameters:
    ///   - imageData: Source image bytes to validate, resize, crop, and encode.
    ///   - request: Immutable owner, namespace, entity, and environment for the remote object.
    /// - Returns: Metadata for the uploaded object and its download URL.
    /// - Throws: `CancellationError` when cancelled, or an `ImagePipelineError` for processing or
    ///   upload failures.
    func processAndUpload(imageData: Data, request: ImageUploadRequest) async throws -> ImageUploadResult
}

struct NoOpImagePipelineManager: ImagePipelineManager {
    func processAndUpload(imageData: Data, request: ImageUploadRequest) async throws -> ImageUploadResult {
        throw ImagePipelineError.uploadFailed
    }
}
