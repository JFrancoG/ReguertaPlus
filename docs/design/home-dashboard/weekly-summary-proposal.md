# Home Dashboard Option 1 Refinada

Esta version aplica los ajustes sobre la opcion 1.

## Cambios de diseño

- Se elimina el acceso directo a turnos del Home. Sigue disponible desde el menu lateral.
- Se elimina el texto `Semana actual`.
- El rango semanal pasa a ser el dato principal.
- El numero de semana queda como etiqueta secundaria.
- La barra superior deja de decir `Inicio` y muestra la fecha actual completa, por ejemplo `miércoles 6 mayo`.
- Se incorpora la fecha/dia de reparto dentro de la tarjeta semanal.
- Productora y responsable tienen mas ancho que reparto y estado.
- Responsable incluye una segunda linea pequeña para el ayudante.
- Estado del pedido usa color de borde y texto segun estado.
- Las noticias siguen siendo la unica zona preparada para desplazarse.
- Los botones `Mi pedido` y `Pedidos recibidos` se mantienen como en la propuesta anterior.

## Antes del reparto

Objetivo: ayudar a preparar o revisar el pedido.

Jerarquia propuesta:

- Barra superior: menu, fecha actual completa y notificaciones.
- Tarjeta semanal: lunes de la semana en curso hasta el dia de reparto incluido, semana, productora, fecha de reparto, responsable, ayudante y estado.
- Acciones: `Mi pedido` como accion principal, `Pedidos recibidos` como accion de productor.
- Noticias recientes.

## Despues del reparto

Objetivo: reducir urgencia, mostrar cierre y preparar el siguiente ciclo.

Jerarquia propuesta:

- Barra superior: menu, fecha actual completa y notificaciones.
- Tarjeta semanal: desde el dia siguiente al reparto, datos de la semana siguiente.
- Acciones: se mantienen `Mi pedido` y `Pedidos recibidos`; el subtitulo de `Mi pedido` podra cambiar programaticamente.
- Noticias recientes.

## Estados del pedido

Propuesta visual para el hueco `Estado`:

- `Sin hacer`: borde y texto de error, cuando no hay productos elegidos.
- `Sin confirmar`: borde y texto naranja, cuando hay productos en cesta pero no esta confirmado.
- `Completado`: borde y texto verde, cuando el pedido ya esta confirmado.

## Nota de implementacion

La diferencia antes/despues puede salir de estado de calendario:

- Antes o durante reparto: fecha actual anterior o igual al dia de reparto.
- Despues: fecha actual posterior al dia de reparto.

Si no existe estado explicito de reparto completado, conviene empezar usando la fecha actual frente al dia de reparto y dejar el estado manual para una iteracion posterior.
