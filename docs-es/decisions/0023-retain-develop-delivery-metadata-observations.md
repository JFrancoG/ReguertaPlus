# ADR-0023: Conservar observaciones distintas de una entrega de develop

## Estado

Aceptada el 2026-10-29 mediante autorización explícita del mantenedor para actualizar
solo los cuatro receptores privados de develop en reguerta-9f27f y comprobar sus
reintentos naturales. Se excluyen entrada en mantenimiento, migración y repetición de negocio.

## Contexto

La lectura del proveedor encuentra un mensaje pendiente por receptor privado y
errores event_payload_conflict/HTTP500 repetidos. Sus identificadores ya están
retenidos. La clave v1 usa entryPoint/source/id, pero el digest contiene todos los
metadatos: dos observaciones distintas pueden chocar con la misma versión y core.
Cambiar solo traceparent reproduce el mecanismo localmente. Los logs actuales no
distinguen el componente exacto del conflicto; no se presupone equivalencia entre
transportes.

## Decisión

La primera envoltura y todas las entregas schema1 permanecen inmutables. Con el
mismo evento/core validado y los atributos CloudEvent id/source/type/subject/time/
specversion idénticos, una observación con metadatos completos distintos se guarda
como schema2 en la colección deliveries existente. Se liga a la fila canónica
schema1 validada; su clave es SHA256 de {baseDeliveryKey,metadataDigest}, siendo
metadataDigest el digest existente del core y todos los metadatos. Un duplicado
exacto conserva los readTimes originales. Se confirma la observación y los
contadores monotónicos antes del ACK; eventCount no aumenta. No se borran ni
normalizan metadatos ni se ejecuta el negocio. Los conflictos de core, clave o
identidad inmutable siguen rechazándose sin ACK, con diagnóstico sanitizado.

El inspector admite ambas versiones, rechaza observaciones huérfanas/incoherentes
e incluye todas las filas en el digest. Una observación no declara equivalencia
de transportes, terminalidad, vaciado ni preparación para mantenimiento. Los cinco
campos/schema1 de la raíz siguen siendo compatibles con los seis wrappers antiguos;
solo los cuatro receptores privados necesitan esta actualización acotada.

## Consecuencias y alternativas

Se amplía el registro existente sin crear otro motor. Las variantes añaden filas
y aumentan deliveryCount/captureRevision, por lo que deben renovarse los manifiestos
ligados al conjunto anterior. Los conflictos de identidad/core siguen pendientes
por separado. Los avisos históricos permanecen sin reenvío.

Ignorar metadatos, sobrescribir la entrega o confirmar sin conservar la observación
perdería evidencia. Añadir solo el receptor a la clave no evita variantes dentro
del mismo receptor. No hace falta desplegar primero un diagnóstico y después otra
corrección si el mismo paquete conserva observaciones seguras y sigue rechazando/
diagnosticando los demás conflictos.

## Referencias

- [ADR-0022](0022-cooperate-with-develop-firebase-administrators.md)
- [Adaptador de admisión](../../functions/src/develop-shift-intake.ts)
- [Censo offline](../../functions/scripts/inspect-develop-legacy-census.cjs)
