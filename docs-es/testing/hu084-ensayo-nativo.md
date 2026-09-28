# Ensayo nativo local de HU-084

La ruta exclusiva de Debug usa credenciales en memoria de Auth Emulator y la API
provisional de coberturas. La política, el proveedor de entropía y la activación en
producción siguen siendo decisiones independientes.

Desde `functions`, con dependencias y una versión compatible de Java:

```sh
npm run build
firebase emulators:exec --config ../firebase.coverage-emulator.json \
  --project demo-reguerta-hu084-coverage --only firestore,auth \
  'GCLOUD_PROJECT=demo-reguerta-hu084-coverage METADATA_SERVER_DETECTION=none node test/shift-coverage-native-rehearsal.cjs'
```

El escenario reinicia únicamente `develop/plus-collections` y las cuentas Auth de
los emuladores del proyecto demo fijo: Firestore 8798, Auth 9098 y API 127.0.0.1:8799.
La hora virtual es 02/09/2027 a las 10:00 UTC. Detener el comando cierra los servicios;
reiniciarlo reconstruye los datos. No ejecutarlo simultáneamente con otras suites.

Arrancar iOS Debug con `-coverageRehearsal`. En un emulador Android:

```sh
adb -s EMULATOR_ID shell am start \
  -n com.reguerta.user.debug/com.reguerta.user.CoverageRehearsalActivity
```

Android usa el proceso separado `:coverage_rehearsal`, sin FirebaseInitProvider del
proceso principal ni composición de MainActivity. Solo 127.0.0.1 y 10.0.2.2 admiten
HTTP sin TLS. iOS emplea la composición de pruebas existente sin registro push remoto.
Estas rutas no se registran en Release.

Contraseña común del escenario: `local-fixture-password`.

- `d@example.test`: abrir el aviso genérico, consultar mercado, aceptar y comprobar la lectura posterior.
- `admin@example.test`: abrir reparto y confirmar la cobertura realizada.
- `e@example.test`: comprobar el crédito pendiente de reparto generado.
- `a@example.test`: socio asignado originalmente, disponible para formularios de ausencia.

La interfaz también representa voluntariado, reservas, sorteo y gestión manual
cuando la API devuelve esos estados. Este escenario no configura proveedor de
entropía. iOS permite editar fecha/hora de respuesta; Android, minutos desde la hora
de referencia del formulario. Ambos validan la política y vuelven a comprobar la
caducidad antes de enviar. Las fechas de los turnos no muestran una hora de servicio.

Solo se admiten credenciales sin firma del proyecto fijo y UID capturado. El servidor
verifica de nuevo identidad y vínculo canónico. Los tokens no se guardan ni registran;
la caducidad o revocación obliga a entrar de nuevo. Una respuesta incierta conserva
la operación exacta para reintentar y bloquea nuevas mutaciones. Elegibilidad,
conflictos y créditos siguen siendo responsabilidad del backend.

La lectura aporta puestos futuros asignados (máximo 500), nombres mínimos e
indicadores de elegibilidad para administración (máximo 500 socios), incluyendo al
propietario inactivo que conserva un turno futuro. No expone las listas privadas del
sorteo, exclusiones, UID de Auth, correos ni créditos ajenos.

El test de aceptación iOS es optativo y necesita esos servicios preparados. Desde
`ios/Reguerta`:

```sh
TEST_RUNNER_COVERAGE_REHEARSAL=1 xcodebuild test \
  -project Reguerta.xcodeproj -scheme Reguerta -testPlan release-gate-v1 \
  -destination 'platform=iOS Simulator,name=iPhone 17,OS=26.5' \
  -only-testing:ReguertaUITests/CoverageRehearsalUITests \
  -parallel-testing-enabled NO
```

Reconstruir el escenario antes de repetir la aceptación. El test se omite en las
validaciones habituales. Los efectos se comprueban contra el libro simulado y la
bandeja local; el despliegue real, VoiceOver y la matriz completa de dispositivos
y tamaños siguen pendientes.

Después de confirmar el reparto como admin, ejecutar la lectura del crédito en AX5
con `TEST_RUNNER_COVERAGE_CREDIT_REHEARSAL=1` y
`-only-testing:ReguertaUITests/CoverageRehearsalUITests/testLocalEarnedCreditAtAccessibilitySize`.
Requiere el reparto realizado y se omite sin esa variable explícita. Conserva una
captura en el resultado de pruebas.

## Ensayo de efectos de cobertura

`npm run test:shift-coverage:emulator` incluye ahora la integración de comando,
Sheets y bandeja de avisos. Solo utiliza el proyecto demo fijo de Firestore y la
simulación existente de la API de Sheets (`coverage-rehearsal-book`). La fixture
nativa también procesa automáticamente cada efecto nuevo mediante ese consumidor,
tras preparar el libro legible. No conecta con un libro compartido.

