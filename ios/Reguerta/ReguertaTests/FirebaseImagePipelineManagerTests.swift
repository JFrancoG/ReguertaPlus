import Testing
import UIKit

@testable import Reguerta

@MainActor
@Suite("Firebase image pipeline manager", .timeLimit(.minutes(1)))
struct FirebaseImagePipelineManagerTests {
    @Test("El request fija el entorno del path y conserva los metadatos del resultado")
    func requestFreezesEnvironmentPathAndResultMetadata() async throws {
        let uploader = ControlledImageStorageUploader()
        let manager = FirebaseImagePipelineManager(storageUploader: uploader)
        let inputData = try makeSolidPNG(color: .systemGreen, size: CGSize(width: 640, height: 480))
        let request = ImageUploadRequest(
            environment: .production,
            ownerId: " owner/42 ",
            namespace: .products,
            entityId: "product/7",
            nameHint: "Summer Tomato"
        )
        let operation = Task {
            try await manager.processAndUpload(imageData: inputData, request: request)
        }
        defer { operation.cancel() }

        try await uploader.waitForUploadCount(1)
        let recordedUpload = await uploader.upload(pathContaining: "summer_tomato_product_7")
        let upload = try #require(recordedUpload)
        let downloadURL = try #require(URL(string: "https://example.test/products/product-7.jpg"))

        #expect(upload.path.hasPrefix("production/images/products/owner_42/summer_tomato_product_7_"))
        #expect(upload.path.hasSuffix(".jpg"))
        #expect(upload.contentType == "image/jpeg")
        #expect(upload.data != inputData)
        #expect(upload.data.starts(with: [0xFF, 0xD8]))
        #expect(await uploader.completeUpload(pathContaining: "summer_tomato_product_7", with: downloadURL))

        let result = try await operation.value

        #expect(result.downloadURL == downloadURL.absoluteString)
        #expect(result.widthPx == 300)
        #expect(result.heightPx == 300)
        #expect(result.byteSize == upload.data.count)
        #expect(result.mimeType == upload.contentType)
    }

    @Test("Dos uploads concurrentes conservan su request y resultado independientes")
    func concurrentUploadsRemainIndependent() async throws {
        let uploader = ControlledImageStorageUploader()
        let manager = FirebaseImagePipelineManager(storageUploader: uploader)
        let firstInput = try makeSolidPNG(color: .systemRed, size: CGSize(width: 720, height: 480))
        let secondInput = try makeSolidPNG(color: .systemBlue, size: CGSize(width: 480, height: 720))
        let firstRequest = ImageUploadRequest(
            environment: .develop,
            ownerId: "owner-a",
            namespace: .products,
            entityId: "first",
            nameHint: "Alpha"
        )
        let secondRequest = ImageUploadRequest(
            environment: .production,
            ownerId: "owner-b",
            namespace: .news,
            entityId: "second",
            nameHint: "Beta"
        )
        let firstOperation = Task {
            try await manager.processAndUpload(imageData: firstInput, request: firstRequest)
        }
        let secondOperation = Task {
            try await manager.processAndUpload(imageData: secondInput, request: secondRequest)
        }
        defer {
            firstOperation.cancel()
            secondOperation.cancel()
        }

        try await uploader.waitForUploadCount(2)
        let recordedFirstUpload = await uploader.upload(pathContaining: "alpha_first")
        let recordedSecondUpload = await uploader.upload(pathContaining: "beta_second")
        let firstUpload = try #require(recordedFirstUpload)
        let secondUpload = try #require(recordedSecondUpload)
        let firstURL = try #require(URL(string: "https://example.test/products/first.jpg"))
        let secondURL = try #require(URL(string: "https://example.test/news/second.jpg"))

        #expect(firstUpload.path.hasPrefix("develop/images/products/owner-a/alpha_first_"))
        #expect(secondUpload.path.hasPrefix("production/images/news/owner-b/beta_second_"))
        #expect(firstUpload.path != secondUpload.path)
        #expect(firstUpload.data != secondUpload.data)

        #expect(await uploader.completeUpload(pathContaining: "beta_second", with: secondURL))
        let secondResult = try await secondOperation.value
        #expect(secondResult.downloadURL == secondURL.absoluteString)
        #expect(secondResult.byteSize == secondUpload.data.count)

        #expect(await uploader.completeUpload(pathContaining: "alpha_first", with: firstURL))
        let firstResult = try await firstOperation.value
        #expect(firstResult.downloadURL == firstURL.absoluteString)
        #expect(firstResult.byteSize == firstUpload.data.count)
    }

