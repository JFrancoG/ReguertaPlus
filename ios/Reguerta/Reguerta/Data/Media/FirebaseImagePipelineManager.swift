import FirebaseCore
import FirebaseStorage
import Foundation
import UIKit

protocol ImageStorageUploading: Sendable {
    func upload(data: Data, path: String, contentType: String) async throws -> URL
}

final class FirebaseImagePipelineManager: Sendable, ImagePipelineManager {
    private let storageUploader: any ImageStorageUploading
    private let jpegCompressionQuality: CGFloat

    init(firebaseAppName: String, jpegCompressionQuality: CGFloat = 0.82) {
        self.storageUploader = FirebaseImageStorageUploader(firebaseAppName: firebaseAppName)
        self.jpegCompressionQuality = jpegCompressionQuality
    }

    init(storageUploader: any ImageStorageUploading, jpegCompressionQuality: CGFloat = 0.82) {
        self.storageUploader = storageUploader
        self.jpegCompressionQuality = jpegCompressionQuality
    }

    func processAndUpload(imageData: Data, request: ImageUploadRequest) async throws -> ImageUploadResult {
        let outputData = try processedJPEGData(from: imageData)
        try Task.checkCancellation()
        let downloadURL: String
        do {
            downloadURL = try await storageUploader.upload(
                data: outputData,
                path: buildStoragePath(request: request),
                contentType: mimeTypeJpeg
            ).absoluteString
        } catch is CancellationError {
            throw CancellationError()
        } catch let error as ImagePipelineError {
            throw error
        } catch {
            throw ImagePipelineError.uploadFailed
        }
        try Task.checkCancellation()
        let normalizedURL = downloadURL.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalizedURL.isEmpty else { throw ImagePipelineError.downloadURLMissing }
        return ImageUploadResult(
            downloadURL: normalizedURL,
            widthPx: outputSidePx,
            heightPx: outputSidePx,
            byteSize: outputData.count,
            mimeType: mimeTypeJpeg
        )
    }

    private func processedJPEGData(from imageData: Data) throws -> Data {
        guard let original = UIImage(data: imageData), let originalCgImage = original.cgImage else {
            throw ImagePipelineError.invalidInput
        }
        guard let scaledSize = ImagePipelineSizingContract.scaledDimensions(
            sourceWidth: originalCgImage.width,
            sourceHeight: originalCgImage.height,
            targetShortSidePx: outputSidePx
        ) else {
            throw ImagePipelineError.processingFailed
        }
        let resizedImage = resizeImage(original, targetSize: CGSize(width: scaledSize.width, height: scaledSize.height))
        guard let resizedCgImage = resizedImage.cgImage else { throw ImagePipelineError.processingFailed }
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
        return outputData
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
        let environment = request.environment.rawValue
        let ownerId = sanitizePathComponent(request.ownerId, fallback: "unknown-owner")
        let entityId = sanitizePathComponent(request.entityId, fallback: "new")
        let namePrefix = ImageUploadFileNameFormatter.formatPrefix(
            nameHint: request.nameHint,
            namespace: request.namespace
        )
        // swiftlint:disable:next line_length
        return "\(environment)/images/\(request.namespace.rawValue)/\(ownerId)/\(namePrefix)_\(entityId)_\(UUID().uuidString).jpg"
    }

    private func sanitizePathComponent(_ rawValue: String?, fallback: String) -> String {
        let trimmed = (rawValue ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "/", with: "_")
        return trimmed.isEmpty ? fallback : trimmed
    }

    private let outputSidePx = 300
    private let mimeTypeJpeg = "image/jpeg"
}

private actor FirebaseImageStorageUploader: ImageStorageUploading {
    private let storage: Storage
    private var activeUploads: [UUID: StorageUploadTask] = [:]

    init(firebaseAppName: String) {
        guard let app = FirebaseApp.app(name: firebaseAppName) else {
            preconditionFailure("Firebase app is required for image storage")
        }
        self.storage = Storage.storage(app: app)
    }

    func upload(data: Data, path: String, contentType: String) async throws -> URL {
        let operationID = UUID()
        let reference = storage.reference(withPath: path)
        let metadata = StorageMetadata()
        metadata.contentType = contentType

        return try await withTaskCancellationHandler {
            try Task.checkCancellation()
            do {
                try await performUpload(
                    data: data,
                    metadata: metadata,
                    reference: reference,
                    operationID: operationID
                )
            } catch {
                activeUploads[operationID] = nil
                if Task.isCancelled { throw CancellationError() }
                throw error
            }
            activeUploads[operationID] = nil
            try Task.checkCancellation()
            do {
                let downloadURL = try await fetchDownloadURL(from: reference)
                try Task.checkCancellation()
                return downloadURL
            } catch {
                if Task.isCancelled { throw CancellationError() }
                throw error
            }
        } onCancel: {
            Task { await self.cancelUpload(operationID) }
        }
    }

    private func performUpload(
        data: Data,
        metadata: StorageMetadata,
        reference: StorageReference,
        operationID: UUID
    ) async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            let uploadTask = reference.putData(data, metadata: metadata) { _, error in
                if let error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume(returning: ())
                }
            }
            activeUploads[operationID] = uploadTask
        }
    }

    private func fetchDownloadURL(from reference: StorageReference) async throws -> URL {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<URL, Error>) in
            reference.downloadURL { url, error in
                if let error {
                    continuation.resume(throwing: error)
                } else if let url {
                    continuation.resume(returning: url)
                } else {
                    continuation.resume(throwing: ImagePipelineError.downloadURLMissing)
                }
            }
        }
    }

    private func cancelUpload(_ operationID: UUID) {
        activeUploads[operationID]?.cancel()
    }
}
