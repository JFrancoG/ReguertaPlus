# HU-084: inicialización del estado de turnos

El mantenedor confirma el 2026-10-27 cero compensaciones iniciales pendientes y
que no constan reservas previas activas. Cada entorno parte de sus propios datos
Firestore; no se copian los socios de develop a producción.

## En qué consiste

Los socios ya están en `users`. De ahí salen su identificador, actividad, roles y
responsabilidad de compras. Las colas y los propietarios ordinarios de `shifts`
sirven para comprobar la situación existente. Un socio puede pertenecer a los
turnos aunque nunca haya iniciado sesión en la app.

Se preparan los registros privados que faltan para que el nuevo sistema conozca
esa situación inicial. Se conservan cuentas, usuarios, colas, fechas y asignaciones
publicadas, así como el historial privado válido. Los socios de las cohortes
actuales no pasan a reserva por ejecutar esta inicialización.

Las compensaciones empiezan en cero por la confirmación expresa del mantenedor,
no porque falten documentos. Si aparece una reserva activa, una compensación
pendiente o una contradicción en los datos, el informe lo señalará y no propondrá
ninguna escritura. La inactividad no se interpreta como baja permanente.

## Herramienta de revisión local

Desde `functions`, con una captura completa codificada de `inspect()` y un JSON
de decisión revisado:

```sh
npm run prepare:shift-coverage-bootstrap -- \
  --snapshot /ruta/absoluta/privada/captura.json \
  --decision /ruta/absoluta/privada/decision.json \
  --out /ruta/absoluta/privada/revision-nueva.json
```

La decisión contiene exactamente `schemaVersion: 1`, `environment`, `operationId`,
`effectiveAtMillis`, `confirmationReference`, `reserves: "none"` y
`credits: "none"`. El instante fija la observación inicial, no una fecha histórica
de alta o entrada en reserva. `operationId` no puede ser `current`. Captura y
decisión deben corresponder al mismo entorno.

El comando sólo lee JSON local: no crea un cliente SDK ni admite flags de
aplicación o proyecto. Conserva entradas y salidas existentes, crea el informe
con permisos 0600 y muestra un resumen de cantidades/digest. Salida 0 indica
ausencia de bloqueos; 2, informe bloqueado sin creaciones; 1, entrada/salida
inválida. Un informe offline no demuestra que la captura aportada esté completa.

## Aplicación controlada

El adaptador backend recaptura las fuentes completas y al administrador actual
en la misma transacción de aplicación. Exige digest revisado, mantenimiento
cerrado, barrera existente con evidencia externa, libro correcto y presupuesto.
Un cambio de fuente, un documento nuevo o un estado incompatible impide crear
registros. Sólo crea observaciones y generaciones ausentes; nunca sobrescribe
ni borra los datos existentes.

El recibo inmutable y `shiftCoverageMigrations/current` se crean atómicamente.
Un reintento exacto no reinicia cambios posteriores de socios o compensaciones.
Sin prueba inicial válida, la entrada normal a coberturas permanece cerrada.
Una confirmación final incierta de la barrera conserva el incidente.

Esta preparación prueba el adaptador en el demo local. No incluye comando live
de aplicación ni endpoint desplegado. La captura compartida real, admisión de
operador/plano de control, revisión, aplicación acotada y comprobación tendrán su
handoff concreto autorizado. `operationalReady` sigue en false y no cambian las
apps. Ahora no hace falta actuar en los móviles.

Ver [ADR-0020](../decisions/0020-inicializar-coberturas-desde-fuentes-canonicas-revisadas.md)
y plan/review de HU-084 para evidencia aceptada y requisitos de activación.

## Situación real de develop comprobada el 2026-10-27

Se consultan en modo lectura cuatro rutas exactas de configuración del proyecto
`reguerta-9f27f`: `shiftPlanningState/current`, `shiftPlanningState/sourcePolicy`,
`shiftRotations/delivery` y `shiftRotations/market`, todas bajo
`develop/plus-collections`. Las cuatro devuelven documento inexistente. La lectura
usa máscaras de campos; no consulta usuarios, producción, libros ni credenciales.

Falta por tanto la base del motor nuevo. Esto no significa que falten las cuentas
o los turnos publicados anteriores. Antes de aplicar la inicialización en develop
hay que preparar y revisar esa base a partir del historial existente, conservando
fechas y orden, y establecer el estado controlado necesario. Es la preparación
del planificador base de HU-082/HU-083/HU-085; esta herramienta no adivina una cola
ni activa la funcionalidad para suplir esa ausencia.

## Preparación posterior de develop

El [informe de preparación del 2026-10-27](../../spec/shifts/hu-084-stable-shift-coverage-and-credits/develop-planner-base-preparation.md)
recoge las lecturas posteriores y acotadas de usuarios, turnos y hojas, y la
propuesta privada de contenido. Coinciden las 72 fechas y las 108 plazas ordenadas
con el escenario de develop aprobado y conservado. Quedan explícitos los ayudantes
(53 celdas vacías), julio/agosto de 2027 ausentes en Mercado, los 62 turnos antiguos
de Firestore y la falta de versión real de Drive y autoridad operativa. Esto no
amplía retroactivamente la consulta anterior ni aplica la inicialización.
