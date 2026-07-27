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
- [`color-tokens.json`](../../docs/design-system/color-tokens.json): fuente de verdad legible por maquina para colores semanticos y sus mapeos por plataforma.
- [`color-catalog.html`](../../docs/design-system/color-catalog.html): catalogo visual generado y autocontenido; no se edita a mano.
- `components.md`: catalogo de componentes cross-platform y matriz de paridad.
- `governance.md`: ciclo de vida (`experimental -> candidate -> stable -> deprecated`) y proceso de cambios.
- `migration-backlog.md`: trabajo priorizado para pasar del estado actual a un design-system limpio.
- `source-snapshots/`: referencias importadas del sistema actual Android/iOS.

## Como usar esta carpeta

1. Leer `foundations.md` antes de crear tokens o estilos.
2. Revisar `components.md` antes de crear APIs nuevas de componentes.
3. Si el cambio es no trivial, actualizar decision log en `governance.md` y el `migration-backlog.md`.
4. Mantener `docs` y `docs-es` alineados.

## Catalogo de color

El catalogo pertenece a la documentacion, no al bundle de ninguna app. Los colores de produccion siguen viviendo en Assets/Swift en iOS y en los tokens de tema Android; el generador comprueba esas fuentes contra el contrato compartido antes de producir el HTML.

Regenerar despues de cambiar el contrato o un color de produccion mapeado:

```sh
python3 scripts/design-system/generate_color_catalog.py
```

Comprobar paridad de fuentes y detectar un HTML desactualizado sin modificarlo:

```sh
python3 scripts/design-system/generate_color_catalog.py --check
```

## Limites de alcance

En alcance:

- Foundations visuales (color, tipografia, spacing, shape, elevacion, iconografia).
- Primitivas reutilizables y contratos compartidos de componentes.
- Naming y gobernanza del ciclo de vida.

Fuera de alcance:

- Comportamiento funcional de features.
- Reglas de negocio.
- Arquitectura de navegacion.
