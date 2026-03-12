# Design System Actual — Regüerta iOS

> Documento basado en el estado real del código SwiftUI actual del proyecto.
> Objetivo: servir como base para iniciar el design-system desde cero en otro repo, sin arrastrar legacy.

## 1) Alcance y criterio

Este documento incluye únicamente:
- tokens visuales activos (color, tipografía, sizing responsivo, iconografía),
- estilos y componentes efectivamente usados en pantallas activas,
- clases/enums de soporte que forman parte del sistema de diseño.

Este documento excluye explícitamente piezas sin uso real en flujo actual (se listan al final en `10) Exclusiones (legacy/no usado)`).

## 2) Fuentes de verdad (source of truth)

### 2.1 Assets
- `Reguerta/Common/Assets.xcassets/AccentColor.colorset`
- `Reguerta/Common/Assets.xcassets/Colors/*.colorset`
- `Reguerta/Common/Assets.xcassets/Reguerta/logo.imageset`
- `Reguerta/Common/Assets.xcassets/Reguerta/productNoAvailable.imageset`

### 2.2 Fuentes
- `Reguerta/Common/Fonts.swift`
- `Reguerta/Info.plist` (`UIAppFonts`)

### 2.3 Estilos base
- `Reguerta/Common/Styles/ButtonStyles.swift`
- `Reguerta/Common/Styles/ImageStyles.swift`
- `Reguerta/Common/Styles/ViewStyles.swift`
- `Reguerta/Common/Views/*/*Styles.swift`

### 2.4 Sistema responsivo
- `Reguerta/Common/Constants.swift`
- `Reguerta/Common/Extensions/ExtensionsNumbers.swift`
- `Reguerta/Common/GlobalFiles/DimConfig.swift`

## 3) Tokens

## 3.1 Color tokens (activos)

| Token | Light | Dark | Uso principal |
|---|---|---|---|
| `accentColor` | `#6DA539` | `#6DA539` | CTA primario, acentos, bordes activos |
| `mainBackF2F8E10F1D0D` | `#F2F8E1` | `#0F1D0D` | fondo principal de pantallas |
| `secBackDDE5C01A2B1B` | `#DDE5C0` | `#1A2B1B` | fondo secundario, paneles, side menu |
| `textColor2A3B2AD1E1D1` | `#2A3B2A` | `#D1E1D1` | texto principal |
| `errorB04B4B` | `#B04B4B` | `#B04B4B` | error/destructivo |
| `warningEB6200` | `#EB6200` | `#EB6200` | warning / stock bajo |
| `dialogBack` | `rgba(147,142,142,0.40)` | `rgba(254,255,255,0.13)` | scrim/overlay de diálogo |
| `slimShadow` | `rgba(0,0,0,0.20)` | `rgba(255,255,255,0.20)` | sombras ligeras |

## 3.2 Color token no activo (no usar)

| Token | Estado |
|---|---|
| `textFullBtn2B3809` | Asset existente sin uso real |

## 3.3 Tipografía

### Familias declaradas en app
- `CabinSketch-Bold.ttf`
- `CabinSketch-Regular.ttf`
- `Montserrat-Bold.ttf`
- `Montserrat-Regular.ttf`

### API de fuentes (`RGFont`)

| API | Familia | Estado |
|---|---|---|
| `RGFont.cSketchBold(size:)` | `CabinSketch-Bold` | Activo y estándar actual |
| `RGFont.cSketchRegular(size:)` | `CabinSketch-Regular` | Activo y estándar actual |
| `RGFont.montRegular(size:)` | `Montserrat-Regular` | Definida pero no usada |
| `RGFont.montBold(size:)` | `Monserrat-Bold` (typo en nombre) | Definida, no usada, no fiable |

### Escala tipográfica real (referencias frecuentes)
- `12` labels de input / texto auxiliar.
- `14-16` texto secundario / descripciones.
- `18-20` títulos de bloque / celdas.
- `22-24` títulos de sección/dialog/header.
- `26+` cifras y totales destacados.

> Todas las tallas pasan por `.resize` (sistema responsivo propio), no por Dynamic Type.

## 3.4 Iconografía

### Catálogo base (`RGImage`)
- Comunes (SF Symbols): `arrow.backward`, `xmark`, `info`, `exclamationmark`, `pencil`, `trash`, `cart`, `cart.fill`, `cart.badge.plus`, `plus`, `minus`, `basket`, etc.
- Side menu: `house`, `list.bullet.circle`, `shippingbox`, `person.crop.circle`, `newspaper`, `gearshape`, `rectangle.portrait.and.arrow.right`.
- Branding: `logo`.

## 3.5 Sizing responsivo

### Base
- `Constants.widthPtBase = 375`.

### Regla de escala

| Ancho dispositivo | Factor aplicado |
|---|---|
| `< 600` | `ratio = width / 375` |
| `600..<800` | `1.4` |
| `800..<1000` | `1.5` |
| `>= 1000` | `1.7` |

