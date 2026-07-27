# ADR-0007: Aplicar autorizacion Firebase mediante enlaces de identidad del servidor

## Estado

Aceptada - Fase 1 live; corte estricto pendiente de adopcion de identidades

## Fecha

2026-07-26

## Contexto

Reguerta guarda socios bajo identificadores internos estables, mientras que
Firebase Authentication identifica las sesiones mediante un UID. Las Security
Rules de Firestore no pueden consultar la coleccion `users` para descubrir que
documento interno corresponde a un UID. La busqueda previa por email y el
enlace de UID desde cliente no permitian, por tanto, unas reglas deny-by-default.
Ademas, el acceso autenticado era demasiado amplio y las Functions HTTP
publicas que usan Admin SDK podian saltarse cualquier regla de Firestore.

Android e iOS usan el mismo proyecto Firebase y mantienen datasets
intencionadamente cercanos en `develop` y `production` para los flujos de
testers. La eleccion de entorno no es una frontera de autorizacion. Reviewer es
una persona de enrutado en runtime, no un rol de negocio persistido.

Ese proyecto Firebase tambien lo consumen los binarios Android e iOS publicados
y actualmente en uso. Un despliegue de Rules afecta inmediatamente a clientes
antiguos y nuevos, con independencia de que build origine la peticion. Una
migracion segura debe tener en cuenta dos arboles Firestore independientes en
ambos entornos: las apps legacy publicadas usan `<env>/collections/**`, mientras
Reguerta+ usa `<env>/plus-collections/**`. Hay que conservar cada camino legacy
legitimo sin debilitar el arbol aislado de Reguerta+.

El `config/global` de Reguerta+ mezclaba tambien informacion anonima de versiones de arranque
con datos operativos privados y allowlists de reviewer. Firestore no puede
devolver solo determinados campos del documento segun quien lo lea.

## Criterios de decision

- Resolver de forma determinista un UID Firebase a un unico socio Reguerta+ en
  Rules.
- Aplicar roles y propiedad desde el estado actual de Firestore para que una
  desactivacion o revocacion sea inmediata sin esperar al refresco de claims.
- Cerrar los bypasses de Admin SDK en todas las Functions HTTP mutantes.
- Mantener la misma matriz de permisos en `develop` y `production`.
- Conservar los IDs internos y la matriz canonica de roles.
- Permitir el chequeo de versiones antes de autenticar sin exponer config
  privada.
- Hacer auditable el despliegue y rollback con emuladores y scopes pequenos.

## Opciones consideradas

### Usar el UID de Firebase Auth como ID de todos los documentos `users`

Descartada porque los IDs internos estables ya aparecen en pedidos, productos,
turnos, compromisos, notificaciones e historicos. Reidentificar todos los
documentos seria una migracion de alto riesgo ajena al objetivo.

### Guardar los roles solo como custom claims

Descartada como fuente principal porque los cambios quedan cacheados en tokens
ya emitidos. Los claims podrian servir en el futuro para puertas gruesas de
infraestructura, pero el estado vivo del socio en Firestore sigue siendo la
autoridad.

### Mantener las consultas de socio por email desde cliente

Descartada porque Security Rules no filtra resultados y no puede usar una query
para resolver al caller antes de autorizar esa misma query. El email y el enlace
de UID son operaciones sensibles del servidor.

### Enlace UID propiedad del servidor mas documento vivo del socio

Seleccionada. Requiere dos lecturas deterministas y funciona tanto en las Rules
de Firestore como en las de Storage.

### Desplegar Rules estrictas tras validar solo los clientes nuevos

Descartada. Que las implementaciones candidatas Android e iOS pasen en emulador
no demuestra que los binarios publicados hayan dejado de usar consultas amplias
de `users`, `config/global`, eventos de notificacion o escrituras directas.
Cerrar esas rutas dentro del mismo arbol vivo antes de la adopcion convertiria
una mejora de autorizacion en una interrupcion de produccion. Esto no impide
aplicar Rules estrictas al arbol separado `plus-collections` tras validar sus
propios clientes y la migracion de datos.

