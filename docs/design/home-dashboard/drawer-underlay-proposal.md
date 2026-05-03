# Home Drawer Underlay Proposal

Propuesta de diseno para el menu lateral del Home.

## Principio principal

El drawer debe mantener el comportamiento actual observado en la app:

- El menu vive debajo.
- El Home se desplaza hacia la derecha.
- El Home conserva una parte visible en el borde derecho.
- La sombra del Home marca la profundidad entre ambas capas.

Esto evita que el menu parezca un modal superpuesto y conserva la sensacion de panel lateral propio de la app.

## Cabecera

- Mostrar imagen de perfil del usuario o de su familia cuando exista.
- Si no hay imagen, usar el logo circular de La Reguerta como fallback.
- Mostrar nombre familiar o nombre visible.
- Mostrar email o identificador en una linea secundaria pequena.

## Secciones

Orden recomendado:

1. `Para todos`
2. `Productores`
3. `Admin`

### Para todos

Funciones visibles para cualquier usuario autorizado:

- Home
- Mi pedido
- Mis pedidos
- Turnos
- Estatutos
- Noticias
- Notificaciones
- Perfil

### Productores

Solo se muestra si el usuario tiene permisos de productor:

- Productos
- Pedidos recibidos

### Admin

Solo se muestra si el usuario tiene permisos administrativos:

- Usuarios
- Publicar noticia
- Aviso general

## Footer

- Mantener `Cerrar sesion` separado de la navegacion principal.
- Mostrar version anclada abajo.
- Si la app esta en develop, mostrar una etiqueta `DEV` junto a la version, preferiblemente con color de aviso.

Ejemplos:

- `iOS 0.21.8`
- `iOS 0.21.8 DEV`
- `Android 0.21.8 DEV`

## Implementacion

La propuesta puede aplicarse tanto en iOS como en Android manteniendo el contrato actual de destinos.

Puntos a cuidar:

- No convertir el drawer en overlay modal.
- La capa del Home debe ser la que se anima.
- Preservar cierre por boton atras, toque fuera o gesto horizontal si ya existe.
- Mantener secciones ocultas cuando el usuario no tenga permisos.
