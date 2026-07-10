# HU-061 - Confirmar cierre de sesión desde el menú lateral

## Metadata

- issue_id: 159
- priority: P2
- platform: both
- status: implemented

## Context and problem

El menú lateral de Android e iOS expone `Cerrar sesión` como acción de footer. Actualmente el toque ejecuta el cierre de sesión sin confirmación, lo que hace fácil salir por accidente al navegar por el drawer.

Reguerta ya cuenta con un patrón visual de `ReguertaDialog` para confirmaciones e información. Esta historia debe reutilizar ese patrón en ambas plataformas y mantener intacto el flujo de autenticación existente detrás de la acción confirmada.

## User story

Como persona usuaria autenticada, quiero que la opción `Cerrar sesión` del menú lateral me pida confirmación antes de salir para no perder la sesión por un toque accidental.

## Scope

### In Scope

- Interceptar la acción `Cerrar sesión` del menú lateral en Android e iOS.
- Mostrar un `ReguertaDialog` de confirmación con el copy aprobado:
  - título: `Cerrar sesión`,
  - mensaje: `¿Estás seguro que quieres cerrar la sesión?`,
  - secundaria: `Volver`,
  - primaria: `Confirmar`.
- Reutilizar estilos, iconografía y comportamiento de `ReguertaDialog` ya existentes en cada plataforma.
- Ejecutar el sign-out actual solo al confirmar.
- Mantener la sesión activa y cerrar solo el diálogo al cancelar o volver.
- Mantener paridad funcional Android/iOS.

### Out of Scope

- Cambiar Firebase Auth, refresh de sesión, repositorios de autenticación o estado de usuario.
- Rediseñar el drawer completo.
- Modificar reglas de roles/capacidades del menú.
- Crear un nuevo sistema de diálogos.
- Cambiar la navegación posterior al sign-out más allá del comportamiento actual.

## Linked functional requirements

- RF-ROL-03
- RF-ROL-04
- RF-AUT-01

## Acceptance criteria

- Al tocar `Cerrar sesión` en el menú lateral de Android, no se ejecuta el cierre inmediatamente.
- Al tocar `Cerrar sesión` en el menú lateral de iOS, no se ejecuta el cierre inmediatamente.
- Ambas plataformas muestran un `ReguertaDialog` con icono informativo, título `Cerrar sesión`, mensaje `¿Estás seguro que quieres cerrar la sesión?`, botón `Volver` y botón `Confirmar`.
- `Volver` cierra el diálogo y mantiene la sesión activa.
- El dismissal/back del diálogo, cuando la plataforma lo permita, equivale a cancelar y mantiene la sesión activa.
- `Confirmar` invoca el flujo de cierre de sesión existente una sola vez.
- Tras confirmar, la app navega al estado actual de usuario no autenticado.
- El drawer conserva sus reglas de visibilidad por rol y no pierde destinos existentes.
- Android e iOS exponen comportamiento, copy y jerarquía visual equivalentes.

## Dependencies

- HU-039 para el Home shell y drawer base.
- HU-040 para mapa de navegación del drawer.
- HU-023 para comportamiento de ciclo de sesión.
- Componentes `ReguertaDialog` existentes en Android e iOS.

## Risks

- Risk: el sign-out actual está acoplado directamente al botón del drawer.
  - Mitigation: introducir un estado local de confirmación en la capa UI y delegar en el callback existente solo desde la acción primaria.
- Risk: Android e iOS usan APIs de diálogo diferentes.
  - Mitigation: reutilizar los componentes del sistema de diseño de cada plataforma y fijar como contrato el copy/semántica, no una implementación idéntica.
- Risk: tests existentes esperan logout inmediato.
  - Mitigation: actualizar solo los tests de comportamiento del drawer/session para validar cancelación y confirmación explícita.

## Definition of Done (DoD)

- [x] Acceptance criteria validated on Android and iOS.
- [x] Agreed test coverage executed.
- [x] Android/iOS parity reviewed.
- [x] Issue mirror, spec, plan, and tasks updated with validation evidence.
- [x] Known parity gaps, if any, documented in handoff.