Cada comando nuevo correcto crea un registro privado `shiftCoverageEffects` en la
misma transacción que su recibo, asignación y eventual crédito ganado. El recibo
vincula su resumen criptográfico. El consumidor del demo reutiliza el importador,
el resolvedor de identidades, el adaptador de celdas y el marcador de lectura de
HU-083, además del texto genérico y el constructor de avisos existentes. Conserva
los titulares de rotación y los marcadores históricos del backend. Solo los cambios
de asignación o ayuda requieren escribir la hoja; completar una cobertura por sí
solo no reescribe Sheets ni concede otro crédito.

La aceptación proyecta el responsable efectivo y la ayuda futura del turno anterior
entre pestañas de temporada, o sustituye una persona en el bloque de cuatro filas
de mercado. Conserva notas, fórmulas y formato; una edición manual incompatible del
responsable o ayudante, o un nombre ambiguo, bloquea el envío. La reimportación
legible conserva las mismas personas efectivas. No se añaden motivos de ausencia,
evidencias de candidatos ni campos de crédito a la hoja.

Una reserva privada del libro serializa operaciones de proyección distintas. Antes
de escribir externamente y liberar avisos se comprueban la autorización de escritura,
la revisión exacta del caso y la captura completa y acotada de fuentes (hasta 500
documentos por colección: shifts, users y deliveryCalendar). El envío persistido
vincula las versiones de los documentos y las celdas anteriores y posteriores. Una
respuesta incierta conserva ese envío y su reserva: la lectura verificada permite
continuar sin otra escritura. Si cambian las fuentes se detiene la recuperación y
no se sustituye el envío pendiente. Un conflicto anterior al envío libera la reserva;
una operación enviada con resultado incierto requiere reconciliación explícita antes
de que otra operación use el libro.

Los avisos genéricos de cada destinatario se crean atómicamente con la finalización
del efecto, tras verificar la proyección; se omiten destinatarios inactivos. Se
comprueba la caducidad o sustitución de ofertas. Los reintentos y consumidores
simultáneos no duplican avisos. No se crean eventos `notificationEvents` ni envíos
FCM. El efecto privado conserva referencias al caso y su revisión; quedan pendientes
el envío real y la recuperación y activación gobernadas sobre libros compartidos. La reserva del ensayo no es un bloqueo de
producción distribuido entre todos los escritores.

## Abrir un aviso autenticado

Ambas apps muestran avisos genéricos de la bandeja local del socio identificado.
Abrir uno envía únicamente su identificador opaco. El backend comprueba destinatario,
efecto completado y recibo vinculado, y devuelve la proyección mínima actual del caso.
Un ayudante de reparto o compañero de mercado afectado puede consultarla sin obtener
motivos administrativos, evidencias de crédito ni nuevos permisos de modificación.
Copiar el identificador no concede acceso a otro socio; una sesión inactiva se rechaza.

Un aviso de oferta antiguo abre su estado actual y nunca repite aquella acción.
Actualizar conserva el ámbito autorizado del aviso. Volver atrás recarga el listado
completo, incluso con una petición pendiente; una operación incierta conserva su
reintento explícito y la navegación nunca la repite. Un cambio de sesión descarta
las respuestas tardías y la intención de navegación.

La fixture incluye otra ausencia de reparto el 08/09/2027 para comprobar que volver
atrás restaura más casos. La aceptación iOS comprueba la vuelta antes y después de
aceptar mercado. Los avisos de reparto se pueden consultar con `e@example.test`.
El escenario registra identificadores de efectos completados y lotes del libro simulado,
sin tokens ni datos personales. Esta navegación local no constituye envío push del sistema.

## Aceptación por roles y texto ampliado

Mantener activo el escenario demo fijo. Estos recorridos abren y cancelan formularios
sin aceptar ni completar casos; pueden compartir la misma fixture sin modificarla.
Comprueban las diferencias entre socio y administrador, la vuelta al listado y una
lectura nueva del servidor tras cancelar. No certifican la interacción con VoiceOver
ni TalkBack.

Android usa Auth/HTTP local real y las pantallas Compose con texto al 200 %. Seleccionar
expresamente un emulador evita que Gradle incluya un teléfono conectado:

```sh
ANDROID_SERIAL=emulator-5554 ./gradlew app:connectedDebugAndroidTest \
  -Pandroid.testInstrumentationRunnerArguments.class=com.reguerta.user.presentation.shiftcoverage.CoverageRehearsalAcceptanceTest \
  -Pandroid.testInstrumentationRunnerArguments.hu084Acceptance=true
```