## Decision

La autorizacion Firestore tiene dos matrices explicitas y no solapadas bajo
cada prefijo de entorno:

1. `<env>/collections/**` es el arbol de compatibilidad legacy vivo. De forma
   temporal, sus Rules conservan lectura/escritura para cualquier autenticado en
   ambos entornos solo bajo los ocho prefijos top-level observados: `config`,
   `containers`, `measures`, `news`, `orderLines`, `orders`, `products` y
   `users`, incluidos sus paths documentales/subcolecciones necesarios. Los
   prefijos legacy desconocidos o futuros se deniegan. Los documentos de socio
   actuales no tienen enlaces deterministas `authUid` y, en el inventario de
   2026-07-26, 34 de 49 cuentas Auth estaban sin verificar. Hoy no se puede
   identificar de forma segura a cada caller legacy legitimo para aplicar roles.
   Es deuda de seguridad explicita y no se presenta como minimo privilegio.
2. `<env>/plus-collections/**` es el arbol de Reguerta+. Su objetivo estricto usa
   la matriz canonica de roles, enlaces de identidad propiedad del servidor,
   proyecciones aditivas y Rules deny-by-default. Ese objetivo estricto no esta
   desplegado.

El catch-all final deniega rutas fuera de esos arboles explicitos. Las Rules
nunca usan `develop` o `production` como nivel de confianza.

Crear en cada entorno compatible:

`<env>/plus-collections/authLinks/{firebaseUid}`

El documento contiene solo el `memberId` canonico necesario para autorizar. El
cliente puede leer su propio enlace, pero nunca crearlo, modificarlo, borrarlo
ni listar enlaces. La coleccion pertenece a Cloud Functions y a scripts de
migracion controlados.

Las reglas resuelven al caller mediante `authLinks/{request.auth.uid}`, cargan
`users/{memberId}` y exigen que el `users.authUid` reciproco coincida con el UID
del token, `isActive == true` y el rol canonico `member` para el acceso
operativo. `producer`, `admin` e `isCommonPurchaseManager`
anaden solo sus capacidades declaradas. Admin no obtiene implicitamente la
propiedad de catalogo de productor. Reviewer recibe los roles del socio
enrutado y ninguna excepcion de Rules. La impersonacion Debug no cambia la
identidad Firebase y no autoriza escrituras live como otro socio.

El endpoint de primer enlace valida con Admin SDK un Firebase ID token, deriva
UID y email solo del token, exige email verificado para crear un enlace nuevo,
rechaza registros ambiguos o en conflicto y escribe transaccionalmente tanto
`users.authUid` como `authLinks/{uid}`. Los enlaces existentes siguen
funcionando tras un backfill controlado, incluidos los testers ya provisionados.

La implementacion candidata hace que toda Function HTTP mutante valide un
Firebase ID token bearer y resuelva un socio activo. Los endpoints
administrativos y operativos exigen ademas el rol `admin`. UID, email, rol o
member ID enviados en el body nunca son autoridad. Invariantes multidocumento
como no dejar cero admins activos o aplicar un intercambio de turnos se ejecutan
transaccionalmente en backend, porque Rules no puede agregar ni validar esos
workflows de forma segura. Estos cambios de Functions no estan desplegados.

Dentro de `plus-collections`, las Rules de Firestore deniegan colecciones
desconocidas y conceden acceso por rol, propiedad, identidades inmutables y
diffs de campos acotados. El match explicito separado de `collections` conserva
compatibilidad autenticada temporal. Storage tambien tiene dos matrices
explicitas:

1. Las apps legacy publicadas usan solo `products/**`. Como esos objetos no
   tienen metadata fiable de propiedad, el candidato estricto permite `get`,
   `create` y `update` a autenticados, pero deniega `list` y `delete`.
2. Reguerta+ usa `{env}/images/{products|news|shared_profiles}/...`. Estas rutas
   usan el mismo enlace y documento de socio, permiten `get` al socio activo
   enlazado y acotan `create`, `update` y `delete` por rol y propietario.
   `create`/`update` solo aceptan JPEG de hasta 2 MiB. `list` se deniega en todos
   los namespaces de imagenes.

