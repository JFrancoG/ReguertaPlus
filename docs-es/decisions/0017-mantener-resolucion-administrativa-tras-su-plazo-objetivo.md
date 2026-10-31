# ADR-0017: Mantener la resolución administrativa tras su plazo objetivo

## Estado

Aceptado para la implementación local de HU-089 el 2026-10-11 por decisión
expresa del mantenedor sobre la resolución administrativa tardía. Siguen
pendientes la ratificación colectiva y la activación compartida.

## Contexto

Los plazos de reserva, voluntariado y sorteo terminan sus fases de búsqueda.
Administración es la última escalada: tratar sus tres días o un día como límite
de permiso impediría resolver por el comando administrativo habitual un turno
futuro todavía vacío, precisamente cuando sigue necesitando intervención.

## Decisión

- Mantener los plazos de reserva, voluntariado y sorteo como límites de cada
  fase completa. Conservar el plazo administrativo original como objetivo de
  gestión: tres días en casos normales y un día en los urgentes. Registrar el
  retraso sin reiniciar ese objetivo ni volver a las fases anteriores.
- Permitir que administración ofrezca y resuelva el caso pendiente después del
  objetivo, mientras el turno siga siendo futuro. Cada oferta conserva su
  vencimiento propio, dentro del máximo configurado para responder y
  estrictamente anterior al turno. El objetivo administrativo no invalida una
  oferta o aceptación que siga cumpliendo sus condiciones.
- Conservar la aceptación expresa antes del vencimiento de la oferta y del
  turno, la elegibilidad vigente, el permiso administrativo y las restricciones
  entre responsable y ayudante y de acumulación. Agotar el objetivo no inventa
  una cobertura ni una realización; los casos sin resolver siguen visibles y
  pendientes.

## Consecuencias

Administración puede resolver un turno futuro aunque vaya con retraso, sin abrir
otro ciclo de búsqueda ni añadir otro mecanismo de plazos. El objetivo original
sigue permitiendo detectar el retraso. La intervención no recupera una oferta
individual vencida ni permite aceptar después de empezar el turno. Esta decisión
local no aprueba la política de la cooperativa ni activa servicios compartidos.

## Trabajo relacionado

- [Especificación HU-089](../../spec/shifts/hu-089-coverage-policy-amendments/spec.md)
- [Propuesta de ratificación D07/D10](../../spec/shifts/hu-084-stable-shift-coverage-and-credits/ratification-es.md)
- Issues GitHub [#279](https://github.com/JFrancoG/ReguertaPlus/issues/279) y [#268](https://github.com/JFrancoG/ReguertaPlus/issues/268)
