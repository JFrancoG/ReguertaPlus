# ADR-0015: Registrar el ciclo explícito de pertenencia en coberturas

## Estado

Aceptado para la implementación local de HU-089 el 2026-10-11 por la instrucción
del mantenedor de implementar la salida de reserva y las compensaciones por baja
permanente. La ratificación colectiva y la activación compartida siguen pendientes.

## Contexto

`isActive` no distingue una suspensión temporal de una baja permanente.
Las coberturas cambian quién hace el turno, pero conservan su propietario ordinario.
El reingreso conserva también posiciones congeladas anteriores. Cancelar créditos
por inactividad, usar los asignados efectivos o una frontera de incorporación
variable haría perder saldos válidos o terminaría la nueva reserva en el turno erróneo.

## Decisión

- Reutilizar la reconciliación administrativa de pertenencia. Una declaración
  `permanentDepartureReason` exige un socio inactivo/ausente y un administrador
  actual. Conservar operación, motivo y hora del servidor; la inactividad por sí
  sola conserva los créditos. La reactivación elimina la declaración actual y
  conserva su recibo y los créditos ya anulados.
- Fijar `admissionAfterRound` en cada entrada HU-089 en reserva. Solo una posición
  ordinaria publicada de ese tipo, posterior a esa frontera y a la entrada,
  termina la reserva al llegar su fecha. Las ayudas y sustituciones no cuentan.
- Usar el mismo criterio de vencimiento al elegir reservas, aceptar sus ofertas y
  proyectar los datos móviles. La reconciliación registra la salida y el turno
  ordinario que la justifica. La seguridad no depende de ejecutar puntualmente
  un proceso programado o una acción administrativa.
- Anular solo créditos pendientes, conservando el servicio que los originó.
  Liberar su bloqueo y avanzar una vez el libro de cada tipo afectado en la misma
  transacción que la pertenencia, las reservas y su recibo. El historial realizado
  y los créditos utilizados se conservan.
- Una finalización registrada más tarde conserva el servicio con un crédito ya
  anulado mientras aplique la declaración de baja permanente. La hora de
  pertenencia y las comprobaciones de fuentes, libros e inversa impiden recuperar
  saldo anulado o escribir desde una operación antigua.

## Consecuencias

Los ensayos existentes `fifo-signup-v1` mantienen su comportamiento. Una reserva
antigua activa sin frontera de entrada no se puede deducir bajo HU-089: se rechaza
su procesamiento hasta disponer de evidencia autorizada de migración. Ambas
apps distinguen crédito anulado y utilizado. La interfaz administrativa y la
activación compartida siguen en la integración pendiente de HU-084; este contrato
local no añade un escritor público, proceso programado ni migración de producción.

## Trabajo relacionado

- [ADR-0013](0013-modelar-turnos-como-rotaciones-continuas-con-proyecciones-estacionales.md)
- [Especificación HU-089](../../spec/shifts/hu-089-coverage-policy-amendments/spec.md)
- GitHub issues [#279](https://github.com/JFrancoG/ReguertaPlus/issues/279) y [#268](https://github.com/JFrancoG/ReguertaPlus/issues/268)


## Integración administrativa nativa — 2026-10-26

HU-084 expone esta política existente mediante proyecciones solo para
administradores y comandos tipados separados en ambas apps Debug de ensayo. La
escritura local autenticada resuelve el vínculo UID/socio y los permisos dentro
de la transacción, también al repetir una operación. Un token de confirmación
vincula las versiones de la ficha, las compensaciones y la planificación; una
confirmación desactualizada se rechaza sin cambios. La repetición exacta devuelve
el resultado original manteniendo la comprobación de permisos actuales.

Los formularios observan la actividad de la cuenta sin modificarla. Actualizar
la situación deriva los cambios de reserva; la baja permanente exige una
confirmación separada y un motivo. Las lecturas muestran cantidades y estado,
nunca motivos privados ni documentos de compensaciones o bloqueos. La integración
sigue siendo local y provisional; quedan la ratificación y la activación compartida.
