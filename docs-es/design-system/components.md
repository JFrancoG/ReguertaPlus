# Components

Este catalogo define intencion compartida y estado de paridad.

## 1. Leyenda de estado

- `stable`: listo como default para features nuevas.
- `candidate`: casi alineado, pendiente de normalizacion.
- `experimental`: util, pero API/naming puede cambiar.
- `deprecated`: no usar en codigo nuevo.

## 2. Matriz cross-platform

| Componente | Android | iOS | Intencion compartida | Estado | Notas |
|---|---|---|---|---|---|
| Theme wrapper | `ReguertaTheme` | estilos/tokens globales app | Baseline visual global | candidate | Falta alinear naming |
| Screen scaffold | `Screen` + `ReguertaScaffold` | wrappers de vista | Estructura base de pantalla | candidate | Equivalente iOS menos explicito |
| Top bar | `ReguertaTopBar` | `HeaderView` | Titulo + back/acciones | candidate | Normalizar API |
| Buttons | familia `ReguertaButton` | `FullStyle`, `FlatStyle`, `MainStyle` | Acciones primaria/secundaria/destructiva | candidate | Mantener variantes semanticas |
| Inputs | `ReguertaEmailInput`, `ReguertaPasswordInput`, `TextReguertaInput` | `InputView`, `CustomTextField` | Formulario con validacion | candidate | Normalizar modelo de estado |
| Dialogs | `ReguertaAlertDialog` | `GenericDialogView` | Confirmacion/feedback con variantes | candidate | Alinear modelo de botones |
| Card | `ReguertaCard` | estilos wrapper de celdas/vistas | Agrupar contenido relacionado | candidate | Normalizar niveles/tipos |
| Checkbox | `ReguertaCheckBox` | `CheckBoxView` | Seleccion booleana | stable | Baja variacion |
| Counter | `ReguertaCounter` | controles de cantidad | Patron incremento/decremento | candidate | Consolidar reglas disabled |
| Dropdown/select | `DropdownSelectable` | patrones picker custom | Selector de opcion unica | experimental | Definir API compartida |
| Remote image | `ImageUrl`, `ProductImage` | patron `URLImage` | Carga async + fallback | candidate | Estandarizar contrato fallback |
| Loading animation | `LoadingAnimation` | estilos de progreso | Feedback de carga | experimental | Decidir regla lottie vs nativo |

## 3. Reglas de contrato

- Definir APIs por comportamiento y estados, no por contexto de pantalla.
- Mantener `enabled`, `disabled`, `loading`, `error`, `focus` explicitos en contratos.
- Preferir wrappers composables/swiftui frente a duplicar logica visual por feature.

## 4. Exclusiones legacy explicitas

- Android `NavigationDrawerInfo` (deprecated).
- Android params legacy en `InverseReguertaButton` (`borderSize`, `cornerSize`).
- iOS `SimpleDialogView` y helpers de texto sin uso.
