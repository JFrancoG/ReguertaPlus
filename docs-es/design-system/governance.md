# Governance

Este proceso mantiene el design-system util, adaptable y auditable.

## 1. Ciclo de vida

- `experimental`: puede evolucionar rapido.
- `candidate`: validado en pantallas reales, pendiente de cierre de naming/contrato.
- `stable`: default para features nuevas.
- `deprecated`: con ruta de migracion definida; sin uso nuevo.

## 2. Politica de cambios

Todo cambio no trivial de design-system debe incluir:

1. Por que existe el cambio (problema/oportunidad).
2. Impacto en tokens/componentes.
3. Implicaciones cross-platform.
4. Notas de migracion (si rompe o renombra).

## 3. Criterios de aceptacion para `stable`

- Usado en al menos un flujo real Android y uno iOS.
- Naming semantico y no acoplado a una feature.
- Baseline de accesibilidad revisada.
- Documentacion actualizada en `docs` y `docs-es`.

## 4. Compatibilidad hacia atras

- Preferir aliases primero, eliminacion despues.
- Marcar nombres viejos como deprecated antes de borrarlos.
- Registrar retiradas en `migration-backlog.md`.

## 5. Decision log (inicial)

- 2026-03-12: se importan referencias Android/iOS actuales como source snapshots.
- 2026-03-12: se establece estrategia semantic-first para naming y ciclo de vida.
- 2026-03-12: se decide mantener implementacion nativa por plataforma alineando intencion compartida.
