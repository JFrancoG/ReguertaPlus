# HU-084: inspección operativa de develop

Estado: borrador de procedimiento de sólo lectura. La fuente de inspección está
preparada y no desplegada. La entrada y el proveedor, con su forma concreta de
invocarlos, deben revisarse antes de usarlos.
Este documento no autoriza despliegues, cambios de permisos, entrada en
mantenimiento ni escrituras de datos.

[English version](../../docs/testing/hu084-develop-operative-inspection.md).

## Alcance

El proyecto fijo es `reguerta-9f27f` y el entorno lógico es `develop`.
Inspeccionar sólo su libro configurado de develop y `develop/plus-collections`.
Conservar las 72 fechas publicadas y sus 108 plazas en orden, los 62 turnos
antiguos íntegros y las apps actuales. No aplicar las 53 propuestas de ayudante,
generar los meses de julio/agosto de 2027 que faltan en Mercado, inicializar
coberturas ni declarar preparado el planificador.

El [ensayo local de migración](hu084-ensayo-migracion-develop.md) acredita sus
contratos aislados. Su contador de libro, autoridad de índices y controles
simulados no prueban el estado de los servicios compartidos. El ejecutor limitado
al emulador debe seguir así: cambiar su condición de proyecto/destino no crea una
entrada operativa.

Los metadatos del proyecto compartido pueden describir Functions o Rules que
sirven a ambos entornos. Registrar ese alcance sin leer datos de la aplicación
ni el libro de producción, cambiar controles compartidos o asumir que el nombre
de una ruta demuestra aislamiento de develop.

## Acceso observado el 27/10/2026

La inspección actual del operador acredita únicamente estos hechos, que deben
renovarse y no constituyen una comprobación de mantenimiento:

| Superficie | Resultado observado | Lo que sigue sin acreditar |
| --- | --- | --- |
| Firebase / API de Functions | Proyecto compartido esperado; 19 Functions del proyecto están `ACTIVE` en `europe-west1`, todas Node 22 bajo la misma identidad Compute | Cierre de escritores, despliegue del candidato, permisos efectivos y entregas vaciadas |
| Revisión del trigger de turnos | `onShiftWritten` sigue en `onshiftwritten-00016-num`, del 7 de abril; los triggers de Firestore afectados comparten rutas `{env}` | Aislamiento de develop y compatibilidad del código desplegado con la nueva migración |
| Rules reales de Firestore | La lectura de su fuente no muestra una barrera explícita de turnos/calendario ni de colecciones privadas de planificación; la regla general para autenticados excluye sólo `orders` | Cierre de escritores directos; las Rules actualizadas del repositorio no están desplegadas |
| Estado de control de planificación | Las cinco rutas exactas de abajo se han vuelto a leer con resultado `NOT_FOUND` | No permite concluir que no haya trabajo pendiente, que los escritores estén controlados o que exista una barrera cerrada |
| Permisos del libro de develop | Se ven un propietario y dos permisos de escritura de cuentas de servicio | Control efectivo de escritura del propietario, otras autoridades o automatizaciones y escritor exclusivo |
| Ubicación en Drive | La respuesta normalizada no aporta metadatos de una unidad compartida | Ubicación y capacidades suficientes para establecer un cierre reversible del propietario |
| Versión de Drive | El conector omite la versión numérica `version` | Versión real; la fecha de modificación o los IDs del historial no la sustituyen |
| ADC local existente | Hay credenciales, pero las lecturas intentadas de archivo/about de Drive devolvieron `403 insufficientPermissions` | Una credencial con los ámbitos de lectura revisados y acceso al archivo |
| Cuentas de gcloud | No aparecen cuentas con sesión iniciada en la CLI | Esto no significa que no exista ADC ni justifica sobrescribirlo |
| Permisos de tokens del runtime | La prueba de `getAccessToken` y `getOpenIdToken` no devolvió permisos concedidos | Suplantar al runtime; esa prueba de dos acciones no describe todos los permisos efectivos de IAM ni de escritura |
| Cuenta de operador configurada | IAM GET sobre la cuenta declarada por la fuente HTTP devolvió `404` | La identidad no está disponible hoy; siguen pendientes crear la cuenta, conceder invocación y cualquier despliegue |
| Índice de solicitudes de planificación | La API directa devolvió cinco índices de `orders`, `orderLines` y `products`, incluso al pedir el grupo concreto, sin continuación de página | No se observó el índice de `shiftPlanningRequests` definido localmente; esta respuesta aparentemente sin filtrar no demuestra ni su ausencia ni su preparación |

