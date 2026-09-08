# ADR-0014: Usar transacciones públicas de Firestore para turnos

## Estado

Aceptado para implementación local el 2026-09-08 mediante la autorización del
mantenedor para resolver la auditoría de HU-082. Sustituye parcialmente los requisitos
de serialización exacta del SDK y acuse del intento de ADR-0013. No autoriza despliegues.

## Contexto

Los invariantes de rotación de HU-082 son adecuados, pero el adaptador de publicación
intervenía en batches, métodos de commit y tokens privados de Firestore. Añadía 1.500
líneas y acoplaba las actualizaciones del SDK a sus detalles internos. Los bytes del
protobuf tampoco medían el trabajo de índices del servidor. La ausencia de un recibo
posterior podía bloquear la recuperación pese a existir el terminal confirmado.

## Decisión

1. Mantener una transacción atómica para publicar o recuperar reparto y mercado.
   Reconstruir las entradas autoritativas en cada reintento y conservar revisiones,
   epochs, bloqueos de escritores públicos e imágenes anteriores.
2. Preparar un manifiesto lógico inmutable y separado del llamador mediante el codec
   existente de valores Firestore. Aplicarlo con las APIs públicas `Transaction.create`,
   `update` y `delete`. No inspeccionar ni reemplazar miembros privados del SDK.
3. La admisión v2 / `public-transaction-v2` registra `logicalMutationDigest`,
   `documentWriteCount` y `estimatedRequestBytes`, ligados al manifiesto de operación
   y a la configuración de índices. Los límites de aplicación son 500 escrituras,
   8 MiB de petición estimada y 768 KiB codificados por documento como admisión
   conservadora. No representan el tamaño exacto del transporte o de los índices.
   Firestore impone sus límites y confirma todo o nada. HU-085 sigue probando la carga
   forward/inverse real con los índices aprobados en un clon aislado.
4. El resultado de intento v2 distingue `transactionReturned`, con evidencia de
   admisión, de `operationReadBack`, que acredita la relectura del terminal direccional
   confirmado sin inventar evidencia perdida. Perder la respuesta o el recibo no
   repite la publicación: se revalida el terminal y se conserva un recibo idempotente.
   El recibo nunca sustituye una comprobación de intent, bundle, epoch o autoridad.
5. Concentrar la recuperación de notificaciones en una lectura completa del historial
   compartida por reconciliación, entrada de incidente y cierre. La frontera decisiva
   es si pudo comenzar un envío autenticado. Lo no enviado puede cancelarse; accepted
   y unknown requieren reconciliación o corrección. El incidente con responsable y
   plazo se conserva para cerrar pendientes; no permite reenviar un intent antiguo
   con un epoch nuevo.

## Alternativas y consecuencias

- Conservar el serializador privado mantiene evidencia protobuf exacta, pero acopla
  el SDK sin probar el tamaño de índices del servidor. Se descarta.
- Publicar en varios batches reduciría el tamaño de transacción, pero rompería la
  vista atómica de los lectores planos instalados. Se descarta.
- Las transacciones nativas reducen código y mantenimiento. La admisión puede rechazar
  una carga que aceptaría el servidor, y el servidor aún puede rechazar una admitida.
  El fallo conserva la base atómicamente y exige revisar la carga, sin saltarse la
  admisión ni debilitar el aislamiento de los clientes.
- Se reemplaza la configuración v1 todavía no activada, sin reinterpretarla. HU-085
  utilizará `public-transaction-v2` y la evidencia v2. No cambian los esquemas de
  rotación, petición, candidata, sincronización ni eventos públicos.

## Trabajo relacionado

- [Plan correctivo HU-082](../../spec/shifts/hu-082-continuous-seasonal-shift-rotation/post-audit-corrections.md)
- [ADR-0013](0013-modelar-turnos-como-rotaciones-continuas-con-proyecciones-estacionales.md)
- [Transacciones Firestore](https://firebase.google.com/docs/firestore/manage-data/transactions)
