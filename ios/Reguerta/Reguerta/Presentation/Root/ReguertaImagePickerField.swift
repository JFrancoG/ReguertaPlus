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
    var placesActionsBesideImage = false
    var usesIconControls = false
    var overlaysControlsOnImage = false
    var previewSize: CGFloat = 112.resize
    var usesFitPreview = false
    var controlSize: CGFloat = 44.resize
    var selectsImageOnPreviewTap = false
    var showsImageControls = true

    @State private var isSourceDialogPresented = false
    @State private var isPhotoPickerPresented = false
    @State private var selectedPhotoItem: PhotosPickerItem?
    @State private var isCameraPresented = false

    var body: some View {
        Group {
            if overlaysControlsOnImage {
                VStack(alignment: .center, spacing: tokens.spacing.sm) {
                    ZStack(alignment: .bottomTrailing) {
                        interactiveImagePreview
                        if showsImageControls {
                            imageControls
                                .offset(x: tokens.spacing.sm, y: tokens.spacing.sm)
                        }
                    }
                    subtitleView
                }
                .frame(maxWidth: .infinity)
            } else if placesActionsBesideImage {
                HStack(alignment: .center, spacing: tokens.spacing.md) {
                    interactiveImagePreview
                    VStack(alignment: .leading, spacing: tokens.spacing.sm) {
                        subtitleView
                        if showsImageControls {
                            imageControls
                        }
                    }
                }
            } else {
                VStack(alignment: .leading, spacing: tokens.spacing.md) {
                    interactiveImagePreview
                    subtitleView
                    if showsImageControls {
                        imageControls
                    }
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

    private var imagePreview: some View {
        RoundedRectangle(cornerRadius: 24.resize)
            .fill(tokens.colors.surfaceSecondary)
            .frame(width: previewSize, height: previewSize)
            .overlay {
                if let imageURL = URL(string: imageURLString), !imageURLString.isEmpty {
                    AsyncImage(url: imageURL) { phase in
                        if let image = phase.image {
                            let resizableImage = image.resizable()
                            if usesFitPreview {
                                resizableImage.scaledToFit()
                            } else {
                                resizableImage.scaledToFill()
                            }
                        } else {
                            Image(systemName: placeholderSystemImage)
                                .font(.system(size: previewSize * 0.3))
                                .foregroundStyle(tokens.colors.textSecondary)
                        }
                    }
                    .frame(width: previewSize, height: previewSize)
                    .clipShape(RoundedRectangle(cornerRadius: 24.resize))
                } else {
                    Image(systemName: placeholderSystemImage)
                        .font(.system(size: previewSize * 0.3))
                        .foregroundStyle(tokens.colors.textSecondary)
                }
            }
            .accessibilityHidden(true)
    }

    @ViewBuilder
    private var interactiveImagePreview: some View {
        if selectsImageOnPreviewTap {
            Button {
                isSourceDialogPresented = true
            } label: {
                imagePreview
                    .overlay {
                        if isUploading {
                            ProgressView()
                                .tint(tokens.colors.actionPrimary)
                        }
                    }
            }
            .buttonStyle(.plain)
            .disabled(isUploading)
            .accessibilityLabel(Text(LocalizedStringKey(AccessL10nKey.commonActionSelect)))
        } else {
            imagePreview
        }
    }

    @ViewBuilder
    private var subtitleView: some View {
        if let subtitleKey, !subtitleKey.isEmpty {
            Text(LocalizedStringKey(subtitleKey))
                .font(tokens.typography.bodySecondary)
                .foregroundStyle(tokens.colors.textSecondary)
        }
    }

    private var imageControls: some View {
        HStack(spacing: tokens.spacing.sm) {
            if usesIconControls {
                ReguertaListActionIconButton(
                    systemImageName: "pencil",
                    accessibilityLabel: l10n(AccessL10nKey.commonActionSelect),
                    backgroundColor: tokens.colors.actionPrimary,
                    size: controlSize,
                    isEnabled: !isUploading
                ) {
                    isSourceDialogPresented = true
                }

                if !imageURLString.isEmpty {
                    ReguertaListActionIconButton(
                        systemImageName: "trash",
                        accessibilityLabel: l10n(AccessL10nKey.commonClear),
                        backgroundColor: tokens.colors.feedbackError,
                        size: controlSize,
                        isEnabled: !isUploading,
                        action: onClearImage
                    )
                }
            } else {
                reguertaButton(
                    LocalizedStringKey(AccessL10nKey.commonActionSelect),
                    variant: .secondary,
                    isEnabled: !isUploading,
                    fullWidth: false
                ) {
                    isSourceDialogPresented = true
                }

                if !imageURLString.isEmpty {
                    reguertaButton(
                        LocalizedStringKey(AccessL10nKey.commonClear),
                        variant: .text,
                        isEnabled: !isUploading,
                        fullWidth: false,
                        action: onClearImage
                    )
                }
            }

            if isUploading {
                ProgressView()
                    .tint(tokens.colors.actionPrimary)
            }
        }
        .shadow(
            color: tokens.colors.textPrimary.opacity(overlaysControlsOnImage ? 0.22 : 0),
            radius: overlaysControlsOnImage ? 8.resize : 0,
            x: 0,
            y: overlaysControlsOnImage ? 3.resize : 0
        )
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
            didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]
        ) {
            let image = info[.originalImage] as? UIImage
            onCapture(image)
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            onCapture(nil)
        }
    }
}