Ejecutar desde `android/Reguerta`, sustituyendo el serial por el mostrado en `adb devices`.
Sin el argumento optativo se omiten los dos tests. La suite completa puede incluirlos
con el mismo argumento; el test independiente de HU-083 necesita su fixture o exclusión.

Desde `ios/Reguerta`, ejecutar el recorrido de roles en español y AX5 en teléfono o iPad:

```sh
TEST_RUNNER_COVERAGE_LAYOUT_REHEARSAL=1 xcodebuild test \
  -project Reguerta.xcodeproj -scheme Reguerta -testPlan release-gate-v1 \
  -destination 'platform=iOS Simulator,name=iPhone SE (3rd generation),OS=26.5' \
  -only-testing:ReguertaUITests/CoverageRehearsalLayoutUITests \
  -parallel-testing-enabled NO
```

Para iPad horizontal añadir `TEST_RUNNER_COVERAGE_LANDSCAPE=1` y seleccionar su destino
exacto. El test restaura la orientación anterior y conserva tres capturas en xcresult:
confirmación administrativa, detalle del sustituto y oferta al socio. El gate habitual
omite este recorrido optativo. Reconstruir la fixture antes de la aceptación de mercado
que sí modifica datos y se describe más arriba.

### Matriz local registrada — 2026-09-13

| Entorno | Resultado |
| --- | --- |
| Android unitarios / lint | 501 tests pasan; 137 avisos previos ajenos, ninguno en shiftcoverage |
| Pixel 8 Pro + Small Phone / API 35 | 25 tests conectados pasan en cada uno, incluidos los dos recorridos al 200 % |
| iPhone 17 / iOS 26.5 | Gate completo: 917 pasan, cinco omisiones previstas; Debug/Release y SwiftLint correctos |
| iPhone SE (3rd generation) / iOS 26.5 | Pasa el recorrido de roles y cancelación en español y AX5 |
| iPad mini (A17 Pro), horizontal / iOS 26.5 | Pasa el recorrido de roles y cancelación en español y AX5 |

La suite Android excluye el test con fixture independiente de HU-083. Las omisiones
iOS son tres recorridos optativos HU-084, uno HU-083 y el test condicional de
arranque/rendimiento. Los títulos de navegación se abrevian en el SE y en la hoja administrativa del iPad con AX5;
el contenido y las acciones siguen siendo alcanzables mediante desplazamiento.
Esta evidencia corresponde a simuladores/emuladores locales. Siguen pendientes
VoiceOver/TalkBack físicos, API 29, la entrega push real del sistema y la activación
con escritores/libros compartidos.

## Envío push simulado y apertura desde el sistema

El escenario nativo ejecuta ahora el despachador de coberturas mediante la interfaz
de transporte Messaging existente, con destinos falsos y respuesta SDK aceptada.
Registra `Local push payload` con solo `eventId`, `type` y `target`. No consulta
destinos reales ni llama a FCM/APNs. Los seis envíos iniciales guardan recibos por
destinatario en `shiftCoverageEffects/{operationId}/pushes/{memberId}`. Repetir el
procesamiento devuelve el recibo original incluso si cambian el caso o los destinos.
Un resultado submitting/unknown requiere conciliación gobernada y nunca se reenvía
automáticamente. No se persisten tokens. El texto genérico no contiene casos,
socios ni motivos administrativos. La clave de colapso APNs tiene 64 bytes y el
identificador opaco completo se conserva en los datos.

En iOS, arrancar Debug con `-coverageRehearsal` y `-coveragePushRehearsal`. Aceptar
el permiso de notificaciones en el simulador propio. El segundo flag solicita solo
la autorización local; siguen desactivados Firebase y el registro remoto. Mantener
el proceso abierto: un arranque en frío desde el sistema no conserva estos flags.
Copiar el payload vigente de la oferta de mercado para `d` del escenario fijo y
añadir el sobre de alerta APNs:

```json
{
  "eventId": "COPIAR_EVENT_ID_VIGENTE_DE_COBERTURA",
  "type": "shift_updated",
  "target": "users",
  "aps": {
    "alert": {"title": "Turnos actualizados", "body": "Consulta la aplicación para ver la información actualizada."},
    "sound": "default"
  }
}
```

Guardarlo en un archivo temporal `.apns` y ejecutar:

```sh
xcrun simctl push SIMULATOR_UDID com.plusprojects.Reguerta.debug /tmp/coverage.apns
```

Abrir el aviso real del Centro de notificaciones e iniciar sesión como
`d@example.test`. Debe aparecer la oferta sin elegir una fila del buzón. Repetir
con el detalle abierto: debe conservar el mismo caso. No aceptar/rechazar en este
recorrido de lectura. El callback copia una referencia tipada y finaliza en
MainActor, también para payloads rechazados: UIKit restaura la escena al completarlo.
La prueba del aviso detectó y ahora verifica la corrección de ese cierre por hilo.

