# ADR-0008: Acotar operaciones móviles de sesión sin liberar trabajo inseguro de Firebase Auth

## Estado

Aceptada

## Fecha

2026-07-28

## Contexto

Android e iOS serializan login, alta y refresco de sesión para que una operación
antigua de Firebase Authentication no termine después de otra nueva y sustituya
al usuario autenticado global del proceso. El issue #216 introdujo fences de
generación y propietario, además del orden cleanup-antes-del-sucesor.

Esos fences no acotan el progreso visible. Una operación Android vigente aún
puede lanzar fuera de su resultado esperado y dejar incompleto el estado de
presentación. En ambas plataformas, una llamada del SDK Firebase o de un
repositorio puede ignorar la cancelación cooperativa y no retornar nunca,
dejando bloqueado un spinner o el carril serializado de sesión.

Cancelar no equivale a terminar físicamente. Los timeouts de coroutines Kotlin
cancelan de forma cooperativa y las tareas Swift necesitan que la operación en
ejecución observe la cancelación. Un race simple contra un temporizador puede
recuperar al caller mientras una petición Firebase antigua continúa y después
muta el singleton Auth compartido. Liberar entonces un sucesor reabriría #216.

## Criterios de decisión

- Recuperar la UI en un intervalo finito y comprobable.
- Preservar el orden cleanup-antes-del-sucesor de #216.
- No retener ni encolar otra contraseña detrás de trabajo no acotado.
- Impedir que mutaciones tardías de Firebase Auth autoricen o expongan datos privados.
- Aplicar la misma política observable en Android e iOS.
- Evitar cambios en backend, Rules, Functions o datos live de Firebase.

## Decisión

Los clientes móviles usan un único carril serializado para `signIn`, `signUp`,
`refreshCurrentSession` y la hidratación de sesión autorizada propiedad de esas
operaciones.

Cada operación recibe un deadline de aplicación de 30 segundos. El presupuesto
empieza solo después de que el predecesor y su cleanup hayan drenado. Acota la
propiedad de presentación, pero no garantiza que el SDK Firebase o un
repositorio hayan terminado físicamente. La duración está centralizada y es
inyectable para pruebas deterministas.

Treinta segundos es el valor por defecto porque una operación de sesión puede
componer Auth, recarga de usuario, refresco de token, autorización y lecturas de
repositorio. Usa el techo de red de 30 segundos ya presente en la app y deja
margen sobre los 15 segundos de una petición aislada a una Function autenticada.
El valor puede cambiar sin debilitar el contrato de estados siguiente.

En el instante del deadline solo un evento conserva la propiedad: el resultado
o la transición de timeout. El ganador se selecciona mediante el fence de
generación y propietario dentro de la frontera serializada de cada plataforma.

Si gana el deadline, o una operación vigente falla inesperadamente después de
invocar Auth, el cliente debe:

1. Invalidar la propiedad de presentación antes de publicar estado.
2. Limpiar spinners, tracking de refresh, loaders de features, datos privados y
   routing de entorno en runtime.
3. Publicar un estado signed-out o no autorizado recuperable. Un timeout no se
   presenta como expiración demostrada de credenciales.
4. Intentar `signOut` inmediato en Firebase y cancelar cooperativamente la operación.
5. Conservar la operación física como barrera `DRAINING`.

Mientras cualquier operación posee el carril (`ACTIVE`, cleanup o `DRAINING`),
se rechazan login y alta adicionales en vez de encolarlos, y se ignora refresh.
Así una tarea que espera detrás de trabajo que puede resultar no acotado no
captura una segunda credencial. Cuando la llamada antigua finalmente retorna,
su fence impide publicar. El cliente reconfirma el sign-out de Firebase Auth y
espera y valida el cleanup compuesto de routing, dispositivo autorizado y
metadatos locales ya iniciado antes de liberar el carril. Otro login solo puede
empezar después de esa confirmación definitiva.
El cleanup de seguridad asíncrono iniciado por un cierre manual también posee
el carril de cleanup hasta que se haya confirmado.

Si el SDK no retorna nunca, la UI queda recuperada y sin datos privados, pero el
carril sigue fail-closed durante la vida del proceso. Reiniciar el proceso es la
única recuperación segura porque el cliente no puede demostrar que trabajo Auth
abandonado no mutará el singleton más tarde.

