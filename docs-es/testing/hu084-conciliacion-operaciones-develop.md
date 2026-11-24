# Conciliación de operaciones anteriores de develop — HU-084 / HU-085

## Alcance y entrega

El mantenedor autoriza esta investigación de lectura después de entregar el bloque
administrativo y de servidor en `afbcd098f7857e989ae3e4488891d222080764e9`.
Coinciden las cabeceras de remoto y PR en borrador. Se reutilizan #268/#269 y la
PR #278; no se crea otra incidencia ni otro motor operativo.

Se leen Firestore, Cloud Logging y la hoja real configurada para develop. No se
inspeccionan datos de negocio de producción ni registros de Auth o dispositivos;
se usa la sesión configurada sin exponer credenciales. El bloque se limita a
lecturas y generación del informe local. El contenido e identidades originales
quedan en evidencia privada protegida.

## Observaciones conciliadas

| Conjunto observado | Evidencia y tratamiento |
| --- | --- |
| 12 capturas retenidas | Todas se vinculan a los dos recibos de pruebas autorizadas por contenido exacto, identidad del evento y versiones con nanosegundos: ocho creaciones confirmadas y cuatro borrados capturados, con limpieza condicionada y ausencia actual. Ninguna es una orden de negocio retenida que haya que repetir. |
| Primera fase de pruebas | Cinco logs de las revisiones antiguas muestran las salidas por aviso/solicitud/turno malformados y dos finalizaciones del calendario con updatedCount0. La fuente archivada exacta y el ensayo local explican ese cero; que el mensaje diga «reflejado» no significa que se haya escrito en Sheets cuando no se actualiza ningún turno. |
| 62 turnos antiguos actuales | 52 repartos y 10 mercados son coherentes con la importación del 23 de octubre: finalización que declara 62 y HTTP200 del mismo trace, en la revisión anterior al puente. Las versiones y fechas son compatibles; importar lee Sheets y escribe Firestore, y el callback sale para origen google_sheets. No reconstruye imágenes anteriores ni demuestra todas las ejecuciones históricas. |
| 4 calendarios actuales | Se conservan como estado actual; no se inventa el resultado de llamadas externas anteriores. |
| 12 recordatorios recientes | La consulta acotada de 30 días encuentra 12 finalizaciones y 12 HTTP200, enlazados por trace y sin fallo observado. Son coherentes con los 12 avisos recientes, semana/hora y revisión. Crear el aviso es distinto de enviarlo. |
| 117 avisos históricos | Todos siguen como posiblemente entregados y sin reenvío. Se conservan 55 no_tokens/34 partial_success/25 success/3 sin resumen. Esos resúmenes no prueban la recepción en el móvil ni que no hubiera intentos anteriores. |
| Historia anterior | 105 avisos quedan fuera de la ventana de 30 días, incluidos 75 recordatorios. Dos identificadores no estándar y una hora21 antigua no se atribuyen a los tres jobs actuales. Los tres avisos sin dispatch son comunicados administrativos del 1 de abril, no un fallo nuevo de la pausa. |

Los metadatos reales confirman 30 días de retención en _Default y 400 en _Required.
Los segundos no se usan para sustituir la evidencia ausente de callbacks/FCM.
Los tiempos HTTP y de aplicación son relojes distintos del proveedor: compartir
trace, revisión y resultado no crea un intervalo transaccional ni prueba un
vaciado global de operaciones.

## Hoja actual y conjunto de fuentes estable

La importación antigua desplegada apunta a `'TORRE 2025-26'!A:F` y
`'MERCADO 2025-26'!A:C` de la hoja de develop verificada. Esto explica los 62 turnos
antiguos y es distinto de la migración preparada de las temporadas publicadas.

Se leen metadatos antes de seis rangos acotados. Los mapas de userEnteredValue de
las cuatro pestañas de temporada coinciden exactamente con la captura del 27 de octubre:
399 valores (228/85/17/69), conservando sus coordenadas y los datos publicados.
Las dos pestañas históricas configuradas se leen ahora; no había una captura
anterior de sus celdas y no se afirma igualdad histórica. El modifiedTime observado
es el mismo antes/después. Esta comparación no demuestra formatos, exclusión de
otros escritores ni autoridad para entrar en mantenimiento.

El censo de Firestore anterior/posterior conserva los 183 documentos, doce capturas,
entregas/fragmentos y revisión12. La identidad estable del conjunto es
`3227fab3a1571795c984c1317923b6e0d603d7c1fd636d499d0e28bc676de6f4`.
La inspección reciente mantiene los tres jobs PAUSED y la misma configuración,
fuentes de Functions e IAM. legacyUntracked sigue a true.

## Herramienta offline y validación

[reconcile-develop-legacy-census.cjs](../../functions/scripts/reconcile-develop-legacy-census.cjs)
reutiliza inspectCensus. Un manifiesto privado liga los bytes del censo/recibos y
la identidad del conjunto; la salida usa wx y una carpeta privada. Recibos
duplicados/contradictorios, fuentes recreadas, diferencias de contenido/versión/
metadatos y un recibo de revisión posterior al censo no permiten clasificar una
captura como prueba coincidente. La evidencia adicional solo aporta procedencia;
no actúa como adaptador de terminalidad o autoridad. physicalHandoffReady,
canEnterMaintenance y canApply se mantienen a false.

Desde functions:

```sh
npm run build
npm run lint
npm run test:shift-planning:develop-legacy-reconciliation
node scripts/reconcile-develop-legacy-census.cjs --input '/ruta/privada/manifiesto.json' --output '/ruta/privada/nuevo-informe.json'
```