En Android, probar la entrada equivalente con el identificador vigente:

```sh
adb -s EMULATOR_ID shell am start \
  -n com.reguerta.user.debug/com.reguerta.user.CoverageRehearsalActivity \
  --es eventId EVENT_ID_VIGENTE --es type shift_updated --es target users
```

Ejecutar antes del login y con la actividad ya en primer plano. `singleTop` entrega
la segunda entrada a `onNewIntent`. La apertura espera a la autenticación y a resolver
formularios o comandos inciertos; cerrar sesión descarta la intención y lecturas
tardías. Las rutas activas normales no envían coberturas al detalle de planificación
estacional. Android rechazó por permisos la publicación de notificaciones desde
shell, por lo que estos Intents no acreditan pulsaciones en la bandeja.

### Evidencia del bloque push — 2026-09-13

- Functions: pasan lint/build, 45 unidades de cobertura y 108 escenarios de emulador/Rules.
- Android: pasan 502 unidades, lint y 25 pruebas conectadas en Pixel 8 Pro/API 35;
  los Intents de actividad nueva/abierta llegan a la oferta de mercado del 4 de septiembre.
- iOS: pasan 908 fast-unit/una omisión optativa existente, cuatro UI-smoke y las
  18 pruebas enfocadas finales (19 ejecuciones parametrizadas), en iPhone 17/iOS 26.5.
  Build Xcode MCP y SwiftLint finales correctos, sin warnings ni infracciones. La
  tabla anterior del gate completo corresponde a la aceptación ya commiteada (`3dcc84c`).
- iPhone SE/iOS 26.5: las pulsaciones reales del aviso simulado antes del login y
  con el detalle abierto conservan la oferta, sin cierre ni vuelta al listado.
- Lectura local recursiva: 51 documentos, seis recibos push simulados aceptados,
  tres casos con estados/revisiones intactos y cero créditos. No se envió ninguna
  acción de cobertura.

Evidencia local: `/tmp/hu084-push-ios-system-tap.json`,
`/tmp/hu084-push-ios-repeat-tap.json`, `/tmp/hu084-push-callback-focused.xcresult`,
`/tmp/hu084-push-firestore-after.json` y logs de backend/Android. No acredita hardware,
FCM/APNs reales, arranque iOS en frío ni la bandeja Android. Siguen pendientes la
admisión de destinos reales, recuperación de resultados inciertos y escritores
compartidos, proveedor de entropía, ratificación y HU-085.

## Ensayo de recuperación gobernada

El adaptador solo opera en el proyecto y libro demo fijos. No tiene endpoint HTTP
ni controlador real. `inspect(operationId, actorId)` facilita el digest de versiones
al ejecutor de confianza; no crea autoridad. Este debe tener mantenimiento cerrado
y permiso del backend para guardar la autorización exacta en:

`shiftCoverageEffects/{operationId}/recoveryAuthorizations/{recoveryId}`

Los campos exactos son `schemaVersion: 1`, `actorId`, `evidenceDigest` y `scope`.
El ámbito contiene el contrato completo de barrera cerrada HU-082; su digest
autoritativo liga esta captura de coberturas e identifica el libro fijo y la revisión,
época y linaje actuales del mantenimiento. El controlador debe bloquear y drenar
los escritores afectados, incluidos los procesos de coberturas y editores externos,
y devolver el mismo checkpoint cerrado antes y después. Un documento de mantenimiento
cerrado o esperar un timeout no sustituyen esa evidencia. No existe operación de
reapertura. Los controles reales y la emisión de autorizaciones corresponden a HU-085.

`reconcile(operationId, recoveryId, actorId)` vuelve a verificar autorización y fuentes
dentro de la transacción de commit. Solo lee Sheets y nunca envía push.

| Resultado observado | Recuperación |
| --- | --- |
| Efecto pendiente, proyección verificada y asignaciones canónicas vigentes | Completa el efecto, libera el buzón genérico y retira la reserva atómicamente |
| Aviso obsoleto o caducado sin proyección pendiente | Retira el efecto sin liberar el aviso antiguo |
| Proyección ausente/distinta o asignaciones modificadas | Mantiene efecto y reserva; registra la incidencia con la barrera cerrada |
| Envío push interrumpido | Conserva intento/evidencia de destinos y marca incierto; no reenvía |
| Push aceptado/fallido/incierto o sin intento registrado | Conserva el resultado y enumera destinatarios sin envío; no reenvía |
| Falla la comprobación final de barrera después del commit | Conserva recibo e incidencia; el reintento no afirma una finalización correcta |

