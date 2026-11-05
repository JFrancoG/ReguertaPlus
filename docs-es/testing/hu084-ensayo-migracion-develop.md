# HU-084: ensayo de migración controlada de develop

La preparación del contenido está publicada en `73001988`. El código y las
pruebas de este ensayo quedan locales después de ese commit. No se añade ningún
endpoint compartido ni se modifica producción, las apps o el planificador.

## Alcance y resultado

El ejecutor sólo admite `demo-reguerta-hu084-migration` y Firestore local en
`127.0.0.1:8798`. Comprueba esas condiciones antes de crear el cliente. Reutiliza
la barrera, la admisión transaccional y los contratos existentes. No presenta la
captura de otro proyecto como metadatos del emulador: después de sembrar los datos
se vuelven a leer sus versiones locales para las comprobaciones de concurrencia.

| Operación | Escrituras en una transacción | Tamaño estimado de la petición aceptada |
| --- | --- | --- |
| Migración | 203: archiva 62 originales, retira sus versiones exactas, crea 72 canónicos y guarda control, base y pruebas | 1.813.600 bytes |
| Reversión | 140: retira los 72 nuevos, restaura los 62 originales y conserva control y pruebas de recuperación | 530.196 bytes |

Los dos presupuestos caben en la admisión existente de 500 escrituras y se
ejecutan completos con el SDK. La autoridad de índices es **local y simulada**;
estos tamaños no sustituyen la medición de los índices desplegados ni autorizan
una operación real.

Se conservan las 72 fechas y las 108 plazas en su orden. Los propietarios siguen
el escenario sintético de develop ya revisado; no se inventa la propiedad
histórica de los turnos antiguos. Las colas continúan en vuelta 2, índice 22. Los
meses de julio/agosto de 2027 que faltan en Mercado siguen pendientes y la frontera
local no declara una temporada completa.

La reversión recupera los 62 documentos íntegros. Sus metadatos de servicio son
nuevos, como ocurre en cualquier restauración, pero los valores de todos sus
campos permanecen iguales. Los archivos y recibos se conservan y el control queda
**cerrado con época de escritura 2**, sin reabrir procesos antiguos. Los 48 usuarios
capturados y los cuatro registros históricos usados como testigos de calendario
no cambian de contenido ni de versión local.

Los handlers reales verifican 72 eventos de activación y 72 de recuperación;
36 creaciones llegan por primera vez después de revertir y los duplicados no
añaden registros. Los 62 retiros y 62 restauraciones antiguos siguen por la ruta
ordinaria sin efectos, por borrado/origen Sheets. No se los presenta como eventos
canónicos auditados. Se bloquean los transportes Google y los tres métodos de
envío FCM usados por el SDK: cero envíos externos y cero efectos de notificaciones
o compensaciones.

El lector y adaptador reales de Sheets, con una copia en memoria, aplican las
53 celdas de ayudante y restauran sus valores. Se conservan las 399 celdas literales
anteriores, los participantes, sus fechas/orden y los metadatos históricos
observados; quedan los dos marcadores técnicos de operación. Se prueban reintentos,
rechazo de autorización, cambios concurrentes y confirmación perdida. Este doble
no certifica formatos, grupos, notas nativas, cuadrículas históricas ni atomicidad
con Firestore; la exclusión duradera del libro compartido sigue pendiente.

## Cómo repetirlo

Desde `functions`, con Node 22 y las dependencias instaladas:

```sh
npm run test:shift-planning:develop-migration
npm run test:shift-planning:develop-migration:emulator
```

Las pruebas privadas necesitan rutas absolutas en `HU084_MIGRATION_EVIDENCE_DIR`
y `HU084_MIGRATION_RESULT_DIR`. Con el emulador ya abierto, `GCLOUD_PROJECT` y
`FIRESTORE_EMULATOR_HOST` deben coincidir exactamente con el destino anterior:

```sh
node --test --test-concurrency=1 \
  test/acceptance/hu084-develop-migration.cjs \
  test/acceptance/hu084-develop-migration-sheets.cjs
```

