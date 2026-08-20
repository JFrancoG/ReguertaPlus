# Components

Este catálogo define el contrato actual de componentes y su estado de paridad para UI reutilizable de la app.

## 1. Leyenda de estado

- `stable`: listo como valor por defecto para nuevas features.
- `candidate`: casi alineado, pendiente de pulir API.
- `experimental`: útil, pero el naming/API puede cambiar.
- `deprecated`: no usar en código nuevo.

## 2. Core Components V1 (HU-036)

| Componente | Android | iOS | Intención compartida | Estado | Notas |
|---|---|---|---|---|---|
| Card/contenedor | `ui/components/auth/ReguertaCard.kt` | `DesignSystem/Components/ReguertaCard.swift` | Agrupar contenido con surface + borde/radio semánticos | stable | Shell principal de splash/welcome/login/register/recover |
| Button | `ReguertaButton` + `ReguertaButtonVariant` | `ReguertaButton` + `ReguertaButtonVariant` | Modelo unificado primaria/secundaria/texto con loading y disabled | stable | Variantes: `primary`, `secondary`, `text` |
| Botón flotante | `ReguertaFloatingActionButton` | `ReguertaFloatingActionButton` | Acción inferior persistente sobre contenido con scroll, sin franja opaca de footer | stable | Usa el par opaco `actionPrimary`/`actionOnPrimary` en ambas plataformas |
| Input/Auth field | `ReguertaInputField` | `ReguertaInputField` | Label, placeholder, helper/error text, trailing action, estados focus/disabled/error | stable | `keyboardType` expuesto en ambas plataformas |
| Feedback inline | `ReguertaInlineFeedback` + `ReguertaFeedbackKind` | `ReguertaInlineFeedback` + `ReguertaFeedbackKind` | Mensajes reutilizables de info/warning/error | stable | Uso en auth shell y zonas de feedback |
| Card de lista + botones de acción | `ReguertaListItemCard`, `ReguertaEditListActionButton`, `ReguertaDeleteListActionButton` | `ReguertaListItemCard`, `ReguertaListActionIconButton` | Cards reutilizables para listas con paridad de resaltado y acciones editar/eliminar | stable | Usado por productos y regüertenses autorizados; los targets minimos nativos se expresan en unidades de plataforma (44 dp/pt) |

## 3. Referencia de uso en Auth

Flujo de referencia implementado de extremo a extremo con los componentes V1:

- Android: `presentation/root/ReguertaRoot.kt`
  - Splash usa `ReguertaCard`.
  - Welcome usa `ReguertaCard` + `ReguertaButton`.
  - Login usa `ReguertaCard`, `ReguertaInputField`, `ReguertaInlineFeedback`, `ReguertaButton`.
  - Registro usa `ReguertaCard`, `ReguertaInputField`, `ReguertaButton`.
  - Recuperar usa `ReguertaCard`, `ReguertaInputField`, `ReguertaButton`.
- iOS: `Presentation/Root/AuthShellView.swift`,
  `Presentation/Auth/ContentView+AuthRoutes.swift` y
  `Presentation/Auth/ContentView+AuthForms.swift`
  - Splash usa `ReguertaCard`.
  - Welcome usa `ReguertaCard` + `ReguertaButton`.
  - Login usa `ReguertaCard`, `ReguertaInputField`, `ReguertaInlineFeedback`, `ReguertaButton`.
  - Registro usa `ReguertaCard`, `ReguertaInputField`, `ReguertaButton`.
  - Recuperar usa `ReguertaCard`, `ReguertaInputField`, `ReguertaButton`.

## 4. Contrato Input V2 (HU-033)

- Estados canónicos: `default`, `focused`, `error`, `disabled`.
- Icono opcional para borrar valor cuando el campo está editable y no vacío.
- Toggle opcional de visibilidad para campos de contraseña.
- El slot de error inline tiene prioridad sobre el helper.
- Ninguna pantalla debe mostrar texto raw del backend/provider directamente en errores de input.

