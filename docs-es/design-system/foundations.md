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

## 3. Mapeo legacy -> canonico (punto de partida)

- Android `primary6DA539` / iOS `accentColor` -> `color-action-primary-default`
- Android `mainBackLight|Dark` / iOS `mainBackF2F8E10F1D0D` -> `color-surface-primary-default`
- Android `secondBackLight|Dark` / iOS `secBackDDE5C01A2B1B` -> `color-surface-secondary-default`
- Android `errorColor` / iOS `errorB04B4B` -> `color-feedback-error-default`
- Android `LowStock` / iOS `warningEB6200` -> `color-feedback-warning-default`

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

- Contraste minimo objetivo: WCAG AA para texto y controles interactivos.
- No usar color como unica senal de estado.
- Preservar minimos de area tactil en contratos de componentes.

## 7. Flexibilidad por plataforma

Permitido:

- Diferencias de control nativo cuando mejoren UX en su plataforma.
- Diferencias de implementacion si la salida semantica es equivalente.

No permitido:

- Semanticas divergentes para acciones core (`primary`, `danger`, `disabled`, `focus`).
