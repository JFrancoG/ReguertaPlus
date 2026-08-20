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

Estado por plataforma:

- iOS usa contratos semanticos de tamano y la propuesta del contenedor SwiftUI
  actual. HU-078 elimino `DeviceScale` global de ventana, su captura, las
  extensiones de resize y todos los usos `.resize*` de produccion.
- Android no cambio en HU-078. Su implementacion adaptativa queda como
  seguimiento de paridad nativo de plataforma bajo la misma intencion semantica.

Reglas:

- Derivar el layout del contenedor activo, no de un snapshot global de ventana.
- Consumir tokens semanticos de spacing, radio, icono, control, layout y ancho
  legible en vez de introducir escalado local de feature o dimensiones arbitrarias.
- Mantener en iOS una region tactil minima de 44 puntos aunque el glifo visible
  sea menor.
- Limitar el ancho legible del scaffold en iOS y permitir que los contenedores
  compactos utilicen el ancho disponible.
- Usar estilos de texto relativos a Dynamic Type sin multiplicar las fuentes por
  el ancho.
- Reservar `@ScaledMetric` para metricas no textuales con significado visual que
  deba seguir Dynamic Type.

## 5. Politica de tipografia

- Mantener `CabinSketch` como baseline primario actual.
- Mantener alineacion de roles por intencion entre plataformas (`title`, `body`, `label`).
- Si se introducen nuevas familias, definir plan de rollout y fallback antes de adoptarlas.

## 6. Baseline de accesibilidad

### 6.1 Paleta canonica de contraste (P1-09)

El contrato canonico legible por maquina es [`color-tokens.json`](../../docs/design-system/color-tokens.json). Su vista generada para personas es [`color-catalog.html`](../../docs/design-system/color-catalog.html), que incluye todos los colores semanticos mapeados, cuatro contextos visuales, procedencia por plataforma y la matriz WCAG calculada.

No duplicar tablas de hexadecimales en documentacion mantenida a mano. Ejecutar `python3 scripts/design-system/generate_color_catalog.py --check` para verificar que contrato, fuentes de produccion y catalogo coinciden.

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

- Preservar un area tactil minima de 44 por 44 puntos en contratos iOS.
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
  - `ios/Reguerta/Reguerta/DesignSystem/ReguertaTheme.swift`
  - `ios/Reguerta/Reguerta/ReguertaApp.swift`

Baseline de migracion auth shell:

- Las rutas Splash / Welcome / Login consumen spacing/radius/tipografia del foundation layer en:
  - `android/Reguerta/app/src/main/java/com/reguerta/user/presentation/root/ReguertaRoot.kt`
  - `ios/Reguerta/Reguerta/Presentation/Root/AuthShellView.swift`
  - `ios/Reguerta/Reguerta/Presentation/Auth/ContentView+AuthRoutes.swift`
  - `ios/Reguerta/Reguerta/Presentation/Auth/ContentView+AuthForms.swift`

## 9. Foundation adaptativo iOS HU-078 (2026-08-20)

`ReguertaDesignTokens` es la autoridad iOS para valores semanticos de spacing,
radio, icono, layout, ancho legible, area de control, tipografia, color y
movimiento. Los valores raw permanecen dentro de DesignSystem; las vistas de
feature consumen intencion nombrada.

Los contratos iOS activos son:

- `ReguertaTheme` lee `accessibilityReduceMotion` una sola vez e inyecta
  `ReguertaMotionPolicy` junto a los tokens semanticos.
- `ReguertaMotionPolicy` preserva los cambios de estado esenciales y permite
  eliminar animacion material y escala cuando se reduce el movimiento.
- `ReguertaScreenScaffold` recibe el ancho del contenedor activo, centra el
  contenido regular, limita su ancho legible a 720 puntos y preserva el ownership
  de safe area de ADR-0005.
- El texto usa CabinSketch con estilos relativos a Dynamic Type y sin
  multiplicador de fuente derivado del ancho.
- Siete propiedades `@ScaledMetric` focales escalan metricas no textuales con
  significado; no sustituyen el layout consciente del contenedor.
- Los controles compartidos componen una region tactil minima de 44 por 44
  puntos.

La evidencia de implementacion contiene 19 archivos Swift de DesignSystem /
2.444 lineas / 30 previews y 6 archivos de soporte de previews de Presentation /
1.998 lineas / 26 previews. Release, contrato de color, settings, builds, lint y
auditoria de scope estan verdes. Las previews deterministas y las pruebas
estructurales no certifican por si solas la accesibilidad en runtime. El
2026-08-20 el mantenedor completo una aceptacion manual acotada para el MVP: la
navegacion/acciones representativas con VoiceOver y Voice Control, los controles
muestreados con Accessibility Inspector y la comparacion interactiva Reduce
Motion off/on se comportaron correctamente. No es una certificacion exhaustiva
de tecnologias de asistencia.

No cambio codigo Android. La paridad Android debe adoptar APIs adaptativas
nativas conservando estos roles semanticos, no copiar detalles de SwiftUI.
