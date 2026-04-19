import AVFoundation
import PhotosUI
import SwiftUI
import UIKit

struct ReguertaImagePickerField: View {
    let tokens: ReguertaDesignTokens
    let imageURLString: String
    let isUploading: Bool
    let placeholderSystemImage: String
    let subtitleKey: String?
    let onPickImageData: (Data) -> Void
    let onClearImage: () -> Void
    let onImageSelectionFailed: () -> Void
    let onCameraPermissionDenied: () -> Void
    let onCameraUnavailable: () -> Void

    @State private var isSourceDialogPresented = false
    @State private var isPhotoPickerPresented = false
    @State private var selectedPhotoItem: PhotosPickerItem?
    @State private var isCameraPresented = false

    var body: some View {
        VStack(alignment: .leading, spacing: tokens.spacing.md) {
            RoundedRectangle(cornerRadius: 24.resize)
                .fill(tokens.colors.surfaceSecondary)
                .frame(width: 112.resize, height: 112.resize)
                .overlay {
                    if let imageURL = URL(string: imageURLString), !imageURLString.isEmpty {
                        AsyncImage(url: imageURL) { phase in
                            if let image = phase.image {
                                image
                                    .resizable()
                                    .scaledToFill()
                            } else {
                                Image(systemName: placeholderSystemImage)
                                    .font(.system(size: 34.resize))
                                    .foregroundStyle(tokens.colors.textSecondary)
                            }
                        }
                        .frame(width: 112.resize, height: 112.resize)
                        .clipShape(RoundedRectangle(cornerRadius: 24.resize))
                    } else {
                        Image(systemName: placeholderSystemImage)
                            .font(.system(size: 34.resize))
                            .foregroundStyle(tokens.colors.textSecondary)
                    }
                }

            if let subtitleKey, !subtitleKey.isEmpty {
                Text(LocalizedStringKey(subtitleKey))
                    .font(tokens.typography.bodySecondary)
                    .foregroundStyle(tokens.colors.textSecondary)
            }

            HStack(spacing: tokens.spacing.sm) {
                ReguertaButton(
                    LocalizedStringKey(AccessL10nKey.commonActionSelect),
                    variant: .secondary,
                    isEnabled: !isUploading,
                    fullWidth: false
                ) {
                    isSourceDialogPresented = true
                }

                if !imageURLString.isEmpty {
                    ReguertaButton(
                        LocalizedStringKey(AccessL10nKey.commonClear),
                        variant: .text,
                        isEnabled: !isUploading,
                        fullWidth: false,
                        action: onClearImage
                    )
                }

                if isUploading {
                    ProgressView()
                        .tint(tokens.colors.actionPrimary)
                }
            }
        }
        .confirmationDialog(
            LocalizedStringKey(AccessL10nKey.imageSourceDialogTitle),
            isPresented: $isSourceDialogPresented,
            titleVisibility: .visible
        ) {
            Button(LocalizedStringKey(AccessL10nKey.imageSourceActionGallery)) {
                isPhotoPickerPresented = true
            }
            Button(LocalizedStringKey(AccessL10nKey.imageSourceActionCamera)) {
                openCameraFlow()
            }
            Button(LocalizedStringKey(AccessL10nKey.commonActionCancel), role: .cancel) { }
        } message: {
            Text(LocalizedStringKey(AccessL10nKey.imageSourceDialogMessage))
        }
        .photosPicker(
            isPresented: $isPhotoPickerPresented,
            selection: $selectedPhotoItem,
            matching: .images
        )
        .sheet(isPresented: $isCameraPresented) {
            ReguertaCameraCaptureView { image in
                isCameraPresented = false
                guard let image else { return }
                guard let data = image.jpegData(compressionQuality: 0.95) else {
                    onImageSelectionFailed()
                    return
                }
                onPickImageData(data)
            }
            .ignoresSafeArea()
        }
        .onChange(of: selectedPhotoItem) { _, newValue in
            guard let newValue else { return }
            Task {
                do {
                    guard let imageData = try await newValue.loadTransferable(type: Data.self) else {
                        await MainActor.run {
                            selectedPhotoItem = nil
                            onImageSelectionFailed()
                        }
                        return
                    }
                    await MainActor.run {
                        selectedPhotoItem = nil
                        onPickImageData(imageData)
                    }
                } catch {
                    await MainActor.run {
                        selectedPhotoItem = nil
                        onImageSelectionFailed()
                    }
                }
            }
        }
    }

    private func openCameraFlow() {
        guard UIImagePickerController.isSourceTypeAvailable(.camera) else {
            onCameraUnavailable()
            return
        }

        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            isCameraPresented = true
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { granted in
                DispatchQueue.main.async {
                    if granted {
                        isCameraPresented = true
                    } else {
                        onCameraPermissionDenied()
                    }
                }
            }
        case .denied, .restricted:
            onCameraPermissionDenied()
        @unknown default:
            onCameraPermissionDenied()
        }
    }
}

private struct ReguertaCameraCaptureView: UIViewControllerRepresentable {
    let onCapture: (UIImage?) -> Void

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.cameraCaptureMode = .photo
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(onCapture: onCapture)
    }

    final class Coordinator: NSObject, UINavigationControllerDelegate, UIImagePickerControllerDelegate {
        private let onCapture: (UIImage?) -> Void

        init(onCapture: @escaping (UIImage?) -> Void) {
            self.onCapture = onCapture
        }

        func imagePickerController(
            _ picker: UIImagePickerController,
            didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey : Any]
        ) {
            let image = info[.originalImage] as? UIImage
            onCapture(image)
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            onCapture(nil)
        }
    }
}
