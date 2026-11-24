# ADR-0019: Coordinar proyecciones y notificaciones de coberturas

## Estado

Aceptado para la implementación autorizada el 2026-10-27. La activación
compartida sigue cerrada según ADR-0018.

## Contexto

Coberturas conserva el marcador histórico de planificación del turno público.
Su evento Firestore también entraba en el exportador ordinario de Sheets,
mientras la bandeja de efectos de coberturas tenía otra reserva. Dos propietarios
podían escribir el mismo libro y emitir avisos distintos. HU-083 ya proporciona
un puntero duradero del libro, cercado de particiones y lectura exacta de celdas.
Reutilizarlos evita crear otro planificador o presentar una cobertura como una
reparación del planificador.

## Decisión

- Guardar vínculos privados de propiedad en la misma transacción que los cambios
  públicos, el recibo y los efectos. Vincular entorno/ruta, cuerpos y revisiones
  anterior/posterior, digest del efecto y metadatos de commit del servidor.
  Incluir la finalización aunque no cambie ninguna celda. Conservar el marcador
  de planificación y ejecutar primero su auditoría en el trigger público.
- Verificar la propiedad histórica antes de los efectos ordinarios. Una edición
  manual posterior o el mismo cuerpo reaplicado en otro commit sigue la vía
  ordinaria. La evidencia parcial o corrupta cierra el paso. Las referencias del
  recibo y los efectos detectan un vínculo eliminado. Conservar esta evidencia
  indefinidamente, sin limpieza ni TTL nuevos. La eliminación administrativa de
  todos los registros privados resulta indistinguible de una escritura
  ordinaria y queda fuera del contrato de escritores admitidos.
- Ampliar el puntero existente `shiftPlanningState/sheetsSubmission` con recibos
  tipados de coberturas y exportación ordinaria. Coberturas reutiliza el cercado
  de particiones de HU-083; importador y planificador rechazan envíos ajenos sin
  resolver. La exportación completa, el evento individual y el calendario
  reservan antes de leer sus fuentes. Los cambios públicos de coberturas rechazan
  una reserva ordinaria activa; el exportador ordinario rechaza proyecciones de
  coberturas pendientes o inmovilizadas, incluso antes de arrancar su trabajador.
- Registrar cualquier posible lote antes de llamar a Sheets. Los trabajadores
  concurrentes comparten esa identidad. Una vez registrado, los reintentos sólo
  inspeccionan, también tras una interrupción anterior a la aparente llamada SDK
  o tras vencer la concesión. Los efectos ambiguos pasan a
  `reconciliationRequired`, conservan el puntero y requieren la recuperación
  existente de sólo lectura bajo autorización. Un timeout no prueba rechazo.
- Liberar la bandeja de avisos de coberturas tras lectura exacta de Sheets y una
  versión Drive estable y avanzada. Su despachador existente, con recibo por
  destinatario, es propietario del push; no crear además `notificationEvents`
  genéricos. Inyectar Firestore, entorno y autorización en efectos, recuperación
  y push; los wrappers demo mantienen sus límites de proyecto y libro.
- Conservar en las exportaciones ordinarias su semántica previa de acuse SDK.
  Su recibo final observa además una versión Drive estable y avanzada para
  mantener la cadena compartida. Esto no equivale a lectura exacta de celdas de
  coberturas. Un resultado ordinario incierto conserva el puntero y otra
  invocación no puede reenviarlo ni liberarlo. Un fallo probado sin envío restaura
  el predecesor. El evento ordinario comprueba además que su snapshot sigue siendo
  la versión pública actual.
- Versionar el inventario con ingreso, efectos y push de coberturas. Un recibo
  incierto conservado no demuestra que exista un proceso ejecutándose. El cierre
  de entrada sigue exigiendo evidencia independiente del plano de control sobre
  trabajo ejecutable e invocaciones realmente en curso. El código excluye los
  efectos inmovilizados del despacho normal; recuperación mantiene la barrera
  cerrada como requisito.

