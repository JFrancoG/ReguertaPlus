# Plan - HU-072 (Android activity state restoration)

## 1. Technical approach

Replace composition-owned `SessionViewModel` construction with a stable
`ViewModelProvider.Factory` whose dependency graph is created only from
`create()`. Obtain the ViewModel with the lifecycle-aware activity `viewModels`
delegate so Android retains it across activity recreation and clears its
`viewModelScope` and owned resources at the correct lifecycle boundary.

Separate cold-launch orchestration from configuration restoration. An
activity-scoped root state ViewModel will retain the auth shell route and
startup completion, while the existing session and Home saveable state remain
the authorities for their respective layers.

Do not add `android:configChanges`: adaptive windows can still resize without a
physical rotation, and bypassing recreation would conceal rather than repair
incorrect state ownership. Do not migrate the complete navigation hierarchy to
Navigation 3 in this focused fix.

## 2. Layer impact

- UI: no visual redesign; splash is suppressed only for restored activity state.
- Presentation: lifecycle-aware ViewModel ownership and retained root routing.
- Domain: no changes.
- Data: dependency construction moves behind the ViewModel factory; repository
  contracts do not change.
- Backend: none.
- Docs: HU-072 spec, plan, tasks, issue mirror, and validation evidence.

## 3. Platform-specific changes

### Android

- Replace `remember { SessionViewModel(...) }` with `viewModel(factory = ...)`.
- Make the dependency graph lazy and use application context where required.
- Transfer closeable assistant cleanup to the ViewModel lifecycle boundary.
- Add lifecycle-retained state for auth-shell and startup completion.
- Retain the current Home destination restoration behavior.

### iOS

- No code changes. iOS already owns its lifecycle independently and its
  orientation configuration is not the source of this Android defect.

### Functions/Backend

- No changes or deployments.

## 4. Test strategy

- Unit: root-state initialization/retry and cold-launch versus
  restored-root state contracts.
- Integration: recreate `MainActivity` and assert ViewModel identity, route,
  absence of repeated splash, and retained Home destination.
- Regression: existing Android unit suite and lint.
- Manual: rotate portrait/landscape on an available API 37 emulator after the
  automated recreation test passes.

## 5. Rollout and functional validation

1. Capture a failing recreation test against the current implementation.
2. Implement lifecycle-aware ownership and restoration.
3. Run focused tests, full unit tests, lint, and connected tests.
4. Record evidence in `tasks.md` and issue #241.
5. Prepare a focused commit/PR only when delivery is authorized.

## 6. Phased implementation sequence

### Phase 1 - Reproduction and ownership

- Add the deterministic recreation test.
- Introduce the lifecycle-aware factory and ViewModel lookup.

### Phase 2 - Root restoration

- Persist root shell/cold-launch state without rerunning startup work.
- Align closeable-resource ownership with ViewModel clearing.

### Phase 3 - Validation and handoff

- Run focused, unit, lint, connected, and manual rotation checks.
- Update planning evidence and GitHub issue.

## 7. Technical risks and mitigation

- Factory recreation could allocate unused resources -> construct the graph
  only inside `create()`.
- Route restoration could bypass a required cold launch -> distinguish saved
  activity restoration from a fresh process and test both paths.
- Existing custom navigation lacks Navigation 3 guarantees -> keep the fix
  narrow and track any broader migration separately.