Sin esas entradas, la aceptación privada se omite; no equivale a haber revisado
los datos reales. Resultado final: build/lint, comprobaciones específicas de CJS y
**91 pruebas correctas**: ocho puras, 62 regresiones de contratos, 15 SDK portables,
una SDK con la captura y cinco de Sheets; sin omisiones ni fallos. Incluye cambios
de versión aunque se reponga el mismo cuerpo, documentos inesperados, cambios de
cohorte/secuencia, reservas de Sheets, versiones de libro contradictorias,
barreras de notificaciones, recibos manipulados y fallos de barrera/registro. Se
prueba también perder la confirmación de un commit del SDK: conserva lo aplicado,
registra la incertidumbre y no repite la escritura aunque pase el plazo simulado.

Los hashes del ejecutor y del recibo están en la
[guía técnica](../../docs/testing/hu084-develop-migration-rehearsal.md). Los datos
personales y las capturas permanecen fuera de Git.

## Antes de aplicarlo en el develop compartido

HU-085 aún debe proporcionar el comando operativo revisado y su admisión,
operador/índices/versión real de Drive, cierre y vaciado de escritores, copia
posterior a ese cierre y paquete exacto de aplicación/reversión con autorización
acotada. Las pruebas locales no acreditan esos controles reales. Siguen visibles
los dos meses de Mercado pendientes. Para este ensayo ya terminado no hace falta
usar el móvil ni repetir las declaraciones de saldo cero y reservas.
## Paquete de revisión vinculado a evidencias — 2026-10-30

La documentación anterior está entregada en `3c06b28d`. El nuevo preparador local
`functions/scripts/prepare-develop-migration-package.cjs` reutiliza las comprobaciones
del censo, elegibilidad, posiciones y receptores desplegados. No crea un cliente
de proveedor ni modifica el ejecutor limitado al emulador. Recibe trece JSON
conservados, fijados por ruta absoluta y SHA-256, y los digests del contenido y la
propuesta previamente revisados. Estos deben proceder del recibo de validación;
recalcularlos tras editar la propuesta no constituye aprobación. Las capturas y
los paquetes privados permanecen fuera de Git. La salida se crea con modo `0600`,
sin sobrescribir archivos existentes y sin opción de ejecución.

El paquete aceptado vincula la captura atómica `2026-10-30T06:48:26.324Z`, versión
278 de la hoja, 742 celdas/notas tipadas, permisos exactos del archivo y su padre,
48 usuarios proyectados, seis índices READY, Functions revisadas, Rules/IAM y tres
jobs pausados. Compara las celdas con la imagen conservada del cambio de propietario
y normaliza únicamente el orden irrelevante de los filtros de eventos de Google.
Son observaciones históricas, no una barrera mantenida entre servicios. Los controles
anteriores de accesos automáticos, colas y denegación de escritura deben actualizarse
en la admisión.

La **vinculación** de la política de fuentes recoge esas autoridades, ambas colas y
cursores sin cambios, compensaciones iniciales a cero y ninguna reserva previa.
El documento de política para ejecución queda nulo: todavía no están admitidos la
continuidad anual, el prefijo heredado ni la frontera del planificador. No se inventan
los mercados ausentes de julio/agosto de 2027. La proyección de 48 socios comprueba
el grupo conservado, pero no basta para inicializar todos los campos ni destinos de
notificación. Planificación, coberturas y repetición de avisos siguen deshabilitadas.
Esta vinculación no se escribe en Firestore.

El plan de ida contiene las 62 imágenes originales con sus versiones exactas,
su retirada, las 72 altas semánticas revisadas con las 108 posiciones ordenadas y
las 53 celdas de ayudantes con sus literales anterior/posterior. Vincula los 117
avisos para conservarlos sin repetirlos. La inversa depende del digest de ida,
restaura todos los campos originales y revierte esos 53 literales. Para borrar
los turnos nuevos exige las versiones y contenidos realmente leídos tras la ida.
Conserva archivos, baseline y marcadores técnicos de Sheets; deja el estado de
seguridad cerrado en época 2, sin restaurar su ausencia inicial. Las marcas de
creación/actualización del servicio no se pueden restaurar. Las formas existentes
suponen 203/140 escrituras; no prueban el presupuesto real de bytes/índices ni una
transacción atómica entre Firestore y Sheets.

