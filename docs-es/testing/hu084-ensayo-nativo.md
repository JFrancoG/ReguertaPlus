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
HTTP sin TLS. iOS emplea la composición de pruebas existente con push desactivado.
Estas rutas no se registran en Release.

Contraseña común del escenario: `local-fixture-password`.

- `d@example.test`: abrir mercado, aceptar la oferta y comprobar su lectura posterior.
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
validaciones habituales. Este ensayo no acredita efectos de notificaciones/Sheets,
despliegue real, VoiceOver ni la matriz completa de dispositivos y tamaños.

Después de confirmar el reparto como admin, ejecutar la lectura del crédito en AX5
con `TEST_RUNNER_COVERAGE_CREDIT_REHEARSAL=1` y
`-only-testing:ReguertaUITests/CoverageRehearsalUITests/testLocalEarnedCreditAtAccessibilitySize`.
Requiere el reparto realizado y se omite sin esa variable explícita. Conserva una
captura en el resultado de pruebas.

## Ensayo de efectos de cobertura

`npm run test:shift-coverage:emulator` incluye ahora la integración de comando,
Sheets y bandeja de avisos. Solo utiliza el proyecto demo fijo de Firestore y la
simulación existente de la API de Sheets (`coverage-rehearsal-book`). No consume
automáticamente la fixture de la UI nativa ni conecta con un libro compartido.

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
la navegación específica desde el aviso, el envío real y la recuperación y activación
gobernadas sobre libros compartidos. La reserva del ensayo no es un bloqueo de
producción distribuido entre todos los escritores.
