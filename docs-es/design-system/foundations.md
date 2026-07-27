# Foundations

Este documento define el modelo canonico de foundations del design-system de Reguerta.

## 1. Capas de tokens

- `core`: valores primitivos (hex, escalas numericas, radios, spacing).
- `semantic`: nombres por intencion usados por UI (`surface-primary`, `text-primary`, `action-primary`).
- `component`: alias por componente (`button-primary-container`, `input-border-focus`).

Regla: el codigo de features debe depender de tokens semanticos o de componente, nunca de valores raw.

## 2. Politica de naming

Patron recomendado:

- Colores: `<categoria>-<intencion>-<estado>`
- Tipografia: `<rol>-<size>`
- Spacing: `space-<escala>`
- Radius: `radius-<escala>`
- Elevacion: `elevation-<nivel>`

Ejemplos:

- `color-surface-primary-default`
- `color-text-primary-default`
- `space-md`
- `radius-lg`
- `elevation-2`

Evitar en nuevos tokens nombres que codifiquen hex.

## 3. Mapeo legacy -> canonico

- Android `ColorActionPrimaryDefaultLight|Dark` / iOS `AccentColor` y `actionPrimary` -> `color-action-primary-default`
- Android `onPrimary` / iOS `actionOnPrimary` -> `color-action-on-primary-default`
- iOS `controlAccent` -> `color-control-accent-default`
- Android `mainBackLight|Dark` / iOS `mainBackF2F8E10F1D0D` -> `color-surface-primary-default`
- Android `secondBackLight|Dark` / iOS `secBackDDE5C01A2B1B` -> `color-surface-secondary-default`
- Android `ColorFeedbackErrorDefaultLight|Dark` / iOS `error` -> `color-feedback-error-default`
- Android `onError` / iOS `feedbackOnError` -> `color-feedback-on-error-default`
- Android `ColorFeedbackWarningDefaultLight|Dark` / iOS `warning` -> `color-feedback-warning-default`

Estos aliases son transicionales y pueden evolucionar.

## 4. Politica responsive

Los sistemas actuales usan escalado custom (`resize` / width ratio).

Guia:

- Mantener el comportamiento de escala existente durante la migracion.
- No introducir nuevos tamanos hardcodeados.
- Evolucionar hacia ramps de tamanos controladas por tokens e implementadas de forma nativa por plataforma.

## 5. Politica de tipografia

- Mantener `CabinSketch` como baseline primario actual.
- Mantener alineacion de roles por intencion entre plataformas (`title`, `body`, `label`).
- Si se introducen nuevas familias, definir plan de rollout y fallback antes de adoptarlas.

## 6. Baseline de accesibilidad

### 6.1 Paleta canonica de contraste (P1-09)

| Token semantico | iOS Light | iOS Dark | iOS Increased Contrast Light | iOS Increased Contrast Dark | Android Light | Android Dark |
|---|---|---|---|---|---|---|
| `color-action-primary-default` (`AccentColor` en iOS) | `#3D681E` | `#6DA239` | `#315815` | `#A8DD75` | `#3D681E` | `#6DA239` |
| `color-action-on-primary-default` | `#F2F8E1` | `#0F1D0D` | `#F2F8E1` | `#0F1D0D` | `#F2F8E1` | `#0F1D0D` |
| `color-control-accent-default` | `#3D681E` | `#6DA239` | `#315815` | `#5B8B2D` | Usa el par `primary`/`onPrimary` de Material 3 | Usa el par `primary`/`onPrimary` de Material 3 |
| `color-feedback-warning-default` | `#843800` | `#FFAA70` | `#6D2B00` | `#FFC093` | `#843800` | `#FFAA70` |
| `color-feedback-error-default` | `#8D3434` | `#F48787` | `#742222` | `#FFA5A5` | `#8D3434` | `#F48787` |
| `color-feedback-on-error-default` | `#F2F8E1` | `#0F1D0D` | `#F2F8E1` | `#0F1D0D` | `#F2F8E1` | `#0F1D0D` |

`AccentColor` y `actionPrimary` deben resolver a los mismos valores en iOS. `controlAccent` se mantiene separado para que los controles nativos conserven el contraste no textual, tambien con Increased Contrast activado.

### 6.2 Contrato de contraste y estados

| Caso de uso | Contrato requerido |
|---|---|
| Texto normal | Ratio de contraste de al menos `4.5:1` contra su fondo renderizado. |
| Controles no textuales e indicadores de estado esenciales | Ratio de contraste de al menos `3:1` contra los colores adyacentes. |
| Estado pulsado | Revalidar el par semantico foreground/background despues de aplicar el overlay de estado estandar del `12%`. |
| Control Liquid Glass tintado con el color de accion | Limitar el self-tint del Glass a `0.16` y renderizarlo sobre un backing `surfacePrimary` explicito. Las demas superficies semanticas de estado deben validar de forma independiente su par foreground/background renderizado. |
| Floating action buttons y barras de totales | Usar contenedores semanticos opacos con su color de contenido semantico emparejado. |
| Contenido de accion y destructivo | Usar `actionOnPrimary` y `feedbackOnError`, respectivamente; no hardcodear blanco o negro. |
| Estados seleccionado y leido/no leido | Anadir icono, texto, forma o semantica de accesibilidad; el color no puede ser la unica senal. |

- Preservar minimos de area tactil en contratos de componentes.
- Considerar el estado renderizado, no un token aislado, como unidad de verificacion de contraste.

## 7. Flexibilidad por plataforma

Permitido:

- Diferencias de control nativo cuando mejoren UX en su plataforma.
- Diferencias de implementacion si la salida semantica es equivalente.

No permitido:

- Semanticas divergentes para acciones core (`primary`, `danger`, `disabled`, `focus`).

## 8. Baseline implementado HU-035 (2026-03-13)

Puntos de entrada actuales en codigo:

- Android (theme wrapper + paleta semantica):
  - `android/Reguerta/app/src/main/java/com/reguerta/user/ui/theme/Theme.kt`
  - `android/Reguerta/app/src/main/java/com/reguerta/user/ui/theme/Color.kt`
  - `android/Reguerta/app/src/main/java/com/reguerta/user/ui/theme/Type.kt`
  - `android/Reguerta/app/src/main/java/com/reguerta/user/ui/theme/DesignTokens.kt`
- iOS (theme wrapper + tokens semanticos):
  - `ios/Reguerta/Reguerta/Reguerta/DesignSystem/ReguertaTheme.swift`
  - `ios/Reguerta/Reguerta/Reguerta/ReguertaApp.swift`

Baseline de migracion auth shell:

- Las rutas Splash / Welcome / Login consumen spacing/radius/tipografia del foundation layer en:
  - `android/Reguerta/app/src/main/java/com/reguerta/user/presentation/access/ReguertaRoot.kt`
  - `ios/Reguerta/Reguerta/Reguerta/ContentView.swift`
