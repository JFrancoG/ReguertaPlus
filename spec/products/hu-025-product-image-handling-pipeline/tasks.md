# Tasks - HU-025 (Product image handling pipeline)

## 1. Preparation
- [ ] Confirm Storage path and URL contract.
- [ ] Define image processing constraints:
  - shortest side = `300 px`,
  - preserve aspect ratio,
  - centered crop to `300 x 300`,
  - output quality/compression policy.
- [ ] Define reusable `ImagePipelineManager` contract for multi-screen use.

## 2. Android implementation
- [ ] Add image picker in product forms.
- [ ] Implement Android `ImagePipelineManager`.
- [ ] Add resize/crop pipeline (`300 -> 300x300`) and upload flow via manager.
- [ ] Persist resulting URL on product save.
- [ ] Expose manager so additional Android screens can reuse it.

## 3. iOS implementation
- [ ] Add image picker in product forms.
- [ ] Implement iOS `ImagePipelineManager`.
- [ ] Add resize/crop pipeline (`300 -> 300x300`) and upload flow via manager.
- [ ] Persist resulting URL on product save.
- [ ] Expose manager so additional iOS screens can reuse it.

## 4. Backend / Firestore
- [ ] Validate Storage rules and path consistency.
- [ ] Ensure product schema accepts persisted image URL.

## 5. Testing
- [ ] Unit tests for URL and form validation.
- [ ] Unit tests for image processing contract (short side 300, center crop 300x300, aspect ratio).
- [ ] Integration tests for upload + save sequence.
- [ ] Manual validation for success/failure/retry paths and visual parity across platforms.

## 6. Documentation
- [ ] Update issue notes and technical decisions.
- [ ] Document parity status.

## 7. Closure
- [ ] Link issue and PR.
- [ ] Complete DoD checklist.
