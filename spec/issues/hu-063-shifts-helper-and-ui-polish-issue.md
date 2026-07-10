# [HU-063] Corregir ayudante de reparto y pulir UI de turnos

## Summary

Ajustar la pantalla de turnos para que iOS calcule el ayudante de reparto igual que Android y aplicar retoques visuales de paridad en ambas apps.

## Links
- GitHub Issue: #163
- URL: https://github.com/JFrancoG/ReguertaPlus/issues/163
- Pull Request: #164 https://github.com/JFrancoG/ReguertaPlus/pull/164
- Spec: spec/shifts/hu-063-shifts-helper-and-ui-polish/spec.md
- Plan: spec/shifts/hu-063-shifts-helper-and-ui-polish/plan.md
- Tasks: spec/shifts/hu-063-shifts-helper-and-ui-polish/tasks.md

## Acceptance criteria

- iOS y Android muestran como ayudante a la persona que sera encargada en el siguiente reparto, sin depender del campo persistido; solo la ultima semana sin siguiente reparto queda pendiente.
- "Mis proximos turnos" / "My next shifts" mantiene la semana de ayudante asociada al siguiente turno de encargado aunque el dia de reparto ya haya pasado.
- Las fechas de las tarjetas quedan centradas en vertical respecto a los nombres y los nombres largos reciben mas ancho util.
- El bloque "Mis proximos turnos" / "My next shifts" queda centrado, con fuente ligeramente mas pequena y peso regular.
- "Solicitar cambio" / "Request swap" se muestra como boton centrado y con el estilo ya usado en Android.
- En turnos de mercado, el mes se muestra como tres iniciales y ano, por ejemplo "Mar 2026".
- El titulo principal "Turnos" / "Shifts" aparece debajo de la flecha de vuelta en ambas plataformas.

## Scope

### In Scope
- Pantallas de turnos Android e iOS.
- Logica iOS de ayudante/encargado de reparto.
- Formato de cabeceras de turno de mercado.
- Specs y mirror de issue bajo `spec/`.

### Out of Scope
- Cambios en persistencia de solicitudes de cambio.
- Cambios en la sincronizacion de Google Sheets o Firestore.
- Redisenar la arquitectura general de turnos.

## Implementation checklist
- [x] Crear rama y artefactos HU/spec/plan/tasks.
- [x] Revisar logica actual de turnos en iOS y Android.
- [x] Corregir calculo iOS de ayudante de reparto con calendario de reparto.
- [x] Pulir jerarquia visual en ambas apps.
- [x] Validar con fixtures/datos reales del 8 y 15 de julio de 2026.
- [x] Ejecutar validacion relevante por plataforma o documentar bloqueos.

## Suggested labels
- type:feature
- area:shifts
- platform:cross
- priority:P2