    @Test("Cancelar un upload no altera el otro ni publica un resultado tardio")
    func cancellationDoesNotAffectConcurrentUploadOrPublishLateResult() async throws {
        let uploader = ControlledImageStorageUploader()
        let manager = FirebaseImagePipelineManager(storageUploader: uploader)
        let publishedResults = ImageUploadResultRecorder()
        let cancelledInput = try makeSolidPNG(color: .systemOrange, size: CGSize(width: 640, height: 480))
        let survivorInput = try makeSolidPNG(color: .systemPurple, size: CGSize(width: 480, height: 640))
        let cancelledRequest = ImageUploadRequest(
            environment: .develop,
            ownerId: "owner-cancelled",
            namespace: .products,
            entityId: "cancelled",
            nameHint: "Discard"
        )
        let survivorRequest = ImageUploadRequest(
            environment: .production,
            ownerId: "owner-survivor",
            namespace: .sharedProfiles,
            entityId: "survivor",
            nameHint: "Keep"
        )
        let cancelledOperation = Task {
            let result = try await manager.processAndUpload(imageData: cancelledInput, request: cancelledRequest)
            await publishedResults.record(result, for: "cancelled")
            return result
        }
        let survivorOperation = Task {
            let result = try await manager.processAndUpload(imageData: survivorInput, request: survivorRequest)
            await publishedResults.record(result, for: "survivor")
            return result
        }
        defer {
            cancelledOperation.cancel()
            survivorOperation.cancel()
        }

        try await uploader.waitForUploadCount(2)
        cancelledOperation.cancel()
        await #expect(throws: CancellationError.self) {
            try await cancelledOperation.value
        }

        let survivorURL = try #require(URL(string: "https://example.test/profiles/survivor.jpg"))
        #expect(await uploader.completeUpload(pathContaining: "keep_survivor", with: survivorURL))
        let survivorResult = try await survivorOperation.value

        #expect(survivorResult.downloadURL == survivorURL.absoluteString)
        #expect(await publishedResults.labels() == ["survivor"])
        #expect(await uploader.pendingUploadCount() == 0)

        let lateURL = try #require(URL(string: "https://example.test/products/must-not-publish.jpg"))
        #expect(!(await uploader.completeUpload(pathContaining: "discard_cancelled", with: lateURL)))

        #expect(await publishedResults.labels() == ["survivor"])
        #expect(await uploader.pendingUploadCount() == 0)
    }
}

private struct RecordedImageStorageUpload {
    let data: Data
    let path: String
    let contentType: String
}

private actor ControlledImageStorageUploader: ImageStorageUploading {
    private struct UploadCountWaiter {
        let count: Int
        let continuation: CheckedContinuation<Void, any Error>
    }

    private var uploads: [RecordedImageStorageUpload] = []
    private var continuations: [String: CheckedContinuation<URL, any Error>] = [:]
    private var uploadCountWaiters: [UUID: UploadCountWaiter] = [:]

    func upload(data: Data, path: String, contentType: String) async throws -> URL {
        try await withTaskCancellationHandler {
            try Task.checkCancellation()
            return try await withCheckedThrowingContinuation { continuation in
                guard !Task.isCancelled else {
                    continuation.resume(throwing: CancellationError())
                    return
                }
                uploads.append(RecordedImageStorageUpload(data: data, path: path, contentType: contentType))
                continuations[path] = continuation
                resumeSatisfiedUploadCountWaiters()
            }
        } onCancel: {
            Task { await self.cancelUpload(path: path) }
        }
    }

    func waitForUploadCount(_ expectedCount: Int) async throws {
        guard uploads.count < expectedCount else { return }
        let waiterID = UUID()
        try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, any Error>) in
                guard !Task.isCancelled else {
                    continuation.resume(throwing: CancellationError())
                    return
                }
                uploadCountWaiters[waiterID] = UploadCountWaiter(
                    count: expectedCount,
                    continuation: continuation
                )
            }
        } onCancel: {
            Task { await self.cancelUploadCountWaiter(id: waiterID) }
        }
    }

    func upload(pathContaining fragment: String) -> RecordedImageStorageUpload? {
        uploads.first { $0.path.contains(fragment) }
    }

    func completeUpload(pathContaining fragment: String, with url: URL) -> Bool {
        guard let path = continuations.keys.first(where: { $0.contains(fragment) }),
              let continuation = continuations.removeValue(forKey: path) else {
            return false
        }
        continuation.resume(returning: url)
        return true
    }

    func pendingUploadCount() -> Int { continuations.count }

    private func resumeSatisfiedUploadCountWaiters() {
        let satisfiedIDs = uploadCountWaiters.compactMap { id, waiter in
            waiter.count <= uploads.count ? id : nil
        }
        for id in satisfiedIDs {
            uploadCountWaiters.removeValue(forKey: id)?.continuation.resume()
        }
    }

    private func cancelUpload(path: String) {
        continuations.removeValue(forKey: path)?.resume(throwing: CancellationError())
    }

    private func cancelUploadCountWaiter(id: UUID) {
        uploadCountWaiters.removeValue(forKey: id)?.continuation.resume(throwing: CancellationError())
    }
}

private actor ImageUploadResultRecorder {
    private var recordedLabels: [String] = []

    func record(_: ImageUploadResult, for label: String) {
        recordedLabels.append(label)
    }

    func labels() -> [String] { recordedLabels }
}

@MainActor
private func makeSolidPNG(color: UIColor, size: CGSize) throws -> Data {
    let format = UIGraphicsImageRendererFormat.default()
    format.scale = 1
    format.opaque = true
    let renderer = UIGraphicsImageRenderer(size: size, format: format)
    let image = renderer.image { context in
        color.setFill()
        context.fill(CGRect(origin: .zero, size: size))
    }
    return try #require(image.pngData(), "La imagen de prueba debe codificarse como PNG")
}