No sobrescribir ADC, iniciar o cerrar otras sesiones, reactivar el auditor
retirado de HU-083, suplantar al runtime, conceder permisos ni mostrar tokens para
resolver estas carencias. La revocación del auditor y la restauración de permisos de septiembre
son pruebas históricas; no se puede asumir que aquella ventana de acceso o su
copia conservada sigan disponibles hoy.

Los metadatos de Functions conservados de septiembre contienen seis funciones
entonces activas, con revisiones de abril. Sirven para comparar, no como
inventario actual ni como prueba de que sus identidades de ejecución sigan igual.

La observación de Rules es una comparación de fuente, no una prueba de
escritura/explotación. No autoriza a aplicar las Rules del repositorio. Cada
índice devuelto debe corresponder también al recurso padre y grupo de colección
solicitados: resultados ajenos no prueban el inventario necesario ni su preparación.

## Fuente de inspección preparada

La exportación preparada `inspectDevelopShiftMigration` está restringida por IAM
y reutiliza la constante de identidad del operador en la fuente. Esa cuenta
devuelve actualmente `404` en IAM; no se puede asumir una invocación disponible.
Siguen pendientes crear la cuenta, conceder invocación y desplegar. Su cuerpo
POST exacto es:

```json
{"schemaVersion":1,"environment":"develop","operationId":"inspection-example"}
```

Es un ejemplo de formato, no un comando para invocar un servicio desplegado.
Esta lectura no incluye un digest de aprobación: la huella de celdas es distinta
del digest semántico de la propuesta y ninguno autoriza a aplicarla. Devuelve
sólo un resumen sin datos sensibles, siempre `canApply:false`, con
`Cache-Control: no-store`. No hay ruta para aplicar/reabrir.

La fuente exige `SHEETS_SPREADSHEET_ID_DEVELOP` y un
`SHIFT_SHEETS_ALIASES_DEVELOP` revisado y no vacío, sin alternativa en otro
entorno. Sus ámbitos Google son `spreadsheets.readonly` y
`drive.metadata.readonly`. Estas condiciones de la fuente no conceden los
ámbitos OAuth ausentes ni acreditan que los escritores estén bloqueados.

## Orden de recogida de sólo lectura

1. Fijar el commit inspeccionado y cargar el
   [inventario de escritores](../../spec/shifts/hu-082-continuous-seasonal-shift-rotation/writer-inventory.md)
   compilado. La versión 3 contiene 26 escritores lógicos: 20 controles de
   barrera y seis comprobados por versión en la activación. Vincular su revisión
   y digest; no sustituirlos por nombres de Functions ni por el documento antiguo
   de versión 2.
2. Verificar el proyecto activo antes de usar cada proveedor. Obtener el libro
   exacto de develop desde la configuración protegida y comparar su huella.
   Registrar presencia y destino de parámetros sin publicar IDs, enlaces,
   valores, identidades de cuentas o credenciales. La inspección recibe las dos
   claves de develop anteriores. Las claves antiguas de rangos/importación
   pertenecen a la comparación del despliegue; no sustituyen los alias exigidos
   ni autorizan a modificar parámetros.
3. Leer las Functions actuales y los metadatos concretos de Cloud Run/Eventarc,
   Rules e índices necesarios para relacionar cada escritor con su despliegue.
   Incluir las entradas privadas de recuperación/importación/sincronización y
   los nuevos trabajadores cuando existan. Una factoría sin desplegar no es un
   trabajador real deshabilitado; una lectura ausente o denegada no es una cola
   vacía. No invocar entradas que escriban ni leer logs compartidos sin filtros
   que puedan contener datos de producción.
4. Leer `shiftPlanningState/current`, `shiftPlanningState/sourcePolicy`,
   `shiftPlanningState/sheetsSubmission`, `shiftRotations/delivery` y
   `shiftRotations/market`, todas bajo `develop/plus-collections`, más los
   inventarios acotados de trabajo de develop. Distinguir trabajo ejecutable,
   en curso e incierto conservado. `reconciliationRequired` y un `pending` con un
   lote posiblemente enviado no están resueltos porque haya vencido su bloqueo.
5. Capturar metadatos y cuadrículas del libro según sus dimensiones observadas.
   Incluir las seis pestañas conocidas al recoger una base completa de develop;
   la captura anterior de cuatro cuadrículas no acreditaba las históricas.
   Acreditar notas nativas, formatos, grupos, combinaciones o protecciones sólo
   cuando el proveedor los devuelva. Conservar fechas, orden de participantes,
   anotaciones y ayudantes vacíos.
