# ADR-0029 · Usar drand Quicknet para sortear coberturas

## Estado

Proveedor elegido el 21 de noviembre de 2026 para la candidata de HU-084. La activación en el entorno compartido queda pendiente. [Acuerdo de asamblea D09](../../spec/shifts/hu-084-stable-shift-coverage-and-credits/ratification-es.md)

## Decisión

Una vez agotados la reserva y el voluntariado, el backend fija los participantes, las exclusiones y el turno que se debe cubrir. En la misma transacción guarda la cadena Quicknet, la clave de verificación, la ronda futura y su hora de publicación. Elige la primera ronda prevista al menos cinco minutos después de leer su reloj. Antes de resolver el sorteo comprueba que Firestore registró el compromiso antes de que la ronda fuese pública. [Registro y resolución](../../functions/src/shift-coverage-store.ts)

Quicknet publica para cada ronda numerada una firma BLS generada colectivamente. El backend consulta la cadena y la ronda guardadas, verifica la firma con la clave fijada y comprueba que su resumen SHA-256 coincide con el valor aleatorio publicado. Con ese valor y el compromiso inicial, el algoritmo de ordenación existente asigna un puesto a cada participante elegible. El caso conserva la evidencia y la lista ordenada. Si alguien rechaza, la oferta pasa a la siguiente persona y sigue requiriendo aceptación. El proveedor solo recibe los identificadores públicos de cadena y ronda. [Parámetros de Quicknet](https://docs.drand.love/blog/2023/10/16/quicknet-is-live/) · [Protocolo](https://docs.drand.love/docs/specification/) · [Verificador](../../functions/src/shift-coverage-drand.ts)

## Incidencias y recuperación

El primer fallo de verificación queda registrado y genera un aviso genérico para quien tramitó el sorteo como administrador. Administración puede abrir el caso y consultar de nuevo la misma ronda mientras siga vigente el plazo. La consulta al proveedor se ejecuta fuera de la transacción de Firestore. Al recibir la respuesta, el backend vuelve a comprobar permisos, revisión, turno y compromiso. Si la próxima ronda disponible cae fuera del plazo, administración se hace cargo sin crear un compromiso. Si el compromiso llega tarde a Firestore, el caso también pasa directamente a resolución administrativa. Cancelar y reabrir conserva la evidencia original. [Aceptación local](../../spec/shifts/hu-084-stable-shift-coverage-and-credits/review.md#d09-public-draw-on-21-november-2026)

La imprevisibilidad del valor futuro depende de los participantes que producen la firma colectiva de Quicknet. El servidor que la publica puede retrasar u omitir su respuesta. Un cambio de cadena o clave requiere revisar el proveedor y conservar los parámetros originales de verificación para los sorteos ya comprometidos.
