# ADR-0005: Usar screen scaffold con safe area para rutas Home iOS SwiftUI

## Status

Accepted

## Fecha

2026-05-15

## Contexto

El shell Home de iOS tenia varias rutas compuestas dentro de un `ZStack`
full-screen que ignoraba la safe area vertical. Las rutas individuales
compensaban despues con padding inferior manual, scrolls anidados y overlays
inferiores para busqueda, totales y acciones principales.

Ese patron hacia fragil el layout en dispositivos pequenos: los controles
inferiores podian tapar las ultimas filas de un scroll, el contenido de ruta
tenia que conocer detalles de safe area del shell y resultaba mas dificil
extraer rutas fuera de extensiones de `ContentView`.

## Decision

Usar `ReguertaScreenScaffold` como contenedor de presentacion de rutas Home en
iOS. El scaffold posee el header mediante un top safe-area inset y admite
contenido inferior del shell mediante un bottom safe-area inset. El fondo de
pantalla puede ignorar safe areas, pero el contenido de ruta debe permanecer
dentro de la safe area.

Cada ruta de feature posee su propio scroll y cualquier control inferior
especifico de ruta mediante `safeAreaInset(edge: .bottom)`. Las interacciones
flotantes o modales, como dialogos, scrim del drawer y overlay de carrito de Mi
Pedido, permanecen como overlays explicitos porque deben situarse por encima de
la ruta.

Las primeras rutas migradas bajo esta convencion son:

- `MyOrderRouteView`
- `ReceivedOrdersRouteView`
- `UsersRouteView`

No anadir nuevas pantallas Home al patron legacy donde el layout de ruta vive
en extensiones de `ContentView` o `AccessRootRoutingView`.

## Consecuencias

### Positivas

- Header, contenido de ruta y controles inferiores tienen ownership mas claro.
- Los scrolls reservan espacio para barras inferiores sin padding inferior
  hard-coded.
- Las rutas se pueden extraer incrementalmente sin depender de calculos manuales
  de safe area en la vista raiz.
- Los UI tests pueden apuntar directamente a controles inferiores de ruta.

### Negativas

- Las rutas existentes que aun usan compensacion manual de layout necesitan
  migracion incremental.
- Algunos overlays modales siguen necesitando revision cuidadosa porque cubren
  safe areas intencionadamente.

## Notas

Este ADR solo afecta a la capa de presentacion. No cambia contratos de dominio,
Firebase, repositorios ni Android.

## Adenda de implementacion: HU-078 (2026-08-20)

HU-078 implementa la decision aceptada sin cambiar su modelo de ownership.
`ReguertaScreenScaffold` recibe ahora el ancho de su contenedor SwiftUI activo,
centra el contenido de ancho regular y limita el contenido legible a 720 puntos.
Los contenedores compactos siguen utilizando su ancho disponible.

La implementacion ya no lee geometria global de ventana: se eliminaron
`DeviceScale`, su vista de captura, las extensiones de resize y todos los
consumidores `.resize*`. Esto permite que dos ventanas o contenedores split sean
independientes y conserva la decision original de safe area:

- el scaffold posee el header mediante su top safe-area inset;
- el contenido inferior opcional del shell sigue siendo un bottom inset del
  scaffold;
- cada ruta de feature posee su scroll y bottom inset especifico; y
- el scrim del drawer, los dialogos y el carrito de Mi Pedido siguen como
  overlays explicitos porque no cambia su ownership intencional en el eje z.

Los tokens semanticos de layout y spacing sustituyen la compensacion por ratio de
ancho. Los recorridos UI compactos 3/3, el release gate completo y las revisiones
independientes validan el limite de implementacion. El orden/foco/acciones de
VoiceOver en runtime y una prueba interactiva de Reduce Motion siguen registrados
como evidencia manual pendiente de HU-078; esta adenda no da esas comprobaciones
por completadas ni modifica el estado Accepted del ADR.

Esta adenda no cambia contratos de Android, Domain, Data, Firebase, repositorios
ni backend.

## Nota de aceptacion manual HU-078 (2026-08-20)

El mantenedor completo posteriormente el gate manual registrado por la adenda.
La navegacion/acciones representativas con VoiceOver y Voice Control se
comportaron correctamente; los controles muestreados no mostraron incidencias
en Accessibility Inspector; y una comparacion interactiva Reduce Motion off/on
elimino la animacion material sin ocultar estados ni acciones observados. Esto
cierra la aceptacion acotada del MVP para HU-078, no modifica la decision ni
afirma una certificacion exhaustiva de accesibilidad.
