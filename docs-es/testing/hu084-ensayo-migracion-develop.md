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
