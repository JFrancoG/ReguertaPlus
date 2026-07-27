# Migration Backlog

Prioritized tasks to move from current state to a cleaner cross-platform design-system.

## P0 (Now)

- [x] Define canonical semantic token dictionary for color/type/spacing/radius.
- [x] Publish cross-platform mapping table (legacy -> canonical).
- Keep source snapshots current and traceable.

## P1 (Next)

- [x] Normalize button variants and naming across Android/iOS.
- [x] Normalize input state model (`error`, `focus`, `disabled`, helper text).
- [x] Enforce the P1-09 semantic WCAG AA color contract in Android and iOS with automated checks.
- Normalize dialog API and action model.
- Remove or isolate explicitly deprecated/unused elements.

## P2 (After Auth/Onboarding UI work starts)

- [x] Build splash/welcome/auth screens only with stable/candidate design-system primitives.
- Validate responsive behavior in compact and large devices.
- Add a generated color/contrast catalog plus a native UI sandbox for visual regression checks.

## P3 (Continuous)

- Introduce automated visual checks where feasible.
- Periodically prune deprecated aliases and update docs.
