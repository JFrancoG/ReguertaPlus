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