Es una revisión exacta de datos conservados e intención estática, **todavía no un
manifiesto ejecutable**. Faltan materializar la política de ejecución, marcadores
y tiempos finales, presupuesto real, escritor y marcadores de Sheets, versiones
renovadas dentro de la barrera, acuerdos de propietario/administradores y aceptación
ADR-0026 de la operación concreta. La inversa necesita además el recibo real de ida.
No se fabrican aceptaciones ni fechas de ventana.

Aceptación privada conservada: `2026-10-30-migration-package`.

| Vinculación | Sufijo SHA-256 tras `shift-planning:v1:sha256:` |
| --- | --- |
| Paquete completo | `ee465d0e2adb646111336d19356d685196c49ed4954834d7e320eeec49d7ac75` |
| Intención estática de ida | `90793bc01d63c0a4f9922e4ed8529e72aaa38adad83304d061ccc69dad87bed9` |
| Intención estática inversa | `fc1d2573b7ddb883e89257655a72734cc98aa3c6c996f228972242b02635a3f4` |

Validación: `npm run test:shift-planning:develop-migration-package`, 83 pruebas locales
correctas, incluidas 19 nuevas sobre recuperación sin pérdidas, vinculación
determinista, cambios de propuesta/versiones/celdas/socios/permisos/controles/índices,
rechazo de sobrescritura y modificación de archivos. Build/lint de Functions y lint
CJS focalizado correctos. No se repite el emulador: no cambia el ejecutor, la barrera,
las apps ni las escrituras SDK. Esto no valida una migración/reversión real.
HU-084/HU-085 y PR #278 borrador siguen abiertos; sin brecha nativa. Siguiente paso:
materializar y ensayar localmente la política cerrada y los manifiestos antes de
solicitar una ventana.

```sh
node scripts/prepare-develop-migration-package.cjs --input /private/manifest.json --output /private/review-package.json
```

El manifiesto contiene `files` (entradas `{path, sha256}`), `reviewedContentDigest`
y `reviewedProposalDigest`. Las claves de archivos son `snapshot`, `sheetCells`,
`referenceCells`, `proposal`, `fileBefore`, `fileAfter`, `filePermissions`, `parent`,
`parentPermissions`, `indexes`, `controls`, `reviewedControls`, `assessment`.

## Política cerrada y manifiestos locales finales — 2026-10-30

El paquete de revisión está entregado y subido en `e9fb31e5`. Esta nueva
implementación queda local. `materialize-develop-migration-package.cjs` verifica
el paquete contra sus trece entradas fijadas y compara todos los contenidos
originales con el clon recién creado y leído en el emulador. No envía las versiones
del servicio original al clon. Rechaza incluso un redondeo de marcas temporales:
Firestore conserva sus campos temporales con precisión de microsegundos, mientras
las imágenes offline retienen todos los dígitos recibidos. No se normalizan pérdidas.

`closedDevelopInitialMigration` es un registro explícito de política cerrada.
Vincula las evidencias revisadas de hoja/índices y deshabilita planificación,
coberturas, compensaciones y repetición de avisos. Continuidad anual, prefijo
heredado y frontera siguen nulos. El productor ordinario rechaza su formato
diferenciado incluso si se abre por error la bandera local de mantenimiento.
No se debilita el parser anual. Las rotaciones conservan el valor centinela 2025
del ensayo cerrado anterior: no es una frontera anual admitida. Sustituir esta
política por una anual sigue siendo trabajo independiente.

El ejecutor existente, limitado a loopback, materializa la transacción final con
el serializador público existente, la reconstruye dentro de la transacción de
ejecución y exige igualdad exacta antes de escribir datos de negocio. El modo
cerrado exige este paso en ambos sentidos. El manifiesto vincula preparación,
dirección, ámbito de barrera, tiempos concretos, todas las mutaciones y sus
precondiciones. Rechaza tiempos futuros o con más de 60 segundos. La inversa
solo se materializa con el recibo real de lectura posterior de la ida; no inventa
versiones futuras. La repetición de operaciones conservadas sigue funcionando
sin reenviar el manifiesto final. La preparación puede guardar evidencia de
barrera en el registro local, pero no modifica documentos de negocio.

