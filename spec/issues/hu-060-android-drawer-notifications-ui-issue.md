# [HU-060] Pulir espacios y textos UI Android/iOS

## Summary

Pulir espacios, jerarquía tipográfica y textos en pantallas clave de Android/iOS, tomando iOS como referencia cuando ya esté mejor resuelto y ajustando ambos lados cuando convenga mantener coherencia visual.

## Links
- GitHub Issue: #157
- URL: https://github.com/JFrancoG/ReguertaPlus/issues/157
- Spec: spec/app/hu-060-android-drawer-notifications-ui/spec.md
- Plan: spec/app/hu-060-android-drawer-notifications-ui/plan.md
- Tasks: spec/app/hu-060-android-drawer-notifications-ui/tasks.md

## Acceptance criteria

- El menú lateral Android usa nombres equivalentes a los de iOS para las mismas rutas funcionales.
- El drawer Android abre con una animación más pausada y natural.
- El drawer Android queda dentro de la composición visible, manteniendo el botón de menú/estado esperado.
- La pantalla Android de Notificaciones coloca la fecha debajo del título y alineada con las cards.
- La bienvenida, login/registro y home ajustan tamaños/posiciones/fuentes donde las capturas muestran diferencias claras.
- Se consulta la implementación iOS cuando la captura no sea suficiente para igualar estructura o textos.
- La validación Android relevante pasa antes de cerrar la PR y los cambios iOS compilan.

## Scope

### In Scope
- Android side drawer copy, width, and open/close animation.
- Android notifications feed title/date alignment.
- Android welcome/auth/home spacing and typography polish.
- Small iOS welcome/home typography adjustments where Android/iOS comparison showed imbalance.
- iOS as reference for naming, spacing, and hierarchy where appropriate.
- Focused documentation and validation evidence.

### Out of Scope
- Backend or Firestore changes.
- New notification behavior.
- Broad iOS redesign.
- Final redesign of home order buttons after light/dark review.

## Implementation checklist
- [x] Android drawer
- [x] Android notifications
- [x] iOS reference review
- [x] Testing
- [x] Documentation

## Suggested labels
- type:feature
- area:app
- area:notifications
- platform:android
- priority:P2
