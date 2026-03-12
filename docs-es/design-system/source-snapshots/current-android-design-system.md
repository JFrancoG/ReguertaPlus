# Reguerta Design System (actual, sin legacy)

Documento de referencia del design system vigente en `:presentation`, preparado para reutilizar en un repo nuevo.

## 1. Alcance y principios

Este documento describe solo lo que está activo en el código actual:

- Theming Material 3.
- Tokens de diseño.
- Tipografía y color.
- Composables base reutilizables.
- Contratos de uso.

No incluye patrones legacy ni APIs deprecadas como fuente de verdad.

## 2. Estructura técnica (módulo `:presentation`)

### 2.1 Archivos core

- `presentation/src/main/java/com/reguerta/presentation/ui/Color.kt`
- `presentation/src/main/java/com/reguerta/presentation/ui/Typography.kt`
- `presentation/src/main/java/com/reguerta/presentation/ui/Theme.kt`
- `presentation/src/main/java/com/reguerta/presentation/ui/DesignTokens.kt`
- `presentation/src/main/java/com/reguerta/presentation/composables/*`

### 2.2 Dependencias de UI

- Jetpack Compose + Material 3.
- Coil (`AsyncImage`).
- Lottie Compose (`LoadingAnimation`).

## 3. Foundations

## 3.1 Color system (`Color.kt` + `Theme.kt`)

### 3.1.1 Brand tokens

- `primary6DA539 = #6DA539`
- `secondary4C774C = #4C774C`
- `tertiary4A9184 = #4A9184`
- `errorColor = #B04B4B`
- `mainBackLight = #F2F8E1`
- `mainBackDark = #0F1D0D`
- `secondBackLight = #DDE5C0`
- `secondBackDark = #1A2B1B`
- `LowStock = #EB6200` (estado funcional para stock bajo)

### 3.1.2 Material 3 color schemes

- `LightColorScheme`: configura `primary`, `secondary`, `tertiary`, `background`, `surface`, `error`, `outline`, etc.
- `DarkColorScheme`: equivalente en dark.

### 3.1.3 Política de tema

- Composable raíz: `ReguertaTheme`.
- `dynamicColor` está desactivado de facto (aunque el parámetro existe).
- Control de iconos de system bars vía `WindowInsetsControllerCompat`.

## 3.2 Typography (`Typography.kt`)

Familia tipográfica única:

- `CabinSketchFontFamily`
- Recursos:
- `R.font.cabinsketch_regular`
- `R.font.cabinsketch_bold`

Escala tipográfica Material 3 definida explícitamente:

| Rol | Size | Weight |
|---|---:|---|
| `displayLarge` | 48sp | Bold |
| `displayMedium` | 40sp | Bold |
| `displaySmall` | 36sp | Bold |
| `headlineLarge` | 32sp | Bold |
| `headlineMedium` | 28sp | Bold |
| `headlineSmall` | 24sp | Bold |
| `titleLarge` | 22sp | Bold |
| `titleMedium` | 18sp | Bold |
| `titleSmall` | 16sp | Bold |
| `bodyLarge` | 16sp | Normal |
| `bodyMedium` | 14sp | Normal |
| `bodySmall` | 12sp | Normal |
| `labelLarge` | 15sp | Bold |
| `labelMedium` | 14sp | Normal |
| `labelSmall` | 12sp | Normal |

Implementación aplicada en `MaterialTheme(typography = ReguertaTypography)`.

## 3.3 Sizing/spacing strategy (`DesignTokens.kt`)

`Dimens` es la única fuente de verdad para medidas.

### 3.3.1 Base tokens

- `Dimens.Spacing`: `zero`, `xxs`, `xs`, `sm`, `mdLow`, `md`, `lg`, `xl`, `xxl`, `xxxl`.
- `Dimens.Border`: `thin`, `regular`, `large`.
- `Dimens.Radius`: `xs`, `sm`, `md`, `lg`, `xl`.
- `Dimens.Size`: catálogo cerrado (`dp16` ... `dp330`).

Notas:

- Muchos valores se escalan con `resize()` (ratio dependiente de ancho de pantalla).
- Evitar `dp` hardcoded fuera de tokens.

## 4. Component tokens (`Dimens.Components`)

## 4.1 Dialog

- Tamaños: `iconSize`, `badgeSize`.
- Espaciados: `horizontalPadding`, `verticalPadding`.
- Shape: `iconCornerRadius`.
- Width policy: `widthRatio`.
- Estilos: `titleStyle`, `bodyStyle`.
- Color mapping semántico: `colorsFor(UiType)`.

## 4.2 Button

- Layout mínimo: `minHeight`, `defaultHeight`.
- Spacing interno: `horizontalPadding`, `verticalPadding`.
- Shape: `cornerRadius`.
- Typography roles: `labelStyle`, `secondaryLabelStyle`.
- Iconos: `iconSize`.
- Width presets: `fixedSingleWidth`, `fixedTwoButtonsWidth`, `fixedTwoButtonsDialogWidth`.
- Variantes de color:
- `colors(UiType)`
- `inverseColors(UiType)`
- `borderColor(UiType)`
- Disabled colors: `disabledContainerColor`, `disabledContentColor`.