El identificador de ejecución se convierte explícitamente a
`request-${reviewForwardId}`, usando el identificador revisado como requestId.
La correspondencia determinista queda fijada en el digest; se conserva el contrato
de identidad de recuperación. Ambas direcciones protegen socios, calendarios,
avisos y configuración; solicitudes, compensaciones, reservas, situaciones de
socios, casos, efectos o trabajos de sincronización/intercambio impiden ejecutar.

Aceptación privada: `2026-10-30-final-migration`, únicamente contra
`demo-reguerta-hu084-migration` en `127.0.0.1:8798`. Resultados conservados:

| Artefacto | Sufijo SHA-256 tras `shift-planning:v1:sha256:` |
| --- | --- |
| Preparación del clon | `4cf80f9b53f6898bcb6253abe52360c7d3e53994abd8c65ef012398791b097c2` |
| Manifiesto final de ida | `d588a58b173da4bab8ec2b0ec5195bd4a16c3fe037b08dfb0aa7a53e97a5f8af` |
| Manifiesto final inverso | `41950f02de9a6849e6a64616d6ca73519fcf8358703e866d8c6d1e4bc19a60ab` |
| Aceptación/manifiestos Sheets | `956899b9841043558abc7d2cd0fd007510009db5205a91e3cff20563657d396b` |

La ida confirma 203 escrituras (estimación de aplicación: 1.844.040 bytes); la
inversa, 140 (532.726 bytes). Se restauran/conservan los 62 originales, 72 turnos
publicados, 108 posiciones, 48 socios, cuatro calendarios y 117 avisos sin repetirlos.
La recuperación deja la seguridad cerrada en época 2. Las estimaciones vinculan
la observación retenida de índices, pero no miden bytes/índices del proveedor
ni conceden admisión real.

El adaptador existente de Sheets materializa y aplica por separado dos lotes
exactos en una copia en memoria de las seis pestañas conservadas: cada uno incluye
53 celdas y dos marcadores técnicos. Vinculan revisión, preparación y recibos
locales de Firestore. Se restauran las 742 celdas/notas tipadas observadas y se
conservan los marcadores técnicos. Los IDs de metadatos y el contador de versión
son locales, no autoridad vigente de Google. No se certifican formatos/celdas
no observados ni atomicidad entre servicios. No se crea un cliente Google.

Validación: 92 pruebas locales + 39 de emulador Firestore + una aceptación Sheets
con imagen retenida, sin fallos ni omisiones en las ejecuciones finales; build/lint
completo de Functions, lint CJS focalizado y diff correctos. Comandos:

```sh
npm run test:shift-planning:develop-final-migration
npm run test:shift-planning:develop-final-migration:emulator
```

La aceptación privada añade `HU084_REVIEW_MANIFEST` y `HU084_FINAL_OUTPUT` al
emulador; la de Sheets añade también `HU084_MIGRATION_EVIDENCE_DIR` para el
mapeo publicado previamente revisado. Las salidas se crean sin sobrescribir,
modo 0600, en directorio privado. Cada ensayo usa otro directorio; las versiones
del clon hacen que sus digests sean propios de esa ejecución.

No se añade ejecutor/endpoint compartido, despliegue, apertura real de mantenimiento
ni acceso a producción. Queda cerrado el ensayo local, no la activación real.
Siguiente paso: conectar el materializador al ejecutor controlado de develop,
preparar su comprobación de admisión de solo lectura y renovar la autoridad antes
de pedir una ventana concreta con acuerdos y aceptación del riesgo. No reutilizar
recibos, tiempos ni aprobaciones del emulador en esa ventana. HU-084/HU-085 y
PR #278 borrador siguen abiertos; sin brecha nativa.

## Ejecutor controlado de develop y admisión pasiva — 2026-10-30