Referencias actuales:

- Android input: `ui/components/auth/ReguertaInputField.kt`
- iOS input: `DesignSystem/Components/ReguertaInputField/ReguertaInputFieldView.swift`
- Android mapeo auth: `presentation/auth/AuthErrorMapping.kt`
- iOS mapeo auth: `Presentation/Auth/AuthErrorMapping.swift`

## 5. Reglas de contrato

- Definir APIs por comportamiento y estados explícitos, no por contexto de una pantalla concreta.
- Mantener `enabled`, `disabled`, `loading`, `focus` y `error` visibles en el contrato del componente.
- Consumir solo theme/tokens semánticos. Evitar colores y medidas hardcodeadas en vistas de feature.
- Para acciones inferiores sobre listas con scroll, preferir `ReguertaFloatingActionButton` y dar padding inferior explícito al contenido para que pueda pasar por detrás del botón.
- Para filas repetidas con acciones de editar/eliminar, preferir `ReguertaListItemCard` y los botones de acción compartidos antes de añadir estilos locales de feature.

## 6. Exclusiones legacy explícitas

- Android `NavigationDrawerInfo` (deprecated).
- Android params legacy en `InverseReguertaButton` (`borderSize`, `cornerSize`).
- iOS `SimpleDialogView` y helpers de texto sin uso.

## 7. Contrato adaptativo de componentes iOS HU-078

Las APIs de componentes compartidos iOS usan valores pasivos Configuration en
vez de presentar input inmutable como ViewModels:

- `ReguertaButtonConfiguration`
- `ReguertaCardConfiguration`
- `ReguertaDialogConfiguration`
- `ReguertaInlineFeedbackConfiguration`
- `ReguertaInputFieldConfiguration`
- `ReguertaScreenHeaderConfiguration`

El contrato de componentes es:

- Las variantes de Button, acciones de Header, acciones de lista, Floating
  Action Button, acciones/cierre de Dialog y acciones clear/password de Input
  componen una region tactil minima de 44 por 44 puntos.
- Card, Inline Feedback, Input, Header, List Item, Dialog, Button y Scaffold
  consumen valores semanticos de spacing, radio, icono, layout, tipografia, color
  y movimiento. El codigo de feature no usa escalado `.resize*` derivado del
  ancho.
- Input conserva sin transformar el contenido localizado de su label para
  accesibilidad; no aplica mayusculas al string semantico localizado.
- `ReguertaScreenScaffold` recibe el ancho del contenedor actual, limita el
  contenido legible a 720 puntos, posee el header/top inset y admite contenido
  inferior explicito del shell. Cada ruta sigue siendo propietaria de su scroll
  y bottom inset especifico bajo ADR-0005.
- El movimiento material lee `ReguertaMotionPolicy` desde la raiz; los cambios
  de estado esenciales siguen visibles con Reduce Motion activado.
- Los componentes compartidos ofrecen previews deterministas de estados
  disabled, loading, error, texto largo, acciones, contenedor compacto/regular,
  locale, apariencia, contraste y Dynamic Type cuando corresponde.

La evidencia actual incluye 30 previews de DesignSystem y 26 previews
deterministas de rutas community/operations. Release y los recorridos UI
compactos estan verdes. El 2026-08-20 el mantenedor completo una aceptacion
manual acotada para el MVP con navegacion/acciones representativas de VoiceOver
y Voice Control, controles muestreados mediante Accessibility Inspector y una
comparacion interactiva Reduce Motion off/on. Todo se comporto correctamente;
las previews no sustituyen los checks runtime ni esto afirma cobertura
exhaustiva.

HU-078 no cambio componentes Android. La paridad Android queda como seguimiento
y debe preservar estos contratos semanticos y de comportamiento mediante APIs
adaptativas nativas de Android.
