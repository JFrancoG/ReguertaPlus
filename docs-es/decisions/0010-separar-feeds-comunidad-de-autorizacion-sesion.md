# ADR-0010: Separar los feeds de comunidad de la autorización de sesión

## Estado

Aceptada

## Fecha

2026-07-29

## Contexto

El ADR-0008 sitúa la autenticación, autorización e hidratación de la sesión
autorizada de Android e iOS tras un único lane de operación de sesión serializado
y acotado. En la implementación Android actual, esa hidratación lee noticias,
entradas del inbox de notificaciones y marcadores de lectura antes de aplicar
por completo una sesión que, por lo demás, es válida. iOS ya publica la sesión
autorizada y después deja que su feature raíz de Noticias/Notificaciones
refresque esos feeds de forma independiente.

HU-071 hace explícitos los documentos corruptos de Noticias y Notificaciones.
Cuando esos repositorios lancen error en vez de filtrar documentos en silencio,
un único documento corrupto de comunidad podría terminar una sesión Android
válida. Por el contrario, ocultar el error o convertirlo en valores por defecto
recrearía el falso vacío o éxito parcial que HU-071 debe eliminar.

Los feeds de comunidad son privados para un principal, miembro seleccionado,
alcance de acceso, epoch de sesión y entorno exactos. Conservar un snapshot
anterior al cruzar cualquiera de esas fronteras puede exponer el inbox del
miembro previo si falla la lectura nueva. La conservación solo es segura dentro
del mismo contexto.

## Impulsores de la decisión

- Mantener fail-closed la autenticación y la autorización.
- Evitar que contenido de comunidad no autorizante invalide credenciales
  válidas.
- Distinguir una consulta vacía válida de datos corruptos o no disponibles.
- Conservar contenido anterior útil sin filtrarlo entre identidades o entornos.
- Mantener alineado el comportamiento Android/iOS.
- Evitar cambios de backend o datos live mientras Firebase está en standby.

## Decisión

Las cargas de noticias, inbox de notificaciones y marcadores de lectura son
**refrescos de comunidad no autorizantes**. No poseen, prolongan, hacen fallar
ni ponen en cuarentena el lane de operación de sesión acotado del ADR-0008.

El lane de sesión sigue siendo autoritativo para mutaciones de Auth, resolución
del miembro, routing de entorno, publicación de la sesión autorizada, cleanup
de seguridad, timeouts y la hidratación obligatoria existente que esta decisión
no mueve. Tras publicar un estado autorizado, el cliente móvil inicia los
refrescos de comunidad mediante la frontera normal de presentación de la
feature.

Cada refresco de comunidad captura un contexto inmutable que contiene al menos:

- epoch de sesión o generación de identidad equivalente;
- UID del principal Firebase;
- ID del miembro canónico seleccionado;
- entorno resuelto;
- capacidad relevante de autorización de noticias/notificaciones; y
- un token monotónico por operación de feed.

Solo la operación vigente dentro del mismo contexto exacto puede publicar un
snapshot, finalizar su loading o mostrar feedback. La cancelación se mantiene
separada de un fallo de datos visible para el usuario.

Dentro del mismo contexto, un refresco fallido conserva el último snapshot
completo válido, termina únicamente su operación de loading correspondiente,
muestra feedback recuperable y permite reintentar mediante la acción normal de
refresco.

Cuando cambia el principal, miembro seleccionado, capacidad de autorización,
epoch de sesión o entorno, el cliente invalida síncronamente las operaciones de
comunidad y limpia `latestNews`, `newsFeed`, `notificationsFeed` y los IDs de
notificaciones leídas antes de iniciar el refresco sustituto. El contenido de
un contexto anterior nunca se usa como fallback para uno nuevo.

Una transición del routing de entorno constituye por sí misma una de esas
fronteras; los clientes no esperan a la publicación posterior de la sesión
autorizada para observarla. Android ejecuta la limpieza mientras todavía posee
la transición de sesión serializada y avanza el epoch sin publicar antes de
tiempo el entorno de destino. iOS publica el cambio de entorno efectivo mediante
una señal de routing síncrona con propiedad por referencia; la feature avanza su
generación de routing, cancela la hidratación anterior y limpia el estado de
comunidad en ese mismo turno.

Los errores de repositorio siguen siendo tipados. El recurso de un documento
inválido solo puede contener colección e ID de documento, nunca campos de
noticia/notificación ni contenido de usuario.