El resultado inmutable queda en `shiftCoverageEffects/{operationId}/recoveries/{recoveryId}`.
Autorizaciones y resultados son privados del backend incluso para administradores
autenticados de la app. Repetir no reescribe casos, créditos o asignaciones, no reabre
escritores ni renueva la autoridad original del efecto. Liberar el buzón no autoriza
FCM/APNs bajo una época nueva. Un libro distinto exige una reparación revisada aparte;
esta recuperación no sobrescribe sus celdas.

Ejecutar `npm run test:shift-coverage:emulator` desde `functions` sin otro escenario
nativo activo. Incluye 14 escenarios de recuperación con Sheets simulado con estado
y controlador de confianza simulado. El 13/09/2026 pasan los 122 escenarios de
emulador/Rules, 86 unidades de coberturas/barreras/conciliación y lint/build Functions.
Este bloque no cambia código Android/iOS. Acredita comportamiento local, no bloqueo
real entre servicios ni entrega real. El plan mantiene la aceptación pendiente y los
límites de HU-085.

## Revisión final de la rama — 2026-09-13

La matriz vigente de criterios y evidencia está en
`spec/shifts/hu-084-stable-shift-coverage-and-credits/review.md`. Functions pasa
lint/build, 420 pruebas de regresión, 122 de coberturas Firestore/Rules y 22 de
Auth/HTTP (51 casos de otros emuladores se omiten explícitamente en la regresión).
Android pasa 502 unitarias y 25 conectadas en Pixel 8 Pro/API 35; lint conserva
135 avisos previos y dos sugerencias, ninguno sobre líneas cambiadas. iOS pasa
el release gate canónico con 919 correctas/cinco omisiones previstas/cero fallos
en iPhone 17/iOS 26.5, SwiftLint sin infracciones en 509 archivos y el resumen
cerrado de compilación sin warnings. Xcode MCP también compila Release/iphoneos;
su log completo conserva un aviso de extracción de metadatos AppIntents, registrado
por separado de los diagnósticos del compilador.

La revisión solo corrige formato Swift nuevo y textos de estado desactualizados.
En esa fecha seguían sin verificar VoiceOver/TalkBack físicos, API29 real, bandeja Android,
notificación con proceso iOS cerrado y entrega APNs/FCM real. El AVD llamado
`Pixel_4_A12_API29` utiliza realmente API31; no había imagen API29 instalada (resuelto en el seguimiento siguiente). El
siguiente paso es esa matriz acotada de pruebas manuales y dispositivos. Esta
revisión no cierra #268, ratifica políticas ni autoriza activación. Se han retirado
las configuraciones temporales y detenido los servicios Firebase del ensayo.

## Aceptación Android 10 / API 29 — 2026-09-28

El nuevo AVD `Pixel_4_A10_API_29` se verifica en ejecución como Android 10, SDK 29.
La suite conectada pasa 25 pruebas, sin fallos, errores ni omisiones, incluidos los
dos recorridos opt-in de roles y cancelación HU-084 de socio/administrador con texto
al doble de tamaño y el ensayo local Auth/Firestore/HTTP. Se excluye el recorrido
independiente de HU-083, que necesita su propio escenario. No fue necesario cambiar
código Android. El comando y los logs quedan registrados en
`spec/shifts/hu-084-stable-shift-coverage-and-credits/review.md`.

La aceptación local en API 29 queda completada. Siguen pendientes VoiceOver/TalkBack
físicos, bandeja Android, apertura de notificación con proceso iOS cerrado y entrega
real APNs/FCM. Se usó configuración sintética demo; la configuración temporal y los
servicios Firebase propios se retiran/detienen al finalizar. No se toca producción
ni el teléfono físico.

La actualización de dependencias `a50ec52` también se validó en API 29: pasan
502 pruebas unitarias y 25 conectadas; lint conserva 135 avisos previos y dos
sugerencias. El mantenedor autorizó commit/push de este bloque de revisión el
2026-09-28; las comprobaciones manuales restantes siguen abiertas.


## Aviso de bandeja Android desde la app — preparado 2026-09-28

`CoverageRehearsalActivity` de Debug acepta `coveragePostNotification=true` junto
al payload de cobertura validado. Publica un aviso genérico desde el UID de la app,
con PendingIntent inmutable y propio del evento. Publicarlo no selecciona el caso:
solo el toque en la bandeja entrega la referencia al modelo del ensayo. El código
y los textos traducidos viven en `src/debug`. En API 33+ requiere permiso de
notificaciones ya concedido; si están desactivadas no publica el aviso.

Con el ensayo demo activo y el evento de oferta vigente para `d@example.test`:

```sh
adb -s EMULATOR_ID shell am start \
  -n com.reguerta.user.debug/com.reguerta.user.CoverageRehearsalActivity \
  --es eventId CURRENT_COVERAGE_EVENT_ID --es type shift_updated --es target users \
  --ez coveragePostNotification true
```