## Consecuencias

Una autoridad coordinada transaccionalmente sustituye las reservas separadas.
La incertidumbre puede detener exportaciones posteriores hasta su conciliación;
ese coste operativo queda explícito. El cercado Firestore detecta cambios entre
escritores admitidos, pero no convierte Sheets en un CAS transaccional ni impide
ediciones humanas o sin conexión. Siguen pendientes los controles IAM/Drive,
migración autoritativa, entropía real, ratificación colectiva, admisión de
operadores y despliegue autorizado.

Las pruebas SDK/Rules locales y los transportes Sheets/push inyectados permiten
validar orden, concurrencia y conservación de fallos sin modificar datos
compartidos ni enviar push real. No prueban cercado IAM desplegado ni entrega
real del proveedor. Este bloque backend no cambia código nativo.

## Entrega de la cobertura completada el 21 de noviembre de 2026

La aceptación es responsable del lote de Sheets que cambia la persona asignada y, en un reparto, el ayudante del turno anterior cuando corresponde. Al confirmar la realización, el backend guarda el identificador de la aceptación y espera a verificar la hoja antes de entregar los avisos de finalización en la bandeja. Para una confirmación antigua pendiente, localiza la aceptación por caso y revisión anterior y comprueba ambos recibos. Si el trabajador recibe primero la confirmación, actualiza la hoja una vez y omite el aviso de aceptación ya superado. Un cierre histórico que ya había entregado su aviso puede reparar la proyección pendiente conservando la entrada en la bandeja y su fecha original. [Proyección y recibos](../../functions/src/shift-coverage-projection.ts).

Los eventos de creación de Firestore `onShiftCoverageEffectCreated` y `onShiftCoverageInboxCreated` ejecutan, respectivamente, los trabajadores del inventario `worker-shift-coverage-effects` y `worker-shift-coverage-push`. Ambos usan el entorno del evento y la política privada del servidor. Cada push de cobertura requiere la entrada entregada en la bandeja del socio y su identificador estable. Si se repite el evento, se consultan los mismos recibos de operación y destinatario. La activación operativa de las Functions exportadas sigue deshabilitada. [Composición](../../functions/src/index.ts) · [Eventos](../../functions/src/shift-coverage-delivery.ts).

La API autenticada muestra las incidencias de entrega y vuelve a verificar la cuenta administradora al recuperarlas. Una operación pendiente de envío puede reanudarse. Si Sheets tiene un lote registrado aún pendiente, administración puede contrastar el marcador, las celdas exactas, la versión de Drive estable y posterior y la reserva vigente. Una operación inmovilizada conserva la reserva hasta su conciliación bajo barrera cerrada. También en esa vía se comprueba la proyección de la aceptación antes de liberar el aviso de finalización. Para intentar otro push se exige el rechazo definitivo de todos los destinos y el identificador del intento esperado. Si el proveedor confirma la aceptación para al menos un destino, se da por terminado el envío a ese socio. Si se desconoce si algún destino lo aceptó, el recibo queda sin confirmar. En ambos casos se conserva el aviso de la bandeja y se bloquea otro envío. El acuse del proveedor registra que aceptó el envío. La recepción en el dispositivo se comprueba por separado. [Administración](../../functions/src/shift-coverage-delivery-administration.ts) · [Casos de emulador](../../functions/test/shift-coverage-effects.emulator.test.cjs).

## Referencias

- [ADR-0018](0018-vincular-coberturas-nativas-a-la-disponibilidad-del-backend-autenticado.md)
- [Plan HU-084](../../spec/shifts/hu-084-stable-shift-coverage-and-credits/plan.md)
- [Aislamiento Firestore por commit](https://firebase.google.com/docs/firestore/transaction-data-contention#serializable_isolation_by_commit_time)
- [Firestore WriteResult](https://firebase.google.com/docs/firestore/reference/rest/v1/WriteResult)