El materializador anterior está publicado en `9a83203f`; remoto y cabecera de la
PR #278 coinciden. La implementación siguiente permanece local.

`develop-shift-migration-engine.cjs` extrae el ejecutor existente y reutiliza su
serialización, barrera y CAS. El envoltorio del ensayo conserva la exigencia del
proyecto demo y host loopback exactos antes de construir el cliente. La nueva
composición `controlled-develop-migration.cjs` recibe un cliente Firestore fijado
a `reguerta-9f27f`, base `(default)` y rutas `develop/plus-collections`. La preparación
compartida exige las versiones originales revisadas, no las del clon. El contexto
de política indica `controlled_develop_preparation`; el nombre histórico del
contenedor `localOnly` no convierte esa evidencia en autoridad del emulador.
No se añade endpoint, despliegue ni CLI de aplicación.

La inspección pasiva lee las fuentes mediante una transacción de solo lectura y
consulta controles ya retenidos. No adquiere/cierra controles ni guarda incidencias.
Todos los informes conservan `canApply:false` y `canEnterMaintenance:false`, incluso
con `checksPassed:true`: no son autorizaciones. Ejecutar exige un informe coincidente
y de un máximo de 60 segundos; reconstruye el manifiesto y vuelve a verificar fuentes,
propietario, administradores y barrera vigente. La inversa depende del recibo real de
la ida. Los fallos al ejecutar conservan el registro de incidencias existente; los
fallos pasivos no declaran una incidencia persistida.

**Comprobación real de solo lectura: bloqueada correctamente.** Se utilizó la
sesión existente de CLI exclusivamente para leer Firestore de develop. El paquete
revisaba solo `config/global`, pero la colección real también contiene
`config/member` y `config/public`. Contenido y versión de global coinciden exactamente.
Es una omisión del censo, no evidencia de que global haya cambiado. La admisión devuelve
`source_not_verified`; no se acredita una coincidencia completa ni una ventana retenida.
Cada transacción de diagnóstico fue de solo lectura: cero consultas a controles,
intentos de cierre o escritura. Un primer fallo de compatibilidad REST/autenticación
no permitió verificar fuentes; el arnés privado reutilizó después la librería de
autenticación compatible del SDK, sin actualizar dependencias ni conceder permisos.
Las observaciones fallidas se conservan separadas.

Validación local: 102 pruebas unitarias y 47 de emulador SDK, sin fallos ni omisiones;
build/lint de Functions y lint CJS pasan. La ida/vuelta controlada con datos retenidos
conserva las 203/140 mutaciones, restaura los 62 originales y preserva los 117 avisos.
Las inspecciones conservan las imágenes y versiones. Controles ausentes/inválidos,
cambios en acuerdos, escrituras tardías, inspecciones caducadas y los documentos de
configuración no revisados bloquean. Sin cambios nativos ni brecha de paridad. El
ensayo anterior de Sheets no cambia ni se repite; esta composición no acredita un
escritor real de Sheets ni atomicidad entre servicios. Evidencia privada:
`2026-10-30-controlled-executor`, con ensayo final en `final/`.

Siguiente paso: ampliar y revisar el censo exacto con los dos documentos de
configuración, regenerar el paquete vinculado y repetir la admisión pasiva. Después,
vincular lectores de controles actuales, destino/escritor de Sheets y acuerdos
expresos de propietario/administradores/riesgo para una ventana autorizada aparte.
Este bloque local no requiere intervención del usuario. Mantenimiento sin abrir;
sin escrituras de negocio compartidas, Sheets, notificaciones, despliegues ni acceso
a producción. HU-084/HU-085 siguen abiertas y la PR #278 en borrador.

## Censo de configuración completo y nueva comprobación de fuentes — 2026-10-30

La composición controlada está publicada en `eb073e0e`; esta corrección permanece
local. El preparador exige el conjunto exacto `config/global`, `config/member` y
`config/public` dentro del censo atómico. Rechaza paquetes antiguos con solo global,
registros ausentes/duplicados/adicionales/de otro entorno, observaciones contradictorias
de global y versiones posteriores a la lectura, con precisión de nanosegundos.
Los tres documentos completos y sus versiones quedan vinculados al resumen de
configuración, las rutas de la política revisada y las guardas del materializador.
Se reutilizan las comprobaciones existentes de ejecución e inversa. Son fuentes
protegidas de solo lectura; la migración no modifica esos documentos.

