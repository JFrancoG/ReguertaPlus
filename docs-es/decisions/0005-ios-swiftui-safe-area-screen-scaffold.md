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
