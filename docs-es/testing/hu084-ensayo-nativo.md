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
