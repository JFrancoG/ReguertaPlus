# [HU-062] Pulir cards de pedidos Android con paridad iOS

## Summary

Ajustar las pantallas Android de `Mi último pedido` y `Todos mis pedidos` para que las cards de resumen de pedido usen el fondo verde del diseño iOS, el título principal quede limpio bajo la flecha de volver y las filas de producto se formateen con una estructura visual equivalente a iOS.

## Links
- GitHub Issue: #161
- URL: https://github.com/JFrancoG/ReguertaPlus/issues/161
- Spec: spec/orders/hu-062-android-order-card-polish/spec.md
- Plan: spec/orders/hu-062-android-order-card-polish/plan.md
- Tasks: spec/orders/hu-062-android-order-card-polish/tasks.md

## Acceptance criteria

- Las cards de productores en Android dejan de usar el fondo gris/morado actual y pasan a un contenedor verde alineado con iOS.
- `Mi último pedido` muestra solo el título principal de la pantalla bajo la flecha de volver, sin duplicar un título de shell tipo `Order`.
- `Mi último pedido` no muestra una línea secundaria con el week key (`Semana 2026-Wxx`).
- `Todos mis pedidos` conserva el rango/selector semanal y usa el mismo patrón de card y filas que `Mi último pedido`.
- En `Todos mis pedidos`, el rango `Pedido dd MMM - dd MMM` se muestra dentro de la pantalla bajo la flecha de volver, no como título centrado del top bar.
- Las flechas y el selector semanal usan superficies verdes del tema, sin caer en el `primaryContainer` morado.
- Cada fila de producto se organiza con descripción a la izquierda, cantidad centrada y precio a la derecha, con separadores verticales/horizontales equivalentes al layout iOS.
- La descripción de envase muestra `(cantidad envase si != 1) envase cantidad medida medida`, no vuelve a usar el envase como unidad de medida.
- La corrección no cambia lecturas Firestore, histórico semanal ni cálculos de total.

## Scope

### In Scope
- Android, pantallas de pedidos personales.
- Reutilización del componente visual de resumen de pedido cuando sea posible.
- Specs y mirror de issue bajo `spec/`.

### Out of Scope
- Cambios iOS.
- Cambios backend/Firestore.
- Rediseño global de navegación.

## Implementation checklist
- [x] Crear artefactos HU/spec/plan/tasks.
- [x] Ajustar componente Android de cards de resumen.
- [x] Ajustar título principal en `Mi último pedido`.
- [x] Validar unit tests/lint Android relevantes.

## Suggested labels
- type:feature
- area:orders
- platform:android
- priority:P2