Pasan build/lint completos, lint focal de CJS y 40 pruebas, sin fallos ni omitidas.
Se repiten las 19 pruebas anteriores con el helper compartido y se añaden 21 de
clasificación/CLI. La revisión independiente detecta y corrige recibo 12/censo 6.
Los dos manifiestos reales anterior/posterior clasifican 12 capturas coincidentes
y cero sin vínculo. Las apps no cambian y se reutiliza su validación no afectada.
El mantenedor autoriza entregar el código de conciliación; la evidencia exacta
de commit/remoto queda registrada en #268/#269 y la PR en borrador #278.

## Límite de admisión y siguiente paso acotado

Queda clasificado el conjunto observado y registrada la historia no recuperable.
No demuestra el universo completo de invocaciones antiguas, la terminalidad de
efectos externos ni los ocho contadores causales a cero exigidos por la barrera.
No se limpia legacyUntracked, se reenvían avisos ni se fabrican intents/leases
modernos para convertir una investigación terminada en permiso de mantenimiento.

El siguiente paso es reunir la evidencia real de admisión: controles restantes de
escritores automáticos/colas/operaciones en curso, participantes y una ventana
concreta acordada. Si queda un efecto externo físicamente incierto, se aplica la
salida de incidencia acotada existente en HU-085; no se acepta un cierre global
implícito. Las observaciones de este informe no exigen decisión humana ni prueba
en un dispositivo ahora.

## Conciliación de efectos tras cerrar recordatorios — 2026-10-29

El cierre directo de recordatorios y su despliegue están commiteados/pusheados como
`34aa7aaec1b9ddcd44b970b540ec700a4f4e80c1`, comprobado contra el remoto. Esta conciliación
posterior es de solo lectura y su documentación permanece local.

La consulta acotada de logs de aplicación develop comprende del 2026-09-29 a las
16:55:14 UTC al 2026-10-29 a las16:55:14 UTC en seis servicios antiguos exactos.
Paginación agotada:20 registros de aplicación y20 peticiones de las mismas trazas.
Solo se leyeron peticiones de trazas encontradas en develop. Las revisiones anteriores
al bloqueo coinciden con las fuentes desplegadas revisadas; no se leyeron datos de
producción, dispositivos ni tokens.

- **12 intentos FCM conciliados:** el ID de evento enlaza log final y resumen actual
  de Firestore; coinciden cantidades aceptadas/fallidas, estado y usuarios resueltos,
  existen marcas temporales y cada traza/revisión exacta tiene HTTP200. El SDK registra
  seis éxitos y seis fallos de envío. El log antiguo no conservó códigos de error;
  un fallo no se convierte en prueba de que no hubo entrega. Acredita esos intentos del servidor, no recepción en el móvil,
  ausencia de otros intentos ni permiso para reenviar.
- **Tres importaciones terminadas:** los días12,14 y23 de octubre registran62 turnos
  importados y HTTP200 de la misma traza/revisión. Leen Sheets y escriben Firestore;
  no prueban una exportación a Sheets. La última concuerda con la base actual.
- **Cinco salidas de ensayos anteriores:** aviso/petición/turno malformados y dos
  operaciones de calendario con updatedCount0, todas con HTTP200 de su misma traza.
  El log antiguo del calendario precede al posible aviso: por sí solo no acredita
  el final de toda la operación. Con contador0 no se ejecuta esa rama de notificación.
- **Fuentes actuales estables:** la instantánea a las16:54:40 UTC del 2026-10-29
  conserva los183 documentos fuente,12 capturas y16 entregas frente a la captura
  anterior de preparación de ventana, incluyendo imágenes/versiones exactas.
- **Seis rangos Sheets sin cambios:** cuatro rangos de temporadas A1:F100/A1:C100
  conservan399 valores tipados (228/85/17/69); TORRE histórico A1:F150 y MERCADO A1:C100
  conservan343 (270/73). La igualdad de coordenada/tipo/valor conserva fechas/orden
  inspeccionados. modifiedTime de Drive permanece igual antes/después. No acredita
  formato, celdas no inspeccionadas, exclusión de escritores ni terminación pasada.

Evidencia privada en `2026-10-29-effects-reconciliation`: consultas/páginas acotadas,
censo atómico, capturas de hoja y `effects-reconciliation-private.json`.
Cinco comprobaciones negativas rechazan alteraciones de cantidades/estado/ID/revisión/
entorno. Sin cambios de aplicación: reutilizar build/lint y15 pruebas locales/24 de
emulador del bloque entregado. Se comprueban diff y alineación bilingüe de la documentación.

### Clasificación finita y siguiente control

Los105 avisos antiguos quedan como historial no verificable, posiblemente entregado
y nunca reenviable; **no son105 envíos pendientes**. Se conservan los resúmenes
55 no_tokens/34 partial_success/25 success/tres ausentes. La falta de logs no demuestra
operación activa, cero trabajo antiguo ni universo completo de invocaciones.
No apareció un final de exportación develop a Sheets en esta consulta acotada; la
igualdad de celdas actuales no sustituye la evidencia de terminación externa.
No borrar legacyUntracked ni admitir mantenimiento/migración por estas observaciones.

Se cierra esta búsqueda histórica finita, sin repetir consultas a logs caducados.
Solo se reabre con nueva evidencia causal. El siguiente control útil es la autoridad
actual de credenciales/destinos automáticos y los escritores efectivos de la hoja,
vinculando terminación de llamadas anteriores o aislamiento efectivo. Los envíos
físicamente inciertos siguen el proceso de incidencia acotada existente, sin inventar
contadores a cero ni convertir la incidencia en admisión satisfactoria. Recabar acuerdos
nuevos de propietario/administradores cuando estén listos los controles. Esta conciliación
no requirió pruebas en móviles, nueva política ni modificaciones en servicios reales.