Volver a Inicio, abrir la bandeja, tocar el aviso e iniciar sesión con
`d@example.test` / `local-fixture-password`. Debe abrirse la oferta de mercado del
4 de septiembre de 2027 sin seleccionar una fila del buzón. No aceptar ni rechazar.
Repetir con sesión iniciada y después con el proceso del ensayo terminado en segundo
plano (sin forzar detención, que elimina las notificaciones). Registrar cada resultado
observado antes de dar por completada la aceptación de bandeja.

La preparación pasa 502 unitarias, lint con los 135 avisos/dos sugerencias previos y
25 pruebas conectadas en API 29. El sistema confirma que existe el aviso de la app;
siguen pendientes los resultados humanos del toque y del arranque sin proceso.
Esto verifica apertura local del sistema, no entrega real FCM. El ensayo demo sigue
activo para la prueba guiada.


### Prueba guiada de bandeja: acceso con login — 2026-09-28

El mantenedor siguió los pasos de toque en notificación e inicio de sesión y aportó
`Captura de pantalla 2026-09-28 a las 15.32.46.png`: el detalle de Market muestra
4 de septiembre de 2027, Awaiting response y el socio de prueba d, con acciones de
aceptar/rechazar. Queda confirmado el primer recorrido bandeja-login-oferta.
No se pidió aceptar ni rechazar. Se prepara otro aviso con el proceso y la sesión
existentes para comprobar la reapertura; ese resultado y el arranque sin proceso
siguen pendientes. La captura no acredita entrega real FCM ni TalkBack.


### Prueba guiada de bandeja: reapertura autenticada — 2026-09-28

El mantenedor confirma que el segundo aviso mantiene la misma oferta sin pedir
login ni mostrar errores. La reapertura con sesión iniciada pasa. Se publica otro
aviso, se lleva la app a segundo plano y se ejecuta `am kill com.reguerta.user.debug`
cuando el sistema permite terminarla en segundo plano. Se verifica que el proceso
del ensayo ya no existe y el aviso sigue en la bandeja. Quedan preparados el toque
con proceso cerrado y el login posterior; pendiente la observación del usuario.


### Prueba guiada de bandeja: proceso cerrado — 2026-09-28

El mantenedor confirma que el aviso conservado tras terminar el proceso solicita
login de nuevo y abre directamente la misma oferta de mercado del 4 de septiembre
de 2027 sin errores. El PID del ensayo nuevo difiere del proceso terminado.
Pasan las tres variantes Android: acceso con login, reapertura autenticada y login
tras arranque sin proceso. TalkBack físico y entrega real FCM siguen pendientes.


## Ruta de arranque sin proceso exclusiva del simulador — 2026-09-28

Debug en simulador puede leer el booleano explícito `coverageColdLaunchRehearsal`
de las preferencias propias de la app. Selecciona la misma composición de ensayo
y autorización de notificaciones locales que los dos argumentos existentes, incluso
si iOS arranca desde un aviso sin argumentos. Release no incluye esta rama y Debug
en dispositivo físico ignora la preferencia. La app nunca la activa automáticamente.

Para la prueba guiada, instalar Debug en el simulador elegido, terminar el proceso
y activar solo esa preferencia en su contenedor antes de lanzar sin argumentos.
Una vez concedido el permiso, inyectar el payload vigente con `simctl push`, terminar
la app con `simctl terminate` y tocar el aviso. Tras el login debe abrirse la oferta
de mercado original. El transporte sigue siendo simulado, no entrega APNs.
Al acabar, eliminar solo `coverageColdLaunchRehearsal` de las preferencias de esa
app del simulador y terminarla.


### Apertura guiada iOS sin proceso: superada — 2026-09-28

Tras reabrir la ventana del iPhone 17/iOS 27.0, el mantenedor confirma que el aviso
pendiente abre el login aislado y después resuelve directamente la oferta de
mercado del 4 de septiembre de 2027 sin errores. El proceso se había terminado antes
de inyectar el aviso. Queda completada la apertura local iOS sin proceso; no acredita
transporte APNs ni VoiceOver físico. Al acabar se termina la app y se elimina solo
la preferencia temporal `coverageColdLaunchRehearsal` de su contenedor del simulador.
Siguen pendientes TalkBack/VoiceOver físicos y entrega real APNs/FCM aislada.
Los cambios siguen sin commit.


El ensayo de notificaciones completado se guarda como bloque de trabajo. Se detienen
sus servicios demo y se retira el enlace temporal de dependencias. Para VoiceOver
en iPhone físico hay que preparar antes un ensayo compatible: el transporte actual
usa loopback y apunta al propio iPhone, no al Mac. Abrir la app normal no prueba esta UI.


