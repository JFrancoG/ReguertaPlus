# Plan - HU-025 (Product image handling pipeline)

## 1. Technical approach

Integrate image selection, processing, upload, and URL persistence using a reusable image pipeline manager shared across screens.

### Image processing contract (canonical)
- Input: user-selected local image.
- Step 1: decode with memory-safe downsampling.
- Step 2: resize so shortest side is exactly `300 px`.
- Step 3: preserve aspect ratio on the long side.
- Step 4: center-crop long side to final `300 x 300`.
- Step 5: encode with output quality/compression policy and upload-ready bytes.
- Output: stable `300x300` image artifact + metadata (mime/size).

## 2. Layer impact
- UI: Image picker and visual state/feedback.
- Domain: Validation for valid image URL attachment and reusable manager contract.
- Data: Storage upload and product document update.
- Backend: Storage path conventions and access control checks.
- Docs: Story/issue updates.

## 3. Platform-specific changes
### Android
- Implement `ImagePipelineManager` abstraction and Android implementation.
- Reuse manager from product forms and leave integration-ready contract for additional screens.
- Integrate picker -> pipeline -> upload -> URL persistence.

### iOS
- Implement `ImagePipelineManager` abstraction and iOS implementation.
- Reuse manager from product forms and leave integration-ready contract for additional screens.
- Integrate picker -> pipeline -> upload -> URL persistence.

### Functions/Backend
- Validate Storage permissions and path conventions.

## 4. Test strategy
- Unit tests for image processing contract:
  - resize shortest side to 300,
  - preserve aspect ratio,
  - center crop to 300x300,
  - deterministic behavior on portrait/landscape inputs.
- Integration tests for upload + product save flow.
- Manual tests for selection, failure/retry, and visual parity between Android/iOS.

## 5. Rollout and validation
- Validate with producer test accounts in develop.
- Confirm parity Android/iOS.

## 6. Phased implementation sequence
### Phase 1 - Preparation
- Define Storage path + URL persistence contract.
- Define shared manager API and processing constants (`300px`, crop center, quality policy).

### Phase 2 - Implementation
- Implement platform managers and wire product forms.
- Add cross-screen integration hooks for future reuse.

### Phase 3 - Closure
- Validate and document outcomes.

## 7. Risks and mitigation
- Risk: inconsistent behavior across platforms.
  - Mitigation: parity test checklist and shared acceptance criteria.