En el objetivo estricto, el resto de rutas Storage se deniega. El permiso
temporal de `products/**` es deuda legacy y nunca puede autorizar ni solaparse
con el arbol de imagenes de Reguerta+.

El feed de notificaciones usa una bandeja materializada por backend en
`users/{memberId}/notificationInbox/{eventId}`. Firestore no puede usar Rules
como filtro posterior a una query y una consulta global no puede demostrar el
member ID que Rules obtiene indirectamente desde `authLinks`. El trigger de
notificaciones resuelve la audiencia y copia el evento inmutable en la bandeja
de cada destinatario. Los clientes solo consultan la ruta de su socio enlazado;
la coleccion global `notificationEvents` permanece como fuente de dispatch y
auditoria, y solo admin puede listarla.

El descubrimiento de socios usa una proyeccion propiedad del backend en
`memberDirectory/{memberId}`. Contiene solo campos operativos publicos del socio
activo: ID estable, nombres visible/de empresa, roles canonicos, capacidades de
catalogo y compra comun, paridad de productor y compromiso eco. Nunca contiene
email, telefono, UID de Firebase ni otros datos privados de cuenta. Los clientes
actualizados leen esta proyeccion; admin sigue gobernando los registros completos
mediante el backend autenticado.

Las lecturas anonimas de arranque pasan a
`<env>/plus-collections/config/public`, que contiene unicamente la politica de
versiones Android e iOS. Los socios activos leen valores operativos seguros de
`<env>/plus-collections/config/member`, una proyeccion propiedad del backend con
caducidad de cache, timestamps de frescura y dia de reparto. `config/global`
sigue siendo la fuente autoritativa y puede contener allowlists de reviewer y
otros datos privados de operacion.

Dentro de `plus-collections`, las Rules estrictas permiten leer el `users`
completo solo al propietario y a admin, ofrecen el directorio a socios activos
mediante `memberDirectory` y limitan `config/global` a backend/admin confiable.
Dentro de `collections`, las lecturas y escrituras autenticadas legacy se
mantienen compatibles hasta verificar usuarios, enlazar/backfillear identidades
y adoptar las apps actualizadas. Este acceso amplio temporal se limita a los
ocho prefijos vivos enumerados y nunca amplia las Rules de Reguerta+.

## Estado del despliegue (2026-07-26)

- Firestore Fase 1 esta desplegado y fue releido desde `reguerta-9f27f`.
  `firestore.phase1.rules` mantiene lectura/escritura autenticada para los ocho
  prefijos legacy observados y conserva el contrato autenticado anterior de
  `plus-collections`, incluido el guard de estado de productor HU-045. No es la
  matriz estricta HU-070.
- Storage live sigue con el baseline global anterior de lectura/escritura para
  autenticados. `storage.phase1.rules` es una copia de rollback semanticamente
  equivalente; las rutas selectivas solo existen en el candidato no desplegado
  `storage.strict.rules`.
- `firebase.json` y `firebase.phase1.json` seleccionan Rules Fase 1;
  `firebase.strict.json` selecciona `firestore.strict.rules` y
  `storage.strict.rules`; `firebase.functions.json` aisla el source de Functions.
  Los configs describen targets y no demuestran despliegue.
- El dry-run inicial de identidad del 2026-07-26 informo de 7 admins activos en
  develop y 3 en production, pero cero admins operativamente enlazados porque
  las cuentas Firebase Auth coincidentes no estaban verificadas. El punto de
  control del 2026-07-27 sustituye esa foto de bootstrap.
- Una auditoria live de solo lectura encontro 1.893 pedidos en cada entorno:
  todos tienen `userId` y `weekKey`, ninguno depende solo de `memberId` y todos
  conservan IDs historicos no deterministas. Hay 27 pares usuario-semana con
  duplicados, todos hasta `2026-W27` y ninguno entre `2026-W28` y `2026-W31`.
  Los clientes candidatos resuelven por propietario y semana, actualizan el ID
  historico cuando hay un unico resultado, crean un ID determinista solo cuando
  no existe ninguno y abortan sin escribir ante ambiguedad.