### Helpers
- `Int.resize`, `CGFloat.resize`.
- `Int.resizeBottomSize` (añade safe area inferior).
- `Int.resizeStatusBarSize` (añade altura de status bar).

## 3.6 Radios, contornos y sombras (patrones actuales)

| Elemento | Valor típico |
|---|---|
| Botón principal | radio `24.resize` |
| Celdas/tarjetas | radio `16.resize` |
| Botón icon-only cell action | radio `8.resize` |
| Diálogo icon badge | radio `18` / `44` combinados |
| Bordes activos | `1-2.resize` |
| Sombra ligera bottom bar | `slimShadow` + radio `3.resize` |

## 4) Primitive styles (activos)

## 4.1 Button styles (`ButtonStyles.swift`)

### `FullStyle`
- Variante principal (filled).
- Soporta flags: `disabled`, `isDialog`, `twoButtons`, `error`.
- Ancho dinámico según contexto (normal vs diálogo 1/2 botones).

### `FlatStyle`
- Variante secundaria/outline.
- Soporta `disabled`, `isDialog`, `twoButtons`, `error`.

### `MainStyle`
- Botones grandes de Home.
- Incluye estado `disabled` con icono lock embebido.

### `CartStyle`
- Botón “Ver carrito”.

### `ShoppingCartStyle`
- Botón “Seguir comprando” en panel carrito.

### `AvailableStyle`
- Toggle visual para disponibilidad masiva productor.

## 4.2 Image styles (`ImageStyles.swift` + extensiones por módulo)

- `imageBackStyle()`.
- `imgEditCellStyle(disabled:)`.
- `imgDeleteCellStyle()`.
- `imgSplashStyle(anim:)`.
- `imgSideMenuStyle()`.
- `iconSideMenuItemStyle()`.
- `imgProfileSideMenuStyle()`.
- `imgProductCellStyle()`.
- `imgProductNewStyle()`.
- `iconInputStyle()`.
- `iconStyle(type:)` para diálogos.

## 4.3 View modifiers compartidos (`ViewStyles.swift`)

- `backgroundViewStyle()`.
- `titleDialogViewStyle()`.
- `contentDialogViewStyle()`.
- `backgroundCellViewStyle()`.
- `progressStyle(size:color:)`.

## 4.4 Header/Input/Dialog/AddBottom modifiers

- `titleStyle()` (header principal).
- `nameInputStyle(color:)`, `errorInputStyle()`.
- `titleDialogStyle()`, `contentDialogStyle()`.
- `backAddBtnBottomViewStyle()`.

## 5) Componentes UI (activos)

## 5.1 `HeaderView`

**Propósito**: cabecera estándar de pantalla.

**API**:
- `HeaderView(title: String, imgBack: Bool = true)`.

**Composición**:
- `HeaderBackButtonView` + título con `titleStyle()`.

## 5.2 `HeaderBackButtonView`

**Propósito**: navegación back estándar.

**Comportamiento**:
- Usa `@Environment(\.dismiss)`.
- Icono `RGImage.Common.sysBack`.

## 5.3 `AddButtonBottomView`

**Propósito**: CTA fijo inferior para acciones de alta/continuación.

**API**:
- `title: String`
- `@Binding clicked: Bool`

**Comportamiento**:
- Al pulsar, pone `clicked = true`.
- Back panel secundario con bordes superiores redondeados.

## 5.4 `CheckBoxView`

**Propósito**: checkbox reusable simple.

**API**:
- `@Binding checked: Bool`
- `isBlocked: Bool = false`

**Comportamiento**:
- Toggle por tap, bloqueable vía `isBlocked`.

## 5.5 `InputView`

**Propósito**: sistema de campo de formulario con validación visual + error inline.

**API**:
- `inputVM: InputVM`
- `type: InputType`

**Tipos soportados (`InputType`)**:
- `.email`, `.password`, `.repeatPass`, `.authEmail`, `.userName`, `.userSurname`, `.companyName`, `.productName`, `.productDescription`, `.price`.

**Características**:
- Label + campo + divider reactivo por estado.
- Icon button derecho contextual (clear / eye / eye.slash).
- Mensaje de error bajo el campo.
- Gestión de foco mediante `InputVM.hasFocus`.

## 5.6 `CustomTextField` (UIKit bridge)

**Propósito**: entrada numérica/decimal con toolbar y botón “Cerrar”.

**API**:
- `isInput: Bool = false`
- `placeholder: String`
- `@Binding text: String`
- `onSubmit: (() -> Void)?`

**Características**:
- `decimalPad` para input de precio (`isInput = true`).
- `numberPad` para campos de cantidad.
- Toolbar con botón custom “Cerrar”.
- Formateo a 2 decimales al finalizar edición cuando `isInput = true`.

## 5.7 `GenericDialogView`

**Propósito**: modal genérico de confirmación/feedback.

**API**:
- `type: DialogType` (`.info` / `.error`)
- `title: String`
- `content: String`
- `primaryButton: DialogButton?`
- `secondaryButton: DialogButton?`

