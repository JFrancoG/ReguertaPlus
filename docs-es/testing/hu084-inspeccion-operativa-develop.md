# HU-084: inspección operativa de develop

Estado: la inspección privada de develop está desplegada y verificada con
identidades separadas. El acceso al libro es de lector; se ha retirado y comprobado
el permiso humano temporal para generar tokens OIDC. Esta operación no incluye
migración, mantenimiento, cambios de escritores compartidos ni escrituras de
datos de la aplicación.

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

La inspección inicial de sólo lectura acreditó estos hechos antes de preparar
las identidades separadas que se describen abajo. Son observaciones previas
que deben renovarse, no una comprobación de mantenimiento:

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
| Permisos de tokens del Compute compartido (lectura inicial) | La prueba de `getAccessToken` y `getOpenIdToken` no devolvió permisos concedidos | Suplantar al runtime; esa prueba de dos acciones no describe todos los permisos efectivos de IAM ni de escritura |
| Cuenta de operador propuesta inicialmente | IAM GET sobre la cuenta del operador de recuperación reutilizada por la primera fuente HTTP devolvió `404` | Esa observación previa no describe el estado de las identidades de inspección separadas creadas abajo |
| Índice de solicitudes de planificación | La API directa devolvió cinco índices de `orders`, `orderLines` y `products`, incluso al pedir el grupo concreto, sin continuación de página | No se observó el índice de `shiftPlanningRequests` definido localmente; esta respuesta aparentemente sin filtrar no demuestra ni su ausencia ni su preparación |

No sobrescribir ADC, iniciar o cerrar otras sesiones, reactivar el auditor
retirado de HU-083, suplantar al runtime Compute compartido ni mostrar tokens
para resolver estas carencias. Sólo se autorizan los cambios acotados de
identidad y acceso que se describen abajo. La revocación del auditor y la
restauración de permisos de septiembre
son pruebas históricas; no se puede asumir que aquella ventana de acceso o su
copia conservada sigan disponibles hoy.

Los metadatos de Functions conservados de septiembre contienen seis funciones
entonces activas, con revisiones de abril. Sirven para comparar, no como
inventario actual ni como prueba de que sus identidades de ejecución sigan igual.

La observación de Rules es una comparación de fuente, no una prueba de
escritura/explotación. No autoriza a aplicar las Rules del repositorio. Cada
índice devuelto debe corresponder también al recurso padre y grupo de colección
solicitados: resultados ajenos no prueban el inventario necesario ni su preparación.

## Contrato de inspección desplegado

La exportación desplegada `inspectDevelopShiftMigration` está restringida por IAM.
La fuente fija las identidades separadas de ejecución e invocación descritas
abajo. El despliegue y una invocación real correcta están verificados; estas
identidades son distintas del operador de recuperación y del runtime Compute
compartido. Su cuerpo POST exacto es:

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

## Visibilidad del lector y comprobación real

