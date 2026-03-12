# Design System

Esta carpeta define una base viva del design-system para Reguerta.

Objetivo: dar direccion compartida a Android e iOS sin congelar la evolucion del producto.

## Principios de trabajo

- Usarlo como guia, no como corset.
- Priorizar naming semantico por encima de la historia de implementacion.
- Buscar paridad entre plataformas en foundations e intencion, no en copia pixel-perfect.
- Preferir migracion incremental frente a reescrituras masivas.
- Mantener espacio para experimentacion de producto (estado `experimental`) antes de estandarizar.

## Estructura

- `foundations.md`: modelo canonico de tokens y politica de naming.
- `components.md`: catalogo de componentes cross-platform y matriz de paridad.
- `governance.md`: ciclo de vida (`experimental -> candidate -> stable -> deprecated`) y proceso de cambios.
- `migration-backlog.md`: trabajo priorizado para pasar del estado actual a un design-system limpio.
- `source-snapshots/`: referencias importadas del sistema actual Android/iOS.

## Como usar esta carpeta

1. Leer `foundations.md` antes de crear tokens o estilos.
2. Revisar `components.md` antes de crear APIs nuevas de componentes.
3. Si el cambio es no trivial, actualizar decision log en `governance.md` y el `migration-backlog.md`.
4. Mantener `docs` y `docs-es` alineados.

## Limites de alcance

En alcance:

- Foundations visuales (color, tipografia, spacing, shape, elevacion, iconografia).
- Primitivas reutilizables y contratos compartidos de componentes.
- Naming y gobernanza del ciclo de vida.

Fuera de alcance:

- Comportamiento funcional de features.
- Reglas de negocio.
- Arquitectura de navegacion.