**Comportamiento**:
- Scrim `dialogBack`.
- Iconografía y color según tipo.
- Composición de botones automática (1 o 2 acciones).

## 5.8 Componentes de pedidos/productos reutilizados intensivamente

- `URLImage`: carga remota con fallback local `productNoAvailable`.
- Celdas base apoyadas en `backgroundCellViewStyle()`.
- `ProductDetailQuantityView`: patrón de detalle envase+unidad.
- `UnitsOrderedView` + `OrderBtnIncrement/Decrement`: control estandarizado de cantidades.

## 6) Clases y enums del design-system (actuales)

## 6.1 Tokens y sistema base
- `RGFont`.
- `RGImage`.
- `RGString`.
- `Constants`.
- `DimConfig`.

## 6.2 Estado visual y validación de inputs
- `InputVM`.
- `InputModel`.
- `InputType`.
- `InputError`.
- `RGRegex` + extensiones de validación en `String`.

## 6.3 Diálogos
- `DialogType`.
- `DialogButton`.
- `GenericDialogVM` / `GenericDialogModel`.
- `SimpleDialogVM` / `SimpleDialogModel` (no activo en flujo principal, ver exclusiones).

## 6.4 Header y checkbox
- `HeaderBackButtonVM` / `HeaderBackButtonModel`.
- `CheckBoxVM` / `CheckBoxModel`.

## 7) Patrones de interacción y estados

## 7.1 Estados visuales comunes
- `disabled`: desatura color + bloquea hit-testing en botones.
- `error`: fondo/borde rojo (`errorB04B4B`) en botones y diálogos.
- `focus`: color de label/divider de input cambia a `accentColor`.

## 7.2 Stock semantic state
- `stock == 0`: error rojo.
- `stock 1...10`: warning naranja.
- `stock > 10`: texto normal.
- En una variante de lista, stock > 20 puede ocultarse (`.clear`).

## 7.3 Jerarquía visual
- Fondo principal claro/oscuro de alto contraste suave.
- CTA principal siempre filled (`FullStyle`).
- Acciones secundarias y cancelar con `FlatStyle`.
- Acciones destructivas con icono rojo y confirmación dialog.

## 8) Guía de portabilidad a nuevo repo

## 8.1 Orden recomendado de migración
1. Migrar tokens (`xcassets` + `RGFont` + `RGImage` + `RGString`).
2. Migrar sistema responsivo (`resize`, `DimConfig`, `Constants`).
3. Migrar primitives (`ButtonStyles`, `ImageStyles`, `ViewStyles`).
4. Migrar componentes base (`HeaderView`, `InputView`, `GenericDialogView`, `CheckBoxView`, `CustomTextField`, `AddButtonBottomView`).
5. Migrar componentes feature-level (celdas de producto/pedido) sólo si siguen siendo parte del alcance.

## 8.2 Convenciones recomendadas para el nuevo repo
- Mantener nombres semánticos de tokens (evitar nombres por hex en nuevos tokens).
- Separar “foundation” de “feature components”.
- Añadir tests snapshot/UI para los componentes base.
- Añadir catálogo visual (Storybook SwiftUI o pantalla interna de componentes).

## 9) Observaciones técnicas actuales (importantes)

- El proyecto usa escala manual `.resize`; no hay adopción formal de Dynamic Type en componentes base.
- `CustomTextField` referencia `UIColor(named: "text_2B3809_FFFFFF")`, pero ese asset no existe con ese nombre en el catálogo actual.
- La función `RGFont.montBold` usa `"Monserrat-Bold"` (typo), por lo que no debe considerarse parte estable del DS.

## 10) Exclusiones (legacy/no usado)

Estos elementos existen en código pero no forman parte del design-system actual operativo:

- Tipografías API no usadas:
- `RGFont.montBold(size:)`
- `RGFont.montRegular(size:)`

- Estilos no usados:
- `textFieldsLoginStyle()`
- `textErrorLoginStyle()`
- `textCheckBoxRegisterStyle()`
- `textUserNotAuthRegisterStyle()`
- `textErrorCreatingUserRegisterStyle()`
- `quantityProductNewStyle()`
- `iconCloseStyle()`

- Componentes no usados en flujo principal:
- `SimpleDialogView`
- `DismissView`

- Token sin uso:
- `textFullBtn2B3809`

## 11) Checklist mínimo para “arranque limpio” en el nuevo repo

- [ ] Definir package/module `DesignSystem` con estructura `Tokens`, `Styles`, `Components`.
- [ ] Copiar y validar colores activos (`accent`, `mainBack`, `secBack`, `textColor`, `error`, `warning`, `dialogBack`, `slimShadow`).
- [ ] Registrar y validar fuentes `CabinSketch` como primarias.
- [ ] Reimplementar `FullStyle`, `FlatStyle`, `MainStyle` y `GenericDialogView` primero.
- [ ] Reimplementar `InputView` + `InputVM` + validaciones regex.
- [ ] Migrar `resize` si se desea mantener el mismo comportamiento responsive.
- [ ] Excluir desde inicio todos los elementos listados en `10)`.