- La misma auditoria de solo lectura encontro 8.572 lineas de pedido en cada
  entorno. Todas tienen `userId`, `orderId` y `weekKey`; ninguna depende solo de
  `memberId` y no hay aliases de propietario contradictorios. Dos pares
  usuario-semana tienen lineas repartidas entre dos IDs historicos. Los
  resumenes de solo lectura agregan esas lineas y los totales documentados,
  mientras checkout sigue rechazando escrituras ambiguas.
- En ese punto Functions, cualquier backfill con `--apply` y ambos candidatos
  de Rules estrictas quedaron bloqueados hasta una decision explicita del owner
  sobre el bootstrap de admin. La decision y verificacion quedan registradas
  debajo.

## Punto de control del despliegue (2026-07-27)

- El owner autorizo marcar `emailVerified = true` en las siete cuentas Firebase
  Auth que coinciden con admins activos de develop; los tres admins de
  production son un subconjunto de esas mismas cuentas. Las siete se
  actualizaron UID a UID en `reguerta-9f27f` y una lectura independiente
  confirmo que quedaron verificadas y habilitadas. La operacion no cambio
  claims, passwords, Firestore, Storage, Functions ni Rules.
- Un dry-run de identidad guardado proyecto 7 admins activos enlazados en
  develop y 3 en production, por lo que el gate de bootstrap admin quedo
  resuelto. Los dos `authUid` de develop sin usuario Auth son fixtures
  intencionales de UI tests, no identidades historicas: `member_admin_001` y
  `member_producer_001`.
- El owner autorizo ese plan exacto. La migracion aplico 27 actualizaciones de
  usuario y 22 `authLinks` en develop, y 21 actualizaciones de usuario y 16
  `authLinks` en production. La verificacion posterior encontro cero
  conflictos, cero normalizaciones pendientes, cero operaciones planificadas,
  7/7 admins activos enlazados en develop y 3/3 en production. Los dos fixtures
  exactos quedaron intactos y el backfill no modifico Firebase Auth.
- Veintisiete cuentas Auth coincidentes siguen sin verificar y se
  autoverificaran desde Reguerta+. El corte strict sigue pendiente de adopcion
  de verificaciones y enlaces.
- `-useMockAuth` compone ahora el entorno iOS de UI tests completamente con
  repositorios locales y suprime la persistencia live de dispositivos/FCM. Las
  Rules siguen siendo estrictas para toda peticion Firebase real; los UID mock
  no reciben acceso especial.
- Por tanto, Fase 1 sigue desplegada. Solo se aplico el backfill de `authLinks`;
  los backfills de directorio/config/inbox, las Functions candidatas y las
  Rules estrictas siguen sin desplegar.

## Consecuencias

### Positivas

- En `plus-collections`, las cuentas no enlazadas, inactivas o desconocidas
  fallan de forma cerrada.
- En `plus-collections`, los cambios de roles y desactivaciones se aplican desde
  datos vivos.
- El cliente Reguerta+ no puede otorgarse roles ni suplantar la identidad de
  otro socio.
- Cuando las Functions candidatas se desplieguen de forma segura, los endpoints
  Admin SDK dejaran de saltarse la autorizacion anonimamente.
- Firestore y Storage de Reguerta+ comparten un unico modelo explicito de
  autorizacion.
- Develop y production mantienen un comportamiento equivalente.
- La configuracion publica de arranque de Reguerta+ deja de exponer reviewer u
  operacion.
- El directorio y la configuracion operativa dejan de exponer PII de cuenta o
  configuracion global privada cuando se active la fase estricta.
- El feed de Reguerta+ deja de descargar eventos de otras audiencias para
  filtrarlos en el dispositivo.

### Negativas

- Cada operacion autorizada puede consumir hasta dos lecturas documentales
  cacheadas durante la evaluacion de Rules.