Esta decisión no amplía el esquema canónico de notificaciones. Los writers de
Functions no canónicos y los documentos live existentes siguen siendo un gate
separado de compatibilidad backend.

La garantía del decoder estricto cubre los documentos devueltos por Firestore.
Las Rules existentes obligan a que las lecturas de Noticias de miembros
ordinarios consulten `active == true`; los documentos cuyo campo `active` falta
o tiene un tipo incorrecto quedan excluidos en servidor y requieren un
inventario PII-free y un gate posterior de backend/Rules. Las lecturas de
Noticias de administradores siguen sin filtro y son estrictas.

## Opciones consideradas

### Mantener las lecturas de comunidad dentro del lane y hacer fallar la sesión

Rechazada. El contenido de noticias o notificaciones no demuestra identidad ni
autoridad, así que su corrupción no debe revocar credenciales válidas ni entrar
en cuarentena de Auth.

### Convertir los fallos de comunidad en listas vacías

Rechazada. Haría indistinguibles los fallos de transporte, permisos o datos
corruptos de una consulta vacía correcta.

### Conservar el snapshot anterior al cambiar miembro o entorno

Rechazada. Una lectura sustituta fallida podría exponer contenido del contexto
anterior.

### Añadir almacenamiento durable local-first en este corte

Aplazada. Requiere su propia política de persistencia, invalidación, migración
y sincronización, y se controla por separado de HU-071.

## Consecuencias

### Positivas

- Un documento corrupto de comunidad no puede revocar una sesión Android válida.
- Los feeds vacíos, no disponibles y corruptos siguen siendo distinguibles.
- Los fallos del mismo contexto conservan contenido útil y ofrecen retry
  determinista.
- Los cambios de identidad, acceso y entorno no pueden exponer el inbox previo.
- Android e iOS comparten el mismo contrato de propiedad y publicación.

### Negativas

- La UI autorizada puede aparecer antes de terminar de cargar los feeds.
- Presentación necesita tokens de operación por feed y fences de contexto.
- Un cambio de contexto descarta intencionadamente el snapshot en memoria aunque
  después falle la lectura sustituta.
- Los clientes estrictos pueden mostrar feeds no disponibles hasta que writers
  backend y datos existentes no canónicos superen un gate de compatibilidad
  aprobado por separado.

## Implementación y verificación

- Android publica el estado autorizado antes de invocar los refrescos cercados
  de `SessionCommunityActions`.
- Android lee el entorno runtime vivo mediante el provider de composición y,
  mientras mantiene el lock de operación de sesión, limpia el estado de
  comunidad y avanza `sessionEpoch` en cuanto cambia el routing. El entorno de
  destino solo se publica mediante la resolución normal de sesión autorizada.
- iOS conserva la propiedad del refresco en
  `NewsNotificationsFeatureViewModel`, observa la señal síncrona del router y
  añade comprobaciones de generación de routing, entorno, epoch, capacidad y
  operación por feed.
- La hidratación de comunidad de iOS tiene su propia generación y tarea
  cancelable. Revalida la propiedad entre las lecturas de Noticias y
  Notificaciones para que una hidratación obsoleta no pueda recapturar un
  contexto nuevo ni desplazar su loading.
- Ambas plataformas prueban conservación y retry en el mismo contexto,
  refrescos solapados, logout/relogin y cambios de principal, miembro,
  capacidad o entorno, incluido el fallo de la lectura sustituta, sin sleeps
  reales.
- Android prueba que un fallo del repositorio de comunidad no puede terminar una
  sesión autorizada que, por lo demás, es válida.
- Esta decisión no incluye despliegue Firebase ni mutación de datos live.

## Decisiones y trabajo relacionados

- ADR-0001: MVVM y Clean Architecture multiplataforma.
- ADR-0003: servicios backend Firebase.
- ADR-0004: composición iOS raíz de Noticias/Notificaciones.
- ADR-0008: operaciones móviles de sesión acotadas; esta decisión solo estrecha
  la clasificación de las lecturas de comunidad dentro de la hidratación
  autorizada.
- Issue de GitHub [#230](https://github.com/JFrancoG/ReguertaPlus/issues/230).
- Gate aplazado de compatibilidad backend
  [#231](https://github.com/JFrancoG/ReguertaPlus/issues/231).
- Gate aplazado de query/inventario de Noticias
  [#232](https://github.com/JFrancoG/ReguertaPlus/issues/232).
