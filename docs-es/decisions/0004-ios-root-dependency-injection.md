# ADR-0004: Usar inyeccion de dependencias raiz en iOS SwiftUI

## Status

Accepted

## Fecha

2026-05-11

## Adenda de implementación HU-077

HU-077 / issue #255 materializa esta decisión aceptada sin reescribirla. App
selecciona ahora un único escenario tipado live, preview o UI-test, realiza toda
la construcción live Firebase/Data e inyecta un grafo completo mediante el seam
puro compartido `ReguertaAppEnvironment.assemble`. Presentation tiene cero
imports Firebase ni construcción live de adaptadores. El guard exhaustivo de
Data permite solo una referencia tipada heredada:
`FirebaseFunctionClientError.unauthorized` en exactamente un uso existente. No
permite construcción live ni referencias adicionales a tipos de Data.
`MainView` es el único lector del environment en el shell; los wrappers raíz
sin consumidores y el protocolo amplio de routing se eliminaron solo después
de caracterizarlos, y las vistas de ruta reciben inputs, bindings y acciones
explícitos.

`ReguertaAppConfiguration` decodifica una vez en App el cuarto control de
launch, `-reguerta_dev_time_machine.override_now_millis`, exige un `Int64`
adyacente y falla de inmediato ante una entrada mal formada. El seed inicial
tipado prevalece sobre el estado persistido. Live conserva su reloj de
desarrollo persistente; los relojes de preview y UI-test son transitorios,
están aislados por grafo y se propagan por root, sesión, features y Freshness.
Freshness live conserva su reloj de pared `Date` original. El ownership
aceptado de `AccessRootViewModel` no cambia porque la caracterización no
justificó otro store.

El primer release completo se conserva como evidencia roja honesta:
`/private/tmp/hu077-final-release-gate.xcresult` registró 615 responsabilidades,
613 passed, un skip de launch conocido y un fallo en el UI test de safe area de
My Order porque no encontró el campo de búsqueda. El reloj transitorio de
UI-test había perdido el seed de launch `1778760000000`. El arreglo del seed
tipado restauró el estado determinista de My Order.

La evidencia ejecutable local posterior en iPhone 17 / iOS 26.5 pasó: la matriz
focal de composición registró 33 tests lógicos y 34 ejecuciones; shell/root pasó
21/21; fast unit pasó 608/608 (602 Swift Testing y 6 XCTest); UI smoke pasó 4/4;
y `/private/tmp/hu077-final-release-gate-2.xcresult` registró 617
responsabilidades, 616 passed, un skip de launch conocido y cero fallos.
SwiftLint inspeccionó 375 archivos sin infracciones; settings pasó 6/6; y los
builds genéricos Debug y Production Release están verdes. El árbol contiene
375 archivos Swift y 63.992 líneas: producción 261/36.243, unit 112/27.365 y UI
2/384. La repetición post-P1 con Xcode MCP en `windowtab2` completó los nueve
previews Large sin errores de herramienta; Home pasó un retry aislado tras un
`PotentialCrashError` transitorio.

Ese 9/9 es un resultado de terminación de herramienta, no nueve selecciones de
macro semánticamente inequívocas. El preview dedicado de startup `unavailable`
en el índice 0 mostró `timedOut` de forma repetida pese a que su fixture fuente
es `.unavailable`. `MainView` mostró `unavailable` para el mismo fixture y la
cobertura runtime distingue ambos estados. La inferencia actual es una
interacción de caché/selección de RenderPreview entre macros del mismo archivo,
no un defecto demostrado del estado de la app.

La reconciliación independiente final informa 0 P0-P3 sin resolver. La
instrucción posterior del mantenedor "haz commit y push, lanza pr y cierra
issue, etc" autorizó la entrega completa. El commit fuente `c29bd04` se integró
mediante la PR ready #256 como `68a036a`, y su enlace de cierre completó el
issue #255. La rama de entrega se conserva solo para la reconciliación
documental final y se borra tras ese merge. El despliegue Firebase quedó fuera
de alcance.

## Contexto

La raiz de la app iOS mezclaba composicion SwiftUI, responsabilidades de
`AppDelegate`, construccion de repositorios Firebase, arranque de sesion, rutas
de splash y estado de navegacion home. Eso hacia la vista principal mas dificil
de previsualizar y testear, y favorecia dependencias ocultas en presentacion.

El proyecto ya usa MVVM y Clean Architecture. iOS debe mantener esa direccion
haciendo explicitas las dependencias raiz y manteniendo las vistas SwiftUI como
declarativas.

## Decision

Usar un contenedor ligero `ReguertaAppEnvironment` en el arranque de iOS. El
contenedor construye servicios live, repositorios, view models raiz y reemplazos
de preview, y SwiftUI lo inyecta desde `ReguertaApp` mediante el environment.

Las vistas SwiftUI del flujo raiz no deben declarar `init` explicitos, crear
repositorios/servicios ni contener logica de negocio. El estado del workflow raiz
vive en `AccessRootViewModel`; la sesion y el trabajo de features permanece en
view models y casos de uso dedicados.