- El arbol legacy `collections` sigue siendo legible/escribible por cualquier
  cuenta autenticada durante la compatibilidad. Los builds publicados dependen
  de consultas antiguas por email, lecturas de config, aliases de payload y
  escrituras directas, y los datos actuales no enlazan de forma determinista
  cada UID Auth con un socio.
- El aislamiento de rutas contiene esta deuda, pero no elimina su riesgo de
  confidencialidad e integridad. Verificar, enlazar identidades, migrar y retirar
  finalmente el arbol legacy sigue siendo trabajo obligatorio.
- Storage live aun permite lectura/escritura global autenticada, incluidos
  listado y borrado. El contrato legacy mas estricto de `products/**` limitado a
  get/create/update sigue siendo un candidato no desplegado porque los objetos
  no incluyen metadata fiable de propiedad.
- Las URLs de descarga tokenizadas de Firebase Storage ya emitidas no se
  reevaluan mediante Security Rules. Son un riesgo residual como enlace bearer y
  requieren inventario separado y rotacion/revocacion de tokens donde ya no se
  pretenda mantener la exposicion.
- Las cuentas nuevas por password de Reguerta+ deben verificar su email antes
  del primer acceso autorizado.
- Endpoints y migraciones forman parte de la superficie critica y requieren
  tests focalizados y despliegues acotados.
- El fan-out de notificaciones anade escrituras acotadas y exige backfill de los
  eventos existentes.
- Las Rules cross-service de Storage necesitan permiso para leer la base
  Firestore por defecto.

## Despliegue y rollback

### Fase 0 - Restaurar e inventariar la linea base viva (completa)

- Se restauro el breve despliegue de transicion al detectar los clientes
  publicados y se separo la evidencia Firestore/Storage.

### Fase 1 - Aislar compatibilidad Firestore (desplegada y releida)

- `firestore.phase1.rules` esta live: ocho prefijos legacy explicitos conservan
  lectura/escritura autenticada, las raices legacy desconocidas se deniegan y
  Reguerta+ conserva su contrato autenticado anterior, no HU-070 estricto.
- Storage no avanzo. Sigue live su baseline global autenticado;
  `storage.phase1.rules` es el target de rollback semantico.

### Fase 2 - Resolver el bloqueo de bootstrap admin (completada)

- Se verificaron y releyeron siete cuentas Auth admin coincidentes. El backfill
  de identidad guardado creo despues 22 enlaces en develop y 16 en production,
  con 7 admins enlazados en develop y 3 en production.

### Fase 3 - Backend aditivo y rollout estricto (pendiente)

- El backfill de `authLinks` esta completo. Desplegar solo una allowlist de
  Functions revisada, conservando contratos GET legacy, y aplicar los backfills
  restantes de `memberDirectory`, `config/public`, `config/member` e inbox solo
  tras sus propios dry-runs y aprobaciones.
- Conservar los dos fixtures exactos de develop solo en el plan migratorio y
  dejar que las 27 cuentas Auth restantes se autoverifiquen desde Reguerta+
  antes del corte strict.
- Repetir la matriz `HEAD + new`, desplegar Firestore y Storage strict por
  separado mediante `firebase.strict.json`, releer cada servicio y revertir ante
  cualquier denegacion legitima. Un despliegue global de Functions nunca forma
  parte de esta fase.

### Fase 4 - Adopcion y retirada de deuda legacy (pendiente)

- Publicar y medir adopcion de clientes actualizados, migrar identidades y
  objetos Storage legacy, auditar URLs tokenizadas y retirar permisos de
  compatibilidad solo tras superar sus puertas.

## Referencias

- [Firebase: Consultar datos de forma segura](https://firebase.google.com/docs/firestore/security/rules-query)
- [Firebase: Condiciones de Security Rules](https://firebase.google.com/docs/firestore/security/rules-conditions)
- [Firebase: Condiciones de Storage Rules](https://firebase.google.com/docs/storage/security/rules-conditions)
- [Firebase: Verificar ID tokens](https://firebase.google.com/docs/auth/admin/verify-id-tokens)
- `spec/app/hu-044-canonical-role-permission-matrix-and-test-fixtures/role-permission-matrix.v1.json`
- GitHub issue #198
