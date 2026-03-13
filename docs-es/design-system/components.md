# Components

Este catálogo define el contrato actual de componentes y su estado de paridad para auth/onboarding.

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
| Input/Auth field | `ReguertaInputField` | `ReguertaInputField` | Label, placeholder, helper/error text, trailing action, estados focus/disabled/error | stable | `keyboardType` expuesto en ambas plataformas |
| Feedback inline | `ReguertaInlineFeedback` + `ReguertaFeedbackKind` | `ReguertaInlineFeedback` + `ReguertaFeedbackKind` | Mensajes reutilizables de info/warning/error | stable | Uso en auth shell y zonas de feedback |

## 3. Referencia de uso en Auth

Flujo de referencia implementado de extremo a extremo con los componentes V1:

- Android: `presentation/access/ReguertaRoot.kt`
  - Splash usa `ReguertaCard`.
  - Welcome usa `ReguertaCard` + `ReguertaButton`.
  - Login usa `ReguertaCard`, `ReguertaInputField`, `ReguertaInlineFeedback`, `ReguertaButton`.
  - Registro usa `ReguertaCard`, `ReguertaInputField`, `ReguertaButton`.
  - Recuperar usa `ReguertaCard`, `ReguertaInputField`, `ReguertaButton`.
- iOS: `ContentView.swift`
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
- iOS input: `DesignSystem/Components/ReguertaInputField.swift`
- Android mapeo auth: `presentation/access/AuthErrorMapping.kt`
- iOS mapeo auth: `Presentation/Access/AuthErrorMapping.swift`

## 5. Reglas de contrato

- Definir APIs por comportamiento y estados explícitos, no por contexto de una pantalla concreta.
- Mantener `enabled`, `disabled`, `loading`, `focus` y `error` visibles en el contrato del componente.
- Consumir solo theme/tokens semánticos. Evitar colores y medidas hardcodeadas en vistas de feature.

## 6. Exclusiones legacy explícitas

- Android `NavigationDrawerInfo` (deprecated).
- Android params legacy en `InverseReguertaButton` (`borderSize`, `cornerSize`).
- iOS `SimpleDialogView` y helpers de texto sin uso.
