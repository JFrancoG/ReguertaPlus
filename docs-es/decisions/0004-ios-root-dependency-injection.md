# ADR-0004: Usar inyeccion de dependencias raiz en iOS SwiftUI

## Status

Accepted

## Fecha

2026-05-11

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
fuente de sesion y feedback global, pero ya no posee feeds de turnos, estado del
workflow de cambios, estado del calendario de entregas, solicitudes de
planificacion admin ni el override de reloj develop. Orders consume turnos y
calendario de entregas desde el view model de Shifts propiedad del root para que
las ventanas de pedido sigan compartidas sin reintroducir dependencias ocultas.

News/Notifications es el cuarto slice de feature migrado. `AccessRootViewModel`
posee `NewsNotificationsFeatureViewModel`, que recibe dependencias de noticias,
notificaciones, pipeline de imagenes y reloj desde
`NewsNotificationsFeatureDependencies`. `SessionViewModel` sigue siendo la
fuente de sesion, bylaws y feedback global, pero ya no posee feeds de noticias,
borradores de noticias, subida de imagenes de noticias, feeds de
notificaciones, borradores de broadcasts ni workflows admin de envio o borrado.
Shifts y News/Notifications pueden compartir una unica instancia de
`NotificationRepository` desde el contenedor raiz cuando ambos slices necesitan
publicar o leer eventos de notificacion.

SharedProfile es el quinto slice de feature migrado. `AccessRootViewModel`
posee `SharedProfileFeatureViewModel`, que recibe dependencias de repositorio de
perfiles compartidos, pipeline de imagenes y reloj desde
`SharedProfileFeatureDependencies`. `SessionViewModel` sigue siendo la fuente de
sesion, bylaws y feedback global, pero ya no posee feeds de perfiles
comunitarios, el borrador del perfil actual, subida de imagenes de perfil
compartido ni workflows de guardar/borrar perfil. El drawer y la ruta de perfil
consumen el estado de perfiles desde el view model de SharedProfile propiedad
del root.
