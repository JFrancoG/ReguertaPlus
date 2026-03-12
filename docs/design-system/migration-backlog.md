# Migration Backlog

Prioritized tasks to move from current state to a cleaner cross-platform design-system.

## P0 (Now)

- Define canonical semantic token dictionary for color/type/spacing/radius.
- Publish cross-platform mapping table (legacy -> canonical).
- Keep source snapshots current and traceable.

## P1 (Next)

- Normalize button variants and naming across Android/iOS.
- Normalize input state model (`touched`, `error`, `focus`, `disabled`).
- Normalize dialog API and action model.
- Remove or isolate explicitly deprecated/unused elements.

## P2 (After Auth/Onboarding UI work starts)

- Build splash/welcome/auth screens only with stable/candidate design-system primitives.
- Validate responsive behavior in compact and large devices.
- Add UI catalog/sandbox screen for visual regression checks.

## P3 (Continuous)

- Introduce automated visual checks where feasible.
- Periodically prune deprecated aliases and update docs.