Drive no permite a un lector consultar los permisos detallados del archivo.
Cuando el observador no puede compartirlo, el proveedor no solicita ese inventario:
los permisos privados, `permissionCount` y `ownerCount` quedan en `null`, con el
bloqueo explícito `workbook_permission_inventory_unavailable`. Un inventario
desconocido no es una lista vacía; su huella sólo identifica esta observación
incompleta. Se mantienen las lecturas de versión y cuadrículas acotadas. La entrada
siempre devuelve `canApply:false`. Véanse los [roles de Drive](https://developers.google.com/workspace/drive/api/guides/ref-roles).

La comprobación desplegada leyó las seis pestañas con versión de Drive **259**
al principio y al final. El acceso anónimo devolvió 403; GET autenticado, 405;
y las peticiones de producción o con libro elegido por el solicitante, 400.
La lectura válida de develop devolvió 200, `no-store`, huellas sanitizadas y
recuentos de permisos desconocidos. Las 19 Functions anteriores conservan sus
revisiones y los metadatos comparados; al comparar los filtros de eventos se
normaliza el orden que la API devuelve sin significado. Ninguna de las dos
cuentas nuevas tiene asignaciones directas de roles del proyecto.

La aceptación local suma 63 pruebas sin fallos ni omisiones, lint/build limpios,
comprobaciones CJS y filtro de un único destino. Los registros de fallo sólo
incluyen códigos y etapas locales fijos; no registran ni devuelven mensajes
originales del SDK, causas, URLs, identidades ni celdas. La primera lectura válida
devolvió 503; la corrección conserva el acceso de lector sin ampliarlo.

## Identidades separadas y despliegue aislado

La autorización se limita a `reguerta-9f27f`,
`inspectDevelopShiftMigration` en `europe-west1` y el libro configurado de
develop. No permite desplegar las demás Functions, Rules ni índices.

- Ejecución: `reguerta-shifts-inspector`. Invocación: `reguerta-inspect-invoker`.
  Se han creado ambas cuentas. Su comprobación posterior devolvió cero claves y
  cero asignaciones directas de roles del proyecto. Esto no acredita la ausencia
  de todo permiso heredado. No se ha generado una clave para esta operación.
- La cuenta humana que despliega ya tenía permiso `actAs` heredado sobre la
  identidad de ejecución; no se añadió otra asignación para ello.
- La asignación humana temporal de
  `roles/iam.serviceAccountOpenIdTokenCreator` se limita a la cuenta invocadora
  y se creó con caducidad de una hora. Se utilizó sólo para obtener un token OIDC con este
  servicio como destinatario: no incluye `getAccessToken`, firma ni emisión
  general de tokens OAuth. La asignación se retiró tras validar. La política directa queda vacía y otra
  petición real a `generateIdToken` se rechaza con 403. No se guardaron tokens.
  La observación de la consulta de permisos se conserva aparte y no se usa como
  prueba de cierre.
- El permiso de servicio de la cuenta invocadora se limita a esta nueva
  inspección privada. Es una cuenta distinta del operador de recuperación.
  La identidad de ejecución sólo necesita acceso como lector al libro
  configurado de develop; esta operación no le concede escritura ni acceso al
  libro de producción.

El intento del conector de Drive de añadir el permiso de lectura devolvió
`403 appNotAuthorizedToFile`. El mantenedor compartió la Sheet de develop como **Lector** con la cuenta de
ejecución y el conector propietario comprobó ese rol. Después pasó la lectura
real de las seis pestañas. La observación del propietario sobre la compartición
y el inventario detallado no disponible para el lector siguen siendo evidencias
distintas. Este error no autoriza a
sustituir ADC, iniciar otra sesión OAuth o ampliar el acceso del conector.

### Configuración aislada de CLI y comprobación local del paquete

Usar una configuración privada de Firebase con la base de código `default` existente,
la ruta absoluta de `functions`, un `configDir` privado y
`disallowLegacyRuntimeConfig:true`. El directorio privado sólo contiene los
valores dotenv revisados de develop: `SHEETS_SPREADSHEET_ID_DEVELOP` y
`SHIFT_SHEETS_ALIASES_DEVELOP`. No copiar el dotenv global, valores de producción
ni el Runtime Config antiguo. Excluir `.env*` y `.secret*` al empaquetar la
fuente. La CLI proporciona las variables reservadas del proyecto.

El selector exacto es `--only functions:inspectDevelopShiftMigration`, con
`--project reguerta-9f27f`, el `--config` privado y `--non-interactive`,
**sin `--force`**. El predeploy ejecuta lint y build. Antes de ejecutarlo,
terminar los 63 casos sobre la fuente fijada y revisar el manifiesto local del
SDK con el filtro de la CLI: exigir sólo esta entrada, las identidades fijas de
ejecución e invocación, ningún secreto y ningún trigger de eventos. Esta
comprobación del paquete no debe llamar a `firebase deploy --dry-run`: la
preparación de la CLI puede habilitar APIs antes de aplicar el filtro de
funciones, incluso durante ese ensayo.

Comprobar las APIs necesarias antes del despliegue. Conservar las políticas de
limpieza compartidas de Artifact Registry; `--force` puede configurar una si
falta. Si la CLI informa de un error de esa política después de desplegar,
comprobar el estado real de la Function antes de repetir: la entrada puede
haberse creado ya.

La validación local actual ha aprobado los 63 casos, lint/build y el filtro del
paquete con exactamente una entrada. Las lecturas previas al despliegue han
encontrado las diez APIs necesarias habilitadas y una política existente de
limpieza de Artifact Registry; no se cambió ninguna. No se inició ninguna sesión
global de Cloud SDK. Son observaciones anteriores al despliegue.

La aceptación del despliegue verificó la identidad separada de ejecución, la
política privada de invocación, el rechazo anónimo y la respuesta autenticada sin
datos sensibles. Se retiró la asignación humana temporal de OIDC; otra petición
de token se rechazó con 403. Estos pasos de acceso y
despliegue no cierran escritores, cambian propietarios ni permiten usar la
inspección como migración.

## Informe y paso operativo posterior

Validación local desde `functions`: `npm run test:shift-planning:develop-inspection`
y `npm run lint`. Los 63 casos aprobados cubren el proveedor de lectura, la entrada
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

El siguiente bloque es la [propuesta de controles reversibles de develop](hu084-controles-escritores-develop.md); no cierra escritores ni reutiliza la versión 259 como observación nueva de mantenimiento.
