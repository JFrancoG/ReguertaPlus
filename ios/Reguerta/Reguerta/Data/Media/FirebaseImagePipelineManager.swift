import FirebaseStorage
import Foundation
import UIKit

final class FirebaseImagePipelineManager: @unchecked Sendable, ImagePipelineManager {
    private let storage: Storage
    private let jpegCompressionQuality: CGFloat

    init(
        storage: Storage = Storage.storage(),
        jpegCompressionQuality: CGFloat = 0.82
    ) {
        self.storage = storage
        self.jpegCompressionQuality = jpegCompressionQuality
    }

    func processAndUpload(
        imageData: Data,
        request: ImageUploadRequest
    ) async throws -> ImageUploadResult {
        guard let original = UIImage(data: imageData),
              let originalCgImage = original.cgImage else {
            throw ImagePipelineError.invalidInput
        }

        guard let scaledSize = ImagePipelineSizingContract.scaledDimensions(
            sourceWidth: originalCgImage.width,
            sourceHeight: originalCgImage.height,
            targetShortSidePx: outputSidePx
        ) else {
            throw ImagePipelineError.processingFailed
        }

        let resizedImage = resizeImage(
            original,
            targetSize: CGSize(width: scaledSize.width, height: scaledSize.height)
        )
        guard let resizedCgImage = resizedImage.cgImage else {
            throw ImagePipelineError.processingFailed
        }

        guard let cropSquare = ImagePipelineSizingContract.centerCropSquare(
            sourceWidth: resizedCgImage.width,
            sourceHeight: resizedCgImage.height,
            targetSidePx: outputSidePx
        ) else {
            throw ImagePipelineError.processingFailed
        }

        let cropRect = CGRect(
            x: cropSquare.left,
            y: cropSquare.top,
            width: cropSquare.size,
            height: cropSquare.size
        )
        guard let croppedCgImage = resizedCgImage.cropping(to: cropRect) else {
            throw ImagePipelineError.processingFailed
        }

        let finalImage = UIImage(cgImage: croppedCgImage)
        guard let outputData = finalImage.jpegData(compressionQuality: jpegCompressionQuality),
              !outputData.isEmpty else {
            throw ImagePipelineError.processingFailed
        }

        let reference = storage.reference(withPath: buildStoragePath(request: request))
        let metadata = StorageMetadata()
        metadata.contentType = mimeTypeJpeg

        try await uploadData(outputData, metadata: metadata, to: reference)
        let downloadURL = try await fetchDownloadURL(from: reference).absoluteString
        let normalizedURL = downloadURL.trimmingCharacters(in: .whitespacesAndNewlines)

        guard !normalizedURL.isEmpty else {
            throw ImagePipelineError.downloadURLMissing
        }

        return ImageUploadResult(
            downloadURL: normalizedURL,
            widthPx: outputSidePx,
            heightPx: outputSidePx,
            byteSize: outputData.count,
            mimeType: mimeTypeJpeg
        )
    }

    private func resizeImage(_ image: UIImage, targetSize: CGSize) -> UIImage {
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        let renderer = UIGraphicsImageRenderer(size: targetSize, format: format)
        return renderer.image { _ in
            image.draw(in: CGRect(origin: .zero, size: targetSize))
        }
    }

    private func buildStoragePath(request: ImageUploadRequest) -> String {
        let environment = ReguertaRuntimeEnvironment.currentFirestoreEnvironment.rawValue
        let ownerId = sanitizePathComponent(request.ownerId, fallback: "unknown-owner")
        let entityId = sanitizePathComponent(request.entityId, fallback: "new")
        let namePrefix = ImageUploadFileNameFormatter.formatPrefix(
            nameHint: request.nameHint,
            namespace: request.namespace
        )
        return "\(environment)/images/\(request.namespace.rawValue)/\(ownerId)/\(namePrefix)_\(entityId)_\(UUID().uuidString).jpg"
    }

    private func sanitizePathComponent(_ rawValue: String?, fallback: String) -> String {
        let trimmed = (rawValue ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "/", with: "_")
        return trimmed.isEmpty ? fallback : trimmed
    }

    private func uploadData(
        _ data: Data,
        metadata: StorageMetadata,
        to reference: StorageReference
    ) async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            reference.putData(data, metadata: metadata) { _, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                continuation.resume(returning: ())
            }
        }
    }

    private func fetchDownloadURL(from reference: StorageReference) async throws -> URL {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<URL, Error>) in
            reference.downloadURL { url, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                guard let url else {
                    continuation.resume(throwing: ImagePipelineError.downloadURLMissing)
                    return
                }
                continuation.resume(returning: url)
            }
        }
    }

    private let outputSidePx = 300
    private let mimeTypeJpeg = "image/jpeg"
}