## Consecuencias

### Positivas

- El arranque de app, configuracion de delegate, construccion de dependencias y
  composicion de vistas tienen limites mas claros.
- `ContentView` queda declarativa y preparada para previews.
- La navegacion raiz y el comportamiento de splash/startup se pueden testear sin
  dependencias Firebase live.
- Las futuras features iOS pueden reutilizar el mismo patron de environment y
  factories.

### Negativas

- El contenedor raiz anade una pequena cantidad de boilerplate.
- Algunas extensiones de rutas existentes aun necesitan extraccion incremental a
  vistas/view models de feature mas pequenos.

## Notas

Firebase debe configurarse antes de crear servicios live basados en Firebase.
Usar un helper de arranque idempotente evita depender del orden fragil de
inicializacion entre el `App` de SwiftUI y el `AppDelegate`.

Orders es el primer slice de feature migrado despues del arranque raiz. Sus
rutas SwiftUI reciben view models propiedad del root, mientras que checkout,
pedido anterior, pedidos recibidos, escrituras de estado de productor y
persistencia de carrito se acceden mediante dependencias `OrdersRepository` y
`MyOrderCartStore`.

Products es el segundo slice de feature migrado. `AccessRootViewModel` posee
`ProductsRouteViewModel`, que recibe dependencias de productos, miembros,
compromisos de temporada, pipeline de imagenes y reloj desde
`ProductsFeatureDependencies`. `SessionViewModel` sigue siendo la fuente de
sesion, pero ya no posee estado de catalogo, borradores de producto, subida de
imagenes de producto, cambios de visibilidad del catalogo ni el feed de
productos para pedidos.

Shifts es el tercer slice de feature migrado. `AccessRootViewModel` posee
`ShiftsFeatureViewModel`, que recibe dependencias de turnos, solicitudes de
cambio, solicitudes de planificacion, calendario de entregas, notificaciones y
reloj desde `ShiftsFeatureDependencies`. `SessionViewModel` sigue siendo la
fuente de sesion, pero ya no posee feeds de turnos, estado del
workflow de cambios, estado del calendario de entregas, solicitudes de
planificacion admin ni el override de reloj develop. Orders consume turnos y
calendario de entregas desde el view model de Shifts propiedad del root para que
las ventanas de pedido sigan compartidas sin reintroducir dependencias ocultas.

News/Notifications es el cuarto slice de feature migrado. `AccessRootViewModel`
posee `NewsNotificationsFeatureViewModel`, que recibe dependencias de noticias,
notificaciones, pipeline de imagenes y reloj desde
`NewsNotificationsFeatureDependencies`. `SessionViewModel` sigue siendo la
fuente de sesion, bylaws y feedback global en este paso, pero ya no posee feeds de noticias,
borradores de noticias, subida de imagenes de noticias, feeds de
notificaciones, borradores de broadcasts ni workflows admin de envio o borrado.
Shifts y News/Notifications pueden compartir una unica instancia de
`NotificationRepository` desde el contenedor raiz cuando ambos slices necesitan
publicar o leer eventos de notificacion.

SharedProfile es el quinto slice de feature migrado. `AccessRootViewModel`
posee `SharedProfileFeatureViewModel`, que recibe dependencias de repositorio de
perfiles compartidos, pipeline de imagenes y reloj desde
`SharedProfileFeatureDependencies`. `SessionViewModel` sigue siendo la fuente de
sesion, bylaws y feedback global en este paso, pero ya no posee feeds de
perfiles comunitarios, el borrador del perfil actual, subida de imagenes de
perfil compartido ni workflows de guardar/borrar perfil. El drawer y la ruta de
perfil consumen el estado de perfiles desde el view model de SharedProfile
propiedad del root.

Users/Admin Members es el sexto slice de feature migrado. `AccessRootViewModel`
posee `UsersFeatureViewModel`, que recibe el repositorio compartido de miembros
y el caso de uso de upsert admin desde `UsersFeatureDependencies`.
`SessionViewModel` sigue siendo la fuente de auth/sesion, bylaws, freshness y
feedback global en este paso, pero ya no posee borradores de miembros ni
workflows admin de gestion de socios. La tarjeta admin del dashboard y la ruta
de Usuarios consumen el view model de Users propiedad del root.

Session/Auth cierra la migracion de slices propiedad del root. `SessionViewModel`
mantiene login, registro, recuperacion de password, refresh, sign out,
impersonacion, routing de reviewer y dialogos de sesion. El feedback global vive
ahora en un `GlobalFeedbackCenter` compartido, freshness de Mi Pedido vive en
`MyOrderFreshnessViewModel` y Bylaws AI vive en `BylawsFeatureViewModel`; los
tres se construyen en `ReguertaAppEnvironment` y son propiedad de
`AccessRootViewModel`. Los view models de feature publican feedback mediante el
centro compartido en vez de pasar mensajes por el estado de sesion.
