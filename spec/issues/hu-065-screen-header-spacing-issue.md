# Issue mirror - HU-065

- GitHub issue: https://github.com/JFrancoG/ReguertaPlus/issues/169
- Draft pull request: https://github.com/JFrancoG/ReguertaPlus/pull/170
- Title: `[HU-065] Separar el título del contenido en Android`
- Labels: `bug`, `area:app`, `platform:android`, `priority:P3`
- Branch: `codex/hu-065-screen-header-spacing`

## Summary

Add 8 dp of bottom-only padding to the shared Android screen-title component so following content no longer appears crowded against the title.

## Acceptance criteria

- Every shared Android screen title inherits the 8 dp gap.
- Navigation, actions, typography, and heading semantics remain unchanged.
- Dashboard keeps its compact header.
- Unit, lint, and connected UI validation are recorded in the story spec.
