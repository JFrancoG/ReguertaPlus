# ADR-0009: Exigir autorización viva de proceso para registrar push de cuenta

## Estado

Aceptada

## Fecha

2026-07-28

## Contexto

Reguerta guarda un identificador de dispositivo, el último token de registro
FCM y un contexto de cuenta autorizada para asociar las renovaciones del token
con el miembro correcto. El ADR-0007 mantiene a los clientes Firebase
publicados en un despliegue de autorización por fases, así que un callback móvil
todavía no puede confiar en que las Rules estrictas rechacen cada registro
obsoleto.

La issue #214 añadió almacenamiento cifrado, contextos exactos `memberId +
authUid + environment + lease` y revalidación en el repositorio. Aún quedaba un
hueco de ciclo de vida: un proceso nuevo podía combinar Firebase Auth restaurado
con el estado de disco y subir un token antes de que la aplicación revalidara al
miembro autorizado. Android también podía recibir un callback FCM mientras el
cleanup de logout esperaba trabajo de sesión anterior. En iOS, el callback de
mensajería podía adoptar un contexto de Keychain en un coordinador recién
creado.

Un contexto persistido solo demuestra lo autorizado por un proceso anterior.
No demuestra que el proceso actual haya completado la resolución del miembro,
la validación de estado activo y la propiedad de la sesión.

## Impulsores de la decisión

- Detener la asociación del token en cuanto la sesión local pierde autorización.
- No reconstruir nunca la autoridad de subida solo desde Firebase Auth y disco.
- Conservar el token para que un login válido posterior pueda recuperarlo sin
  perder el callback de renovación.
- Aplicar las mismas comprobaciones de miembro, UID, entorno, lease y ciclo de
  vida en Android e iOS.
- Mantener compatibilidad con los clientes publicados y el despliegue Firebase
  por fases.
- Evitar cambios de backend, Rules, Functions o datos live en este corte.

## Decisión

El registro push ligado a una cuenta exige una **autorización viva de proceso**
además de Firebase Auth y del estado cifrado persistido.

Esa autorización contiene el miembro, UID de Auth, entorno y lease exactos que
ha establecido el flujo de sesión autorizada actual. También conserva un fence
vivo de proceso/sesión: generaciones atómicas en Android y la closure de
propiedad de sesión en iOS. Cada subida debe demostrar en los checkpoints del
repositorio, inmediatamente antes de escribir, que:

1. La autorización viva de proceso sigue siendo propietaria de la operación.
2. El UID actual de Firebase coincide con el UID autorizado.
3. El contexto persistido sigue coincidiendo en miembro, UID, entorno y lease.
4. El último token guardado coincide con el token que se va a escribir.
5. El fence de proceso/sesión sigue declarando vigente la sesión autorizada.

El callback del token siempre normaliza y guarda el token más reciente. Sin
autorización viva de proceso no realiza ninguna subida de cuenta. El siguiente
login completamente autorizado puede usar ese token durante su registro
acotado.

Android comparte un registro de autorización local al proceso entre el
registrar del dispositivo autorizado y `FirebaseMessagingService`. El logout y
la recuperación terminal de sesión lo invalidan de forma síncrona, antes del
cleanup persistente asíncrono. El registro usa una generación atómica: un
permiso de activación obtenido antes del logout no puede reactivar la
autorización después de que logout avance la generación.

iOS guarda el contexto y su fence `@MainActor @Sendable` como un único valor de
estado del actor. El callback de mensajería nunca adopta un contexto de Keychain
en un coordinador nuevo. El fence se evalúa antes de la subida y dentro del
callback de revalidación del repositorio, para que la reentrada del actor en un
`await` no convierta una autorización obsoleta en una escritura.

La forma legacy cifrada conocida de Android, con `member_id`, `environment` y
`lease_id` pero sin `auth_uid`, se migra fail-closed eliminando únicamente las
claves del contexto autorizado. El ID de dispositivo y el token guardado se
conservan como datos de recuperación no autorizantes. Cualquier otra forma
parcial sigue siendo un error tipado de corrupción.

Los fallos de registro, almacenamiento y cleanup siguen una política
best-effort para preservar la continuidad del producto: se informan o registran
sin bloquear el cierre de sesión local. La invalidación en memoria es síncrona
y no depende de red ni de la disponibilidad del almacenamiento cifrado.

## Opciones consideradas

### Confiar en el contexto persistido si Firebase Auth restaura el mismo UID

Rechazada. Autorizaría un callback antes de que el proceso actual revalide la
actividad del miembro, el routing y la propiedad de la sesión.

### Desactivar por completo las subidas de renovaciones de token

Rechazada. Evitaría escrituras obsoletas, pero también dejaría sesiones válidas
con credenciales push desactualizadas.

### Borrar remotamente el token y desvincularlo en backend durante logout ahora

Aplazada. Exige retry durable, compatibilidad con las apps y el emisor
publicados, y una decisión coordinada entre el modelo legacy de token y el nuevo
modelo de registro mediante Firebase Installation ID.

## Consecuencias

### Positivas

- Un arranque en frío no recupera silenciosamente desde disco la autoridad para
  escribir asociaciones push de cuenta.
- Logout cerca los callbacks antes de que termine el cleanup persistente o el
  sign-out de Firebase.
- Una lease o un entorno sustituidos no pueden confirmar una actualización
  tardía del token.
- Ambos clientes conservan el último token para recuperarlo tras una
  autorización posterior.
- No requiere despliegue Firebase ni mutación de datos live.

### Negativas

- Tras reiniciar el proceso, la aplicación debe completar de nuevo la
  autorización antes de reanudar subidas de token.
- El ciclo de vida móvil mantiene ahora una generación/fence adicional en
  memoria.
- Esta decisión no elimina del servidor los tokens remotos de una cuenta que
  ha cerrado sesión.

## Frontera de revocación y trabajo aplazado

Esta decisión revoca la **autorización local para crear o actualizar
asociaciones push de cuenta**. Aún no proporciona revocación remota absoluta. El
emisor puede conservar un token registrado anteriormente y FCM puede haber
aceptado ya mensajes para entregar. Por tanto, el producto no debe prometer
cero notificaciones tardías después del logout.

La desvinculación remota, el retry durable, la política TTL del emisor y la
política de `unregister` de Android siguen aplazadas. La migración de la API de
registro queda cubierta por la enmienda transitoria siguiente.

## Enmienda transitoria FID de 2026-07-29

La issue #227 coordina el primer corte compatible con Firebase Installation ID
(FID) sin reinterpretar las credenciales existentes. Android usa `register()`
y `onRegistered`, guarda el FID en `firebaseInstallationId` y limpia los campos
legacy de token en su propio documento de dispositivo. iOS y los documentos
Android ya publicados continúan usando `fcmToken` durante la transición.

El emisor lee ambos campos de forma independiente y los despacha mediante el
destino correspondiente de Firebase Admin 14: `tokens` para registros
legacy/iOS y `fids` para FIDs de Android. Los dos conjuntos nunca se
intercambian. Las Firestore Rules estrictas validan ambas representaciones y
los contratos de dispositivo en inglés y español documentan su convivencia.

Android también sustituye la API de preferencias de AndroidX Security
deprecada por un almacén versionado Android Keystore AES-GCM. Un lector usado
solo para la migración y construido con las primitivas actuales de Tink 1.23
copia atómicamente los campos de identidad y sesión compatibles antes de usar
el almacén nuevo. El `fcm_token` legacy no se copia deliberadamente en el slot
FID porque ambos identificadores no son intercambiables. La migración no
sobrescribe un almacén v2 ya inicializado, no borra el origen cifrado necesario
para rollback y falla de forma cerrada en vez de rotar `device_id` si no puede
descifrar el formato legacy. Las entradas conocidas del fallback en texto plano
se vuelven a cifrar antes de eliminar esas claves planas. Tink debe permanecer
en la ruta de actualización mientras se admita actualizar directamente desde
una build anterior a #227. Esta frontera de compatibilidad no usa supresiones de
deprecación. La issue #228 controla la evidencia de release y un canary de
actualización desde una build anterior.

Integrar el código fuente no autoriza un despliegue Firebase ni una publicación
móvil. El despliegue de Functions y la distribución Android siguen siendo un
gate operativo coordinado; la migración de iOS y la desvinculación remota siguen
como trabajo posterior.

## Implementación y verificación

- Android prueba de forma determinista el proceso en frío, diferencias de UID
  y contexto, sustitución de lease y entorno, invalidación durante una escritura
  suspendida, carreras de generación de activación, fence inmediato de logout y
  migración legacy.
- iOS prueba de forma determinista el estado Keychain en un proceso frío, un
  callback válido después del registro vivo y la invalidación del fence durante
  una escritura suspendida en el repositorio.
- Las pruebas usan gates controlables y ningún sleep real.
- La issue #217 no cambió Functions, Firestore Rules, Storage Rules ni datos
  Firebase live. La enmienda #227 cambia el código fuente de Functions y Rules
  estrictas, pero no despliega Firebase ni modifica datos live.

## Decisiones y trabajo relacionados

- ADR-0003: servicios backend Firebase.
- ADR-0007: autorización Firebase por roles y despliegue por fases.
- ADR-0008: operaciones móviles de sesión acotadas y barreras de cleanup.
- Issue de GitHub [#217](https://github.com/JFrancoG/ReguertaPlus/issues/217).
- Issue de GitHub [#227](https://github.com/JFrancoG/ReguertaPlus/issues/227).
- Issue de GitHub [#228](https://github.com/JFrancoG/ReguertaPlus/issues/228).

## Referencias

- [Swift Evolution SE-0306: Actors](https://github.com/swiftlang/swift-evolution/blob/main/proposals/0306-actors.md)
- [Firebase: gestionar tokens de registro FCM](https://firebase.google.com/docs/cloud-messaging/manage-tokens)
- [Firebase Android: `FirebaseMessaging`](https://firebase.google.com/docs/reference/android/com/google/firebase/messaging/FirebaseMessaging)
- [Configuración de Tink Java](https://developers.google.com/tink/setup/java)