## 4.3 TopBar

- `height`, `contentPadding`, `iconSize`.
- `leadingIconSize`, `actionIconSize`.
- `containerColor`, `titleColor`, `navIconTint`, `actionIconTint`.
- `colors()` centraliza `TopAppBarColors`.
- `titleStyle`.

## 4.4 Input

- `minHeight`, `cornerRadius`.
- `contentPaddingVertical`, `contentPaddingHorizontal`.
- `trailingIconSize`.
- Estilos: `textStyle`, `labelStyle`, `supportingStyle`.

## 4.5 Image

- `cornerRadius`, `borderThickness`.
- `avatar`, `productThumb`.
- `crossfadeMillis`.

## 4.6 Lottie

- `Loading.size`, `Loading.speed`.

## 4.7 Card

- `Kind`: `Filled`, `Elevated`, `Outlined`.
- `cornerRadius`.
- `elevation(kind)`.
- `containerColor(kind)`, `contentColor(kind)`.
- `border(kind)`.

## 4.8 Checkbox

- `size`.
- `colors()` centralizado.

## 4.9 Counter

- `minHeight`, `cornerRadius`.
- `horizontalPadding`, `verticalPadding`.
- `iconSize`.
- `containerColor`, `contentColor`, `disabledContentColor`.

## 4.10 Dropdown

- `anchorHeight`.
- `contentPaddingHorizontal`, `contentPaddingVertical`.
- `itemHeight`.
- `menuMaxHeight`.

## 4.11 Divider

- `thickness`, `color`.
- `Kind`: `Subtle`, `Strong`.
- `thickness(kind)`, `color(kind)`.

## 5. Composables base (catálogo actual)

## 5.1 Screen wrappers y layout

### `Screen`

Archivo: `composables/Screen.kt`

- Aplica `ReguertaTheme`.
- Envuelve contenido en `Surface(fillMaxSize())`.

### `ReguertaScaffold`

Archivo: `composables/ReguertaScaffold.kt`

- Wrapper de `Scaffold` con insets por defecto: `WindowInsets.systemBars`.
- Acepta `scrollBehavior` y conecta `nestedScroll`.
- Slots estándar: `topBar`, `bottomBar`, `snackbarHost`, `floatingActionButton`.

## 5.2 Top bars

### `ReguertaTopBar`

Archivo: `composables/TopBar.kt`

- Basada en `MediumTopAppBar`.
- Soporta `actions`.
- Soporta `scrollBehavior`.
- Usa `Dimens.Components.TopBar.colors()` y `titleStyle`.

### `ReguertaHomeTopBar`

- Variante simplificada con `TopAppBar`.

## 5.3 Text

Archivo: `composables/Text.kt`

Composables:

- `TextRegular`
- `TextBody` (String)
- `TextBody` (AnnotatedString)
- `TextTitle` (String)
- `TextTitle` (AnnotatedString)
- `HeaderSectionText`
- `AmountText`
- `StockProductText`
- `StockOrderText`

Reglas:

- `style` es la forma preferida.
- Los parámetros `textSize` se mantienen por compatibilidad, no como patrón futuro.

## 5.4 Buttons

Archivo: `composables/Button.kt`

Tipos y contratos:

- `typealias BtnType = UiType`
- `enum ButtonLayout { Fixed, Fill }`

Composables:

- `ReguertaButton`
- `InverseReguertaButton` (texto)
- `InverseReguertaButton` (slot-based, marcado deprecated en parámetros legacy `borderSize`/`cornerSize`)
- `ReguertaOrderButton` (CTA de pedidos con estado disabled visual y candado)
- `ReguertaIconButton`
- `ReguertaFullButton` (ancho configurable con `ButtonLayout`)
- `ReguertaFlatButton` (incluye variante visual especial para `UiType.ERROR`)

## 5.5 Inputs

Archivo: `composables/Input.kt`

Composables:

- `ReguertaEmailInput`
- `ReguertaPasswordInput`
- `TextReguertaInput`
- `CustomPhoneNumberInput`
- `CustomTextField`

Características:

- Validación visual basada en `UiError`.
- Estado `touched` para no mostrar errores antes de perder foco.
- Password con toggle show/hide.
- `TextFieldDefaults.colors` personalizados a `MaterialTheme.colorScheme`.
- Inputs custom (`BasicTextField`) centrados para casos de teléfono/cantidad.

## 5.6 Alert dialog

Archivo: `composables/AlertDialog.kt`

Composables:

- `ReguertaAlertDialog` (API declarativa por parámetros: title/body/buttons/type)
- `ReguertaAlertDialog` (API slot-based avanzada)

Características:

- Semántica por `UiType`.
- Botonera adaptativa:
- Solo confirm.
- Solo dismiss.
- Confirm + dismiss en fila.
- Anchura controlada con `usePlatformDefaultWidth = false`.

## 5.7 Card

Archivo: `composables/Card.kt`