6. Obtener la versión real del archivo de Drive, propietarios/roles, capacidades
   y ubicación mediante un proveedor autorizado. Cuando se necesite acreditar
   estabilidad, leer la versión antes y después de las cuadrículas. Sin
   `version` no queda acreditada: no introducir un contador del emulador ni
   interpretar un campo omitido por el conector como inexistente.
7. Recoger las observaciones disponibles de autoridad efectiva de IAM,
   cargas/claves de cuentas de servicio, grupos heredados y Drive/Workspace/Apps
   Script. Mantener como carencias los ámbitos no accesibles. Los permisos
   directos no demuestran por sí solos que no existan Apps Script, OAuth,
   ediciones sin conexión, delegación de dominio o escritores privilegiados.

Las herramientas conectadas de Firebase permiten las lecturas soportadas de
proyecto, Functions, Rules, índices y Firestore acotado. Las de Drive permiten sus
metadatos y celdas soportados. Una lectura correcta no prueba visibilidad completa
de IAM, Workspace o Apps Script. gcloud está instalado, pero su uso sigue
necesitando una identidad de lectura autenticada y un alcance concreto; tener la
CLI no demuestra disponer de esos permisos.

## Resolver la autoridad de lectura pendiente

Quedan dos alternativas propuestas, pendientes de revisar fuente y alcance:

- Una sesión OAuth autorizada por el usuario: enumerar primero los ámbitos
  exactos y el acceso más amplio que conceden sobre su cuenta; limitar el
  recolector al archivo y recursos de develop revisados, conservando ADC y las
  sesiones ajenas. Un token que falla no autoriza a emitir o reutilizar otro.
- Una entrada privada de inspección: revisar primero fuente, listas permitidas
  de develop/archivo, identidad que invoca y ejecuta, llamadas de sólo lectura,
  salida sin datos sensibles y pruebas. Su despliegue es una acción concreta
  posterior de infraestructura. No debe tener modo aplicar/reabrir, y existir
  no demuestra que su cuenta sea la única que puede escribir en el libro.

Ninguna alternativa cierra escritores, cambia propietarios o habilita coberturas.
El nombre anterior describe fuente preparada; no se proporciona una URL ni una
invocación real antes de revisar su despliegue concreto y la identidad de lectura.

## Informe y paso operativo posterior

Validación local desde `functions`: `npm run test:shift-planning:develop-inspection`
y `npm run lint`. Los 58 casos aprobados cubren el proveedor de lectura, la entrada
HTTP, la composición HTTP real en loopback con dobles de Google y las regresiones
de Sheets/configuración/operador. No acreditan IAM desplegado ni acceso a Drive.

Las lecturas acotadas con máscara en develop de `shiftPlanningRequests`,
`shiftPlanningSyncCommands`, `shiftCoverageEffects` y `shiftSwapRequests`
no devolvieron documentos ni token de paginación. Estas observaciones no
acreditan que no queden ejecuciones en curso ni que los escritores estén cerrados.

Conservar las observaciones originales en privado y con acceso restringido. El
informe sin datos sensibles debe vincular commit, revisión/digest del inventario,
horas de observación y huellas de entrada, separando hechos, lecturas no
soportadas/no disponibles y controles pendientes. Registrar fallos de permisos
sin tokens, credenciales, datos personales o identificadores del libro. Una
inspección con carencias puede producir un informe válido de lectura; no puede
afirmar cerrado, vaciado, escritor exclusivo o preparación operativa sin pruebas.

Antes de una operación de mantenimiento posterior, el propietario debe resolver
un cierre efectivo y reversible de propietarios, editores y automatizaciones,
además del tratamiento de Functions/Rules compartidas con producción. Confirmar
que los editores están conectados, han cerrado el archivo y no tienen ediciones
pendientes es distinto de un cierre técnico de permisos. Un propietario de Mi
unidad no queda bloqueado por quitar a otros editores. No transferir/mover el
archivo ni deshabilitar una revisión compartida como consecuencia implícita de
esta inspección.

Las implementaciones reales de `closeAndCollect`/`readBackClosed`, las
autoridades separadas, la copia posterior al vaciado, la autoridad real de
índices/Drive y la autorización exacta de aplicación/reversión siguen en HU-085.
La inspección debe alimentar ese paquete revisado, no presentar comprobaciones
simuladas como si los controles estuvieran cerrados.
