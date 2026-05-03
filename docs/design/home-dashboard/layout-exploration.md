# Home Dashboard Layout Options

Exploracion visual para reorganizar la pantalla principal sin tocar codigo de app.

Fecha usada en los ejemplos: jueves 30 de abril de 2026, semana 18.

## Objetivo

La pantalla debe mostrar, sin scroll general:

- Acceso al menu lateral.
- Acceso a notificaciones recibidas.
- Accion principal: `Mi pedido`.
- Accion de productor: `Pedidos recibidos`.
- Semana actual.
- Productor o productora asignada.
- Persona responsable del turno de reparto.
- Noticias recientes como unica zona desplazable.

## Opciones

### 1. Panel compacto

Opcion recomendada.

Coloca primero el estado operativo de la semana, despues las acciones principales y finalmente noticias.

Ventajas:

- Mantiene clara la prioridad de `Mi pedido`.
- Da contexto semanal antes de actuar.
- Encaja bien para usuarios normales y productores.
- Deja noticias visibles sin convertirlas en el foco principal.

### 2. Accion principal dominante

Da mas peso visual a `Mi pedido`.

Ventajas:

- Muy directa para usuarios que abren la app principalmente para pedir.
- Reduce ruido visual en las acciones secundarias.

Riesgos:

- La informacion de productor y avisos queda mas fragmentada.
- El estado semanal se percibe menos como encabezado de contexto.

### 3. Agenda primero

Convierte la semana y el turno en el encabezado principal.

Ventajas:

- Muy clara para coordinacion y logistica.
- El turno de reparto destaca mas.

Riesgos:

- `Mi pedido` pierde algo de protagonismo.
- La reticula de acciones puede sentirse mas administrativa.

## Recomendacion

Avanzar con la opcion 1 como base: panel semanal compacto, dos acciones principales, una accion secundaria de turnos/calendario y noticias debajo.

Para implementacion, conviene mantener los componentes dentro del sistema actual:

- Top bar con menu a la izquierda y notificaciones a la derecha.
- Tarjeta compacta de estado semanal.
- Botones con variantes existentes `primary`, `secondary` o `text`.
- Noticias con altura flexible y scroll interno cuando haya varias entradas.