## Ensayo de accesibilidad en iPhone físico — preparado 2026-09-28

Abrir la app Debug con `-coverageAccessibilityRehearsal`. Reutiliza
`CoveragePreviewAccess` y las vistas/modelo reales de cobertura con datos de ejemplo
en memoria, sesión de ejemplo preasignada y aviso explícito de ensayo sin conexión.
Este modo usa la composición de pruebas de UI: sin Firebase real, registro push
remoto ni servidor HTTP local. Los comandos fallan en lugar de guardar cambios.
El argumento no existe en Release y tiene prioridad sobre los de emulador/push.

En iPhone 11, el alcance guiado es orden de lectura y etiquetas con VoiceOver,
navegación al caso, campos y cancelación de formularios, además de Dynamic Type.
Empezar en el listado, abrir el caso de mercado de ejemplo, revisar el formulario
de una acción y cancelarlo. No acredita backend, roles autenticados, persistencia
de comandos ni APNs.

El mantenedor confirma estas comprobaciones físicas de VoiceOver en iPhone 11:

- El listado se lee completo y el caso se anuncia como botón.
- El detalle se abre y puede recorrerse sin saltos ni bloqueos de foco.
- La confirmación de aceptación se lee; al pulsar Volver sin confirmar, el foco
  regresa a Aceptar cobertura.
- El formulario de ausencia permite seleccionar turno y escribir un motivo de
  prueba; al pulsar Volver sin guardar, el foco regresa a Comunicar ausencia.

Estas comprobaciones acotadas de VoiceOver quedan superadas por observación del
mantenedor. Siguen pendientes Dynamic Type físico, TalkBack y transporte real
APNs/FCM aislado.


### Hallazgo de Dynamic Type físico — 2026-09-28

Con el tamaño máximo de accesibilidad en iPhone 11, el mantenedor indica que el
resto del flujo es usable, pero aporta capturas con títulos de navegación y valor
del selector de turno truncados. Esta comprobación aún no está superada. La
corrección mueve los títulos a encabezados multilínea dentro del contenido
desplazable en tamaños de accesibilidad y muestra los turnos como opciones en
filas con texto multilínea. Falta repetir estos dos puntos en el dispositivo; las
observaciones previas de VoiceOver corresponden a la versión probada y conviene
comprobar de nuevo el foco tras el cambio.

La app Debug corregida está instalada y abierta en iPhone 11. La inspección en
ejecución con AX5 y español en iPhone 17 confirma los encabezados completos y
el turno seleccionado sin recortes. SwiftLint estricto pasa; los resultados
nativos confirman 21 comprobaciones unitarias en iPhone 11 y cuatro de UI en
simulador, tras un timeout al iniciar la automatización física. Falta la
comprobación del mantenedor sobre la versión corregida.


El mantenedor confirma que el contenido corregido se lee completo con texto
máximo en iPhone 11. Tras su observación sobre el desplegable anterior, el selector
conserva ahora el estilo automático original en tamaños normales y usa opciones
en filas multilínea solo en tamaños de accesibilidad. Ambos estilos comparten
la selección del borrador. Falta comprobar el desplegable y la vuelta con tamaño
normal. Abrir desde el icono no conserva el argumento del ensayo: hay que lanzar
de nuevo con `-coverageAccessibilityRehearsal` para retomar el flujo aislado.


El mantenedor confirma la última comprobación con tamaño normal en iPhone 11:
el desplegable de turno se abre, permite seleccionar el turno de prueba y mantiene
la selección; Volver regresa sin guardar. Quedan completadas las comprobaciones
guiadas de iPhone dentro del alcance sin conexión descrito. Siguen pendientes
TalkBack físico y entrega real APNs/FCM aislada.


## Preparación de TalkBack en Android físico — 2026-09-28

Con los servicios demo anteriores activos, conectar la app Debug por USB; los
destinos de Auth y API siguen siendo los puertos locales fijos. Configurar solo:

```sh
adb -s DEVICE_ID reverse tcp:9098 tcp:9098
adb -s DEVICE_ID reverse tcp:8799 tcp:8799
adb -s DEVICE_ID shell am force-stop com.reguerta.user.debug
adb -s DEVICE_ID shell am start \
  -n com.reguerta.user.debug/com.reguerta.user.CoverageRehearsalActivity \
  --ez coverageUsbRehearsal true
```

Terminar la app Debug antes de cambiar entre transporte de emulador y USB: el
ViewModel conserva su adaptador durante la vida de la actividad. Sin el extra se
mantiene el host del emulador. No se admite un hostname arbitrario. Al terminar,
retirar solo esos dos mapeos USB, detener los servicios demo propios y eliminar
el enlace temporal de dependencias de functions.

