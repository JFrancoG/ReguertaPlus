# HU-083 — aceptación nativa y baseline de develop, 2026-09-12

Este tramo continúa el corte 28. Sustituye las pruebas con dobles de repositorio
por lectura del mismo conjunto privado desde el SDK real de Firestore en ambos
simuladores. No autoriza ni realiza una sustitución en Firestore compartido.

## Resultado funcional

- iOS, iPhone 17 / iOS 26.5: el repositorio real y el mismo
  `ShiftsFeatureViewModel` leen los 72 turnos, reflejan la sustitución del
  01/09/2027 y el ayudante del 25/08/2027, y recuperan los 62 registros originales.
- Android, Pixel 8 Pro / API 35: el repositorio real y las funciones de
  presentación verifican la misma secuencia y los próximos turnos. Esta prueba
  no abre una Activity ni equivale a inspección visual de la pantalla.
- Se comparan IDs, fechas, tipos, asignados, ayudantes, estado y origen completos.
  Se conserva la identidad de los propietarios y el estado de cumplimiento.
  El controlador también comprueba replay, write-back, ausencia de eventos de
  notificación y conservación de los 48 usuarios y cuatro entradas de calendario.
- La restauración incluye los recibos privados anidados del ensayo y conserva
  los campos originales del legado sin inventar su propiedad histórica. Las
  marcas de tiempo del servicio Firestore no se pueden restaurar. Se rechaza
  la inversa ante un documento extra o los mismos campos con otro updateTime.

El controlador reutiliza el importador y el adaptador existentes. El transporte
de Sheets sigue siendo una copia local de la cuadrícula real; no se han probado
despliegue, Rules o entrega FCM en este tramo. Reproducción y activación explícita
de los tests: [instrucciones del harness](../../../functions/test/acceptance/README.md).

## Baseline concreto y límite de activación

La nueva cola de pruebas empieza en ronda 1, índice 0, con los 32 UID elegibles
ordenados. Mantiene los 27 asignados efectivos de las hojas, sin desactivar ni
reclasificar los otros cinco miembros. Cada tipo consume 54 posiciones y termina
en ronda 2, índice 22. `resolveShiftRotationBootstrap` valida el mapping aprobado;
ambas rotaciones apuntan al mismo registro de baseline y pasan la validación de
estado autoritativo.

- Revisión: `hu083-develop-reset-20260912-v1`.
- Digest de baseline:
  `shift-planning:v1:sha256:62cf303fd9259b0aaa2beb98610d2bb63b535d1df8fa2f8011f7f63f6cdef784`.
- Digest del plan de contenido:
  `shift-planning:v1:sha256:c11f9a90e7fb190c723f726255682cacb80d81274e90a12228fed60f2ed5d564`.

El manifiesto privado contiene 139 escrituras: elimina 62 turnos antiguos y crea
72 turnos y cinco documentos privados —operación, mantenimiento, dos rotaciones
y baseline—. Incluye la inversa y hashes de los datos que deben conservarse.
El quinto documento privado ahora es el baseline; no es la `sourcePolicy`
sintética del ensayo anterior.

**El plan de contenido no es todavía un comando ejecutable en develop real.**
No contiene una versión `100` inventada. El conector de Drive omite `version` y
la sesión OAuth existente responde 403 al leer ese campo por REST. El contador
local del transporte de pruebas queda fuera del plan. La activación de HU-085
debe vincular una observación real de Drive, la autoridad de índices desplegada,
la captura tras detener escritores y el comando de ejecución/reversión propiedad
del runtime. No se debilita el parser canónico para reinterpretar el legado.

La comprobación posterior del auditor real (4/4 casos en emulador) demuestra otro
límite preciso: el plan omite la retención de las altas y la inversa elimina la
autoridad de los borrados tardíos. Los 72 eventos se rechazan en ambos casos;
las mismas altas pasan al aportar retención exacta de prueba. La recuperación
operativa debe conservar sus registros de auditoría y el epoch avanzado, aunque
restaure el contenido de negocio. Véase el [contrato pendiente](hu085-handoff.md#exact-runtime-boundary--2026-09-12).

## Correcciones de iOS

`FoundationModelsBylawsSummaryGenerator` usa `samplingMode` con Swift 6.4 y
conserva `sampling` al compilar con SDK anterior. La interfaz del SDK nuevo
declara el inicializador disponible desde iOS 26 con back deployment; no se
eleva el deployment target ni se silencian diagnósticos.

La primera aceptación reveló que el host de los tests arrancaba servicios reales,
aunque el repositorio nombrado apuntaba al emulador. Los planes `fast-unit-v1`
y `release-gate-v1` pasan ahora `-useMockAuth` a la composición existente. La
aceptación repetida exige ese argumento y no muestra aquellas consultas. Se
garantiza además la limpieza de Firebase en éxito y error. Las dos suites de
comandos HTTP antiguas reciben una app Firebase nombrada y local: ya no dependen
de la inicialización implícita del host real. La revisión independiente de los
Swift y planes modificados no deja hallazgos pendientes.

## Estado de cierre

La aceptación funcional local y la corrección de FoundationModels están hechas.
El mantenedor aceptó el 12/09/2026 trasladar a HU-085 la materialización del
comando operativo con su autoridad real y autorizó PR, merge y cierre de HU-083.
El [cierre aceptado](closeout.md) registra el alcance y los pendientes transferidos. Validación final: 480 unitarios Android y su aceptación instrumentada pasan.
El runner canónico `release-gate` de iOS termina con código 0: **895 aprobadas,
una omisión previa y cero fallos**, incluyendo la aceptación del emulador.
SwiftLint: cero incidencias en 487 archivos; builds Debug/Release y política de
concurrencia correctos. La primera ejecución detectó la dependencia implícita de
Firebase; tras corregirla se repitió el gate completo y pasó. Lint Android conserva
exactamente sus 136 warnings y dos hints previos. Detalles y límites en el
[handoff](hu085-handoff.md).
