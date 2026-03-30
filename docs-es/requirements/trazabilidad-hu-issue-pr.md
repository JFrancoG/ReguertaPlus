# Trazabilidad HU / Issue / PR

Fecha: 2026-03-30

## Proposito

Este documento facilita seguir el historico cuando las historias de hoja de ruta (`HU-xxx`) no coinciden con la numeracion de issues o PRs de GitHub.

## Regla

- `HU-xxx` es el identificador canonico de roadmap.
- Los numeros de issue y PR de GitHub son identificadores por orden de creacion y no tienen por que coincidir con la HU.
- El titulo de la issue y de la PR debe empezar siempre por la `HU-xxx` canonica.
- Si una HU nueva colisiona con un id historico antiguo, se renumera la historia nueva en lugar de reutilizar el id.

## Mapeo normalizado actual

| HU roadmap | Alcance | GitHub issue | GitHub PR | Estado |
| --- | --- | --- | --- | --- |
| HU-021 | Control remoto de version en arranque | n/a | #51 | mergeada |
| HU-022 | Frescura de datos criticos antes de pedido | n/a | #52 | mergeada |
| HU-023 | Refresco de sesion por lifecycle y UX de expiracion | n/a | #53 | mergeada |
| HU-038 | Home restringido para usuario autenticado no autorizado | #54 | #55 | mergeada |
| HU-039 | Shell del home con drawer y navegacion por rol | #56 | n/a | en curso |

## Nota historica

- El trabajo historico previo de auth/diseno ya consumio ids en el rango `HU-027..HU-037` dentro del historial de GitHub.
- Para preservar trazabilidad, las historias actuales de acceso/home se han renumerado a `HU-038` y `HU-039` en vez de reescribir artefactos historicos ya mergeados.