El nuevo censo GET de `reguerta-9f27f`, `develop/plus-collections`, usa la lectura
fija `2026-10-30T10:29:05.515Z`. Coinciden todos los contenidos y versiones anteriores,
las cinco autoridades ausentes y los registros de recepción/captura/entrega. Se
conservan 62 turnos, 48 socios proyectados, cuatro calendarios, 117 avisos, 12 capturas
y 16 entregas, incorporando los tres documentos config. Member/public ya existían:
faltaban en nuestra evidencia. Member contiene la proyección para la app de caché,
actualización y día de reparto (`WED`); public contiene la política de versiones.
Ambos se conservan completos, sin convertirlos en política del planificador ni
reescribirlos. Se revisaron la proyección de Functions y los consumidores nativos;
sus contratos no cambian.

Los trece archivos del paquete quedan vinculados de nuevo con el censo y su evaluación.
Se mantienen exactamente las fechas, contenidos, 108 posiciones publicadas, 62 imágenes
de restauración y 53 propuestas de celdas de ayudante. Cambian las identidades de
política/planes/operaciones al cambiar la evidencia; no se reutiliza una aceptación
anterior. No se han actualizado observaciones de otros proveedores: Drive/Sheets,
controles e índices siguen siendo evidencia retenida, no una barrera actual.
No se han concedido permisos OAuth/IAM.

Evidencia privada: `2026-10-30-config-census`. Sufijos SHA-256 con prefijo
`shift-planning:v1:sha256:`:

| Artefacto | Resumen |
| --- | --- |
| Censo config | `9fc426e9f3116640eba2c391d78d64986069003adb2c21a828822abd1f6ce270` |
| Paquete revisado | `a2c6923715243faaace634f408520c155c0f9d392bc2719e1cf30a0767bdbf31` |
| Intención de ida | `0864eff73642825dce110c3763fca139f76871af7dbe97601e855e02c36c610a` |
| Intención inversa | `b32f11c9aaba10879cb4441afa4c2596e6c3425c2d747eff5d59390fd955377a` |
| Preparación compartida | `6d8461a2a43f9572eb886494d3af577561ea937f065504b899b1bd40d4291ecd` |

**La comprobación real de fuentes pasa.** Una transacción SDK independiente de solo
lectura verifica todas las fuentes y versiones. El informe se detiene después en
`window_scope_missing`: cero consultas a controles, cierres o escrituras; sin
manifiesto final y con aplicación/entrada a mantenimiento deshabilitadas. No acredita
los demás controles reales, porque no se ha aportado una ventana ni se han invocado.
El estado actual sigue ausente; proyectar revisión/época cero no crea autoridad.

Validación: 113 pruebas unitarias, 50 de emulador SDK, build/lint completo y lint CJS,
sin fallos ni omisiones en las ejecuciones aceptadas. La ida/vuelta del clon renovado
restaura fuentes/configuración/avisos y conserva las 203/140 escrituras. Las pruebas
nuevas rechazan cambios de versión member/public, cambios config antes de la inversa
y documentos no revisados. Dos aserciones iniciales suponían que escribir el mismo
valor avanzaría la versión; ahora realizan un cambio real y lo restauran para probar
la modificación intermedia. La repetición completa pasa. El ensayo previo de Sheets
no cambia ni se repite. Sin cambios nativos ni brecha de paridad.

Siguiente paso: preparar/actualizar los lectores de controles técnicos y la admisión
del escritor/destino real de Sheets vinculados al paquete exacto, antes de solicitar
la ventana expresa de propietario/administradores/riesgo. Sin abrir mantenimiento,
escrituras compartidas o Sheets, despliegues, avisos ni acceso a producción.
HU-084/HU-085 siguen abiertas y la PR #278 en borrador.