Los proveedores Firebase Auth añaden checkpoints de cancelación inmediatamente
después de awaits que pueden crear o restaurar un usuario autenticado y antes de
otra suspensión. Si observan cancelación, ejecutan sign-out síncrono antes de
retornar o propagarla. El cleanup definitivo exterior sigue siendo una segunda defensa.

El cleanup definitivo solo se confirma cuando tienen éxito el sign-out de
Firebase Auth, el reset del entorno en runtime, la eliminación del contexto de
dispositivo autorizado y la eliminación de los metadatos locales de sesión que
apliquen. Si falla cualquier paso crítico de seguridad, el cliente conserva un
estado local no autorizado/fail-closed, no restaura datos privados y no libera
el carril. La credencial ya entregada al SDK sigue retenida por ese trabajo en
vuelo hasta que retorna; el diseño evita retener una segunda credencial al
rechazar envíos durante `DRAINING`.

Password reset queda fuera de esta decisión. No comparte el carril de #216 ni
cambia el usuario autenticado. Podrá recibir otra política acotada sin heredar
el contrato de cuarentena Auth.

## Opciones consideradas

### Envolver la operación en `withTimeout` o competir contra `Task.sleep`

Descartada como garantía de seguridad. Ambos mecanismos solicitan cancelación
cooperativa; no demuestran que haya terminado trabajo bloqueante o no cooperativo.

### Separar el trabajo antiguo y permitir inmediatamente un sucesor

Descartada porque un resultado Firebase tardío aún puede sustituir al usuario
autenticado global después de que el sucesor tenga éxito.

### Encolar el sucesor detrás de un carril ocupado

Descartada para autenticación interactiva porque puede retener otra contraseña
durante un tiempo ilimitado y no ofrece al usuario un contrato de progreso honesto.

### Recuperar la UI y mantener el carril en cuarentena hasta el cleanup definitivo

Seleccionada. Preserva el invariante de #216 y aporta recuperación visual
acotada y comportamiento determinista.

## Consecuencias

### Positivas

- La UI de sesión no mantiene un spinner indefinido tras el deadline.
- Los resultados tardíos no publican autorización ni adelantan el cleanup.
- Android e iOS comparten una política explícita de máquina de estados.
- Las pruebas controlan el tiempo sin sleeps reales.
- No interviene ningún despliegue backend ni migración Firebase legacy.

### Negativas

- Un proveedor que nunca retorna exige reiniciar la app antes de otro login.
- Una llamada SDK en vuelo puede retener la credencial ya suministrada.
- Timeout y checkpoints del proveedor añaden estado de ciclo de vida y pruebas.
- El valor de 30 segundos puede requerir ajuste futuro con telemetría de producción.

## Implementación y verificación

- Android usa un watchdog basado en delay inyectado y tiempo virtual de coroutines.
- iOS usa un sleeper `Duration` inyectado y controlado por las pruebas.
- Ambas plataformas comprueban el vencimiento del deadline, excepciones vigentes
  inesperadas, proveedores no cooperativos, sucesores rechazados mientras el
  carril está ocupado, resultados tardíos, orden y fallo del cleanup definitivo,
  cleanup del cierre manual, recuperación de refresh y login posterior.
- Android prueba además la carrera atómica resultado/deadline y cada checkpoint
  concreto de recarga, refresco de token y verificación. iOS prueba el wrapper
  postmutación compartido por esos callsites, incluida la cancelación y la
  propagación de un sign-out fallido. Los fallos ordinarios posteriores a una
  mutación Auth también deben confirmar el sign-out antes de devolver un
  resultado recuperable; de lo contrario propagan la transición a `DRAINING`.

## Decisiones y trabajo relacionados

- ADR-0003: Firebase como servicios backend.
- ADR-0004: inyección raíz iOS y propiedad de Session/Auth.
- GitHub issue #216: propiedad de operación y fences de resultados tardíos.
- GitHub issue #218: implementación de operaciones de sesión acotadas.

## Referencias

- [Cancelación de Task en Apple](https://developer.apple.com/documentation/swift/task#Task-Cancellation)
- [Cancelación de timeout en coroutines Kotlin](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines/with-timeout.html)
