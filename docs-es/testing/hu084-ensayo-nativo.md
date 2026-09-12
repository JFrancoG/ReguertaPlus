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