- `ReguertaCard` con `kind` y overrides opcionales de `containerColor`, `contentColor`, `cornerRadius`, `elevation`, `border`.

## 5.8 Selection controls

### Checkbox (`composables/CheckBox.kt`)

- `ReguertaCheckBox`

### Counter (`composables/Counter.kt`)

- `ReguertaCounter`
- Botón de decremento deshabilitado cuando `value <= 0`.

### Dropdown (`composables/Dropdown.kt`)

- Modelo: `data class DropDownItem(val text: String)`
- Composable: `DropdownSelectable`
- Soporta ancho del menú acoplado al anchor (`onSizeChanged`).
- Semántica de accesibilidad de botón.

## 5.9 Divider

Archivo: `composables/Divider.kt`

- `ReguertaDivider(vertical = true/false)`
- `ReguertaHorizontalDivider`
- `ReguertaVerticalDivider`

## 5.10 Imágenes y media

### `ImageUrl` (`composables/ImageUrl.kt`)

- Implementación con Coil `AsyncImage`.
- Placeholder/error/fallback unificado (`R.mipmap.product_no_available`).
- Cache de memoria y disco activada.
- `crossfade` configurable.

### `ProductImage` (`composables/ProductImage.kt`)

- Fallback local si `imageUrl` está vacío.
- Decoración visual consistente (clip + background + border).

### `LoadingAnimation` (`composables/LottieAnimation.kt`)

- Lottie en loop infinito por defecto.
- Asset actual: `R.raw.loading_animation`.

## 5.11 Product info snippets

Archivo: `composables/CommonComposablesProduct.kt`

- `ProductNameUnityContainer`
- `ProductNameUnityContainerInMyOrder`

## 6. Semántica de estado UI relevante para componentes

## 6.1 `UiType` (`domain/enums/UiType.kt`)

- `INFO`
- `ERROR`
- `WARNING`

Uso principal: tipado de intención visual para botones y diálogos.

## 6.2 `UiError` (`presentation/state/UiError.kt`)

- Modelo mínimo para validación de campos.
- Compatibilidad actual: `hasError == !isVisible`.

## 7. Assets del design system

Recursos relevantes en `presentation/src/main/res`:

- Fonts:
- `font/cabinsketch_regular.ttf`
- `font/cabinsketch_bold.ttf`
- Imágenes:
- `mipmap/product_no_available.webp`
- `mipmap/firstscreenn.webp`
- Lottie:
- `raw/loading_animation.json`

## 8. Reglas de implementación (para repo nuevo)

- Usar siempre `Screen { ReguertaScaffold { ... } }` como estructura base.
- No hardcodear tamaños de fuente: usar roles tipográficos.
- No hardcodear spacing/radius/sizes fuera de `Dimens`.
- Derivar estilos de botón/diálogo desde `UiType`.
- En contenido de componentes que ya definen colores, usar `Color.Unspecified`.
- Mantener `ReguertaTheme` como único entry point de tema.

## 9. API pública recomendada para exportar

Si se extrae a un módulo de design system compartido, exportar como superficie mínima:

- Theme:
- `ReguertaTheme`
- `ReguertaTypography`
- `Dimens`
- Tokens de color de marca (opcional, si se desea exponer).
- Layout:
- `Screen`
- `ReguertaScaffold`
- Components:
- `ReguertaTopBar`
- `ReguertaHomeTopBar`
- `ReguertaButton`
- `ReguertaFullButton`
- `ReguertaFlatButton`
- `InverseReguertaButton`
- `ReguertaOrderButton`
- `ReguertaIconButton`
- `ReguertaInput` wrappers (`ReguertaEmailInput`, `ReguertaPasswordInput`, `TextReguertaInput`)
- `CustomTextField`
- `CustomPhoneNumberInput`
- `ReguertaAlertDialog`
- `ReguertaCard`
- `ReguertaCheckBox`
- `ReguertaCounter`
- `DropdownSelectable`
- `ReguertaDivider` + variantes
- `ImageUrl`
- `ProductImage`
- `LoadingAnimation`
- Text primitives:
- `TextRegular`
- `TextBody` (ambas sobrecargas)
- `TextTitle` (ambas sobrecargas)
- `HeaderSectionText`
- `StockProductText`
- `StockOrderText`
- `AmountText`

## 10. Exclusiones explícitas (no usar en nueva base)

- `NavigationDrawerInfo` (deprecado en navegación).
- Parámetros legacy de `InverseReguertaButton`: `borderSize`, `cornerSize`.
- Patrón de tamaño por `textSize` como API principal en textos; usar `style`.

## 11. Checklist de aceptación de implementación

- Existe `ReguertaTheme` aplicando colorScheme y typography.
- Existe `Dimens` con `Spacing`, `Border`, `Radius`, `Size`, `Components`.
- Existe catálogo de composables base con las firmas actuales.
- Todos los formularios muestran error solo tras interacción (`touched`).
- Botones y diálogos respetan semántica `UiType`.
- El repo nuevo no introduce dependencias a APIs deprecadas.