Xiaomi 21081111RG / Android 14 (API 34) conectado, APK Debug instalado y login
aislado visible. TalkBack está instalado; el agente no lo ha activado. El dispositivo
rechaza los toques inyectados por USB, por lo que el mantenedor introduce las
credenciales ficticias manualmente. Login por USB y TalkBack físico pendientes.
Validación local: 502 comprobaciones unitarias superadas; lint conserva 135 avisos
y dos sugerencias. La ejecución conectada en API 29 completa 23 comprobaciones y
tres salidas por condiciones opt-in (el XML las marca como fallos, pero son
`AssumptionViolatedException` por flags de ensayo desactivados). Build de Functions correcto.

Una reconexión USB elimina los mapeos adb reverse. Si falla el login de ensayo,
comprobar `adb reverse --list` y restaurar los dos mapeos antes de repetir las
credenciales. Durante la preparación se reconectó el transporte y desaparecieron
ambos mapeos. Tras restaurarlos, peticiones HTTP desde el teléfono alcanzaron Auth
(200) y el servidor API (404 en `/`, cuyo endpoint es `/coverage`). Se confirmó
aparte el login de la cuenta ficticia en Auth. Falta repetir el login desde la app.


El mantenedor confirma login por USB con el socio ofertado, lectura del caso con
el aviso de activación de TalkBack, recorrido completo del detalle y lectura de
la confirmación con recuperación del foco al cancelar. Sigue pendiente el
formulario de ausencia: la API local devuelve un turno de mercado habilitado
para `a`, pero volvieron a desaparecer los mapeos USB al reconectarse el transporte.
Se restauraron ambos puertos; falta actualizar la app y continuar la prueba.
No se modificaron datos de prueba ni reglas de negocio para habilitar el botón.


### Comprobaciones guiadas de TalkBack físico superadas — 2026-09-28

En el Xiaomi conectado / Android 14, el mantenedor confirma lectura del caso con
el aviso de activación, recorrido completo del detalle, lectura de la confirmación
y recuperación del foco al cancelar. Tras entrar como `a@example.test`, también
puede seleccionar el turno y escribir un motivo de prueba en el formulario de
ausencia; cerrarlo sin guardar devuelve el foco a Comunicar ausencia. El botón
deshabilitado anterior se observó cuando seguía `d@example.test` en el formulario
de login; no se cambió ninguna regla de negocio. Las reconexiones USB obligaron
a restaurar los dos puertos fijos durante el ensayo. Falta revisar el tamaño
máximo de texto en el dispositivo físico.

### Detalle con XXL en Android físico — 2026-09-28

El mantenedor selecciona XXL, el extremo derecho de Ajustes de fuente de Xiaomi.
La actividad de ensayo informa `fontScale=1.5`; la escala anterior era 1.33. La
captura del listado muestra tarjetas legibles y el mantenedor confirma que todo
el detalle de mercado se lee sin cortes ni solapamientos. El aumento es moderado;
esto acredita el ajuste XXL ofrecido por el dispositivo, no una escala 2.0.
Queda pendiente el formulario de ausencia con XXL. Solo se actualizan notas de
aceptación; no se repiten pruebas automáticas.

### Teclado sobre los botones en Android físico — 2026-09-28

El mantenedor puede escribir el motivo con XXL, pero el teclado tapa Volver;
una captura física confirma el problema. El diálogo pasa a gestionar sus insets
y aplica el espacio seguro fuera de la superficie desplazable, de modo que el
teclado y las barras del sistema limitan la altura disponible. La prueba de
regresión con escala 2.0 espera al teclado real, desplaza hasta Volver, lo pulsa
mediante un toque y comprueba el cierre sin cambiar el snapshot ni crear comandos.

Validación: 502 tests unitarios correctos; lint sin errores (135 avisos previos y
dos sugerencias); compilación de APK Debug y tests correcta. Pasan las tres pruebas
opt-in de cobertura en API 29, incluida la regresión de teclado (sin omisiones).
Logs: `/tmp/hu084-ime-build.log`, `/tmp/hu084-ime-connected.log`. La APK Debug con
configuración solo de demostración queda instalada en el Xiaomi; falta confirmar
la corrección física. Se elimina la configuración Google sintética tras compilar.

El mantenedor confirma después el flujo corregido en el Xiaomi físico: con XXL
y el teclado abierto puede escribir el motivo, desplazarse hasta Volver y cancelar
sin guardar. Queda completada la comprobación física guiada de texto máximo con
escala 1.5; la escala 2.0 solo se acredita en emulador. Tras validar solo cambia
documentación. Se detienen los emuladores/API de ensayo y se eliminan los dos
mapeos USB y el enlace temporal de dependencias. Se reabren Ajustes de fuente para
que el mantenedor restaure XL. Sigue pendiente la entrega real APNs/FCM aislada.
