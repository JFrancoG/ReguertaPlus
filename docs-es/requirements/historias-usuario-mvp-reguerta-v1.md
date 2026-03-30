# Historias de Usuario MVP Reguerta (v1)

Fecha: 2026-03-06

## 1. Socio consumidor

### HU-001 Crear pedido en ventana activa

Como socio consumidor quiero crear mi pedido dentro de la ventana semanal para recibir mis productos en reparto.

Criterios de aceptación:
- Dado que estoy en ventana activa, cuando entro en `Mi pedido`, entonces veo productos disponibles agrupados por productor.
- Dado que hay compras comunes y productor de ecocesta comprometida, cuando se muestra la lista, entonces aparecen priorizados.
- Dado que busco un producto, cuando uso buscador/filtro, entonces se limita el resultado sin perder `companyName`.

### HU-002 Validación de compromisos al confirmar

Como socio con compromisos quiero que el sistema valide mis obligaciones antes de confirmar para evitar errores.

Criterios de aceptación:
- Dado que faltan productos obligatorios, cuando pulso confirmar, entonces el sistema bloquea y muestra advertencia.
- Dado que cumplo compromisos, cuando pulso confirmar, entonces el pedido queda `confirmado`.
- Dado compromiso de ecocesta, cuando elijo opcion `pickup` o `no_pickup`, entonces ambas computan y se mantienen como linea pagada.
- Dado una ecocesta, cuando se calcula el importe, entonces el precio es igual en `pickup` y `no_pickup` y no cambia por productor par/impar.

### HU-003 Continuar carrito no confirmado

Como socio quiero retomar un carrito incompleto para no perder lo ya seleccionado.

Criterios de aceptación:
- Dado que salgo de `Mi pedido` sin confirmar, cuando vuelvo dentro de la ventana activa, entonces recupero líneas y cantidades en carrito.

### HU-004 Editar pedido confirmado dentro de plazo

Como socio quiero modificar un pedido confirmado antes del cierre para ajustar necesidades.

Criterios de aceptación:
- Dado un pedido confirmado y plazo abierto, cuando edito, entonces puedo aumentar/disminuir, eliminar y añadir líneas.
- Dado que el cambio rompe compromisos, cuando intento confirmar edición, entonces se bloquea con advertencia.

### HU-005 Visualizar pedido de semana anterior

Como socio quiero ver el pedido de la semana anterior fuera de ventana activa para consultar subtotales y total.

Criterios de aceptación:
- Dado que estoy entre lunes y día de reparto, cuando entro en `Mi pedido`, entonces veo pedido anterior agrupado por productor.

### HU-006 Recibir recordatorios de pedido pendiente

Como socio con compromiso quiero recibir avisos si no confirmé pedido para evitar olvidos.

Criterios de aceptación:
- Dado pedido en `sin_hacer` o `en_carrito`, cuando llega domingo 20:00, 22:00 o 23:00, entonces recibo push.
- Dado pedido confirmado, cuando llega una hora de recordatorio, entonces no recibo aviso.

## 2. Socio productor / encargado de compras

### HU-007 Gestionar catálogo propio

Como productor quiero crear, editar y archivar mis productos para mantener la oferta actualizada.

Criterios de aceptación:
- Dado que soy productor, cuando entro al catálogo, entonces puedo crear/editar/archivar productos propios.
- Dado un producto existente, cuando intento cambiar `vendorId`, entonces el sistema no lo permite.
- Dado un producto de disponibilidad continua, cuando edito stock, entonces puedo introducir valor directo o modo extendido/infinito.
- Dado la edicion de producto, cuando guardo unidad/pack, entonces puedo persistir `unitAbbreviation` y `packContainerAbbreviation`.
- Dado un producto de ecocesta, cuando se configura, entonces sigue siendo un unico producto de catalogo y la eleccion `pickup` o `no_pickup` se hace en la linea de pedido.
- Dado un producto de ecocesta, cuando se define precio, entonces queda alineado al precio comun de ecocesta (sin diferencias por opcion ni paridad).

### HU-008 Consultar pedidos recibidos

Como productor quiero consultar pedidos recibidos por producto y por usuario para preparar reparto.

Criterios de aceptación:
- Dado que estoy en periodo habilitado, cuando entro en `Pedidos recibidos`, entonces veo pestaña por producto y por usuario.
- Dado que estoy fuera del periodo habilitado, cuando visualizo home, entonces el acceso aparece deshabilitado.

### HU-009 Cambiar estado de preparación/entrega

Como productor quiero actualizar estado del pedido completo para informar avance.

Criterios de aceptación:
- Dado un pedido recibido, cuando cambio estado, entonces solo se aplican estados permitidos `unread`, `read`, `prepared`, `delivered`.
- Dado un pedido nuevo o no revisado por productor, cuando se crea, entonces su estado inicial es `unread`.

## 3. Admin

### HU-010 Gestionar socios y roles

Como admin quiero gestionar altas/bajas, autorización de acceso inicial y privilegios para mantener control de acceso.

Criterios de aceptación:
- Dado que soy admin, cuando entro en lista de usuarios, entonces veo acciones de alta/edición/baja.
- Dado un socio, cuando otorgo/revoco admin, entonces se aplica salvo que deje el sistema sin admins.
- Dado que el email fue preautorizado por admin, cuando hace su primer login/registro, entonces entra a home con acceso habilitado por rol.

### HU-011 Gestionar calendario de reparto

Como admin quiero mover días de reparto futuros para adaptarme a festivos/alertas.

Criterios de aceptación:
- Dado que soy admin, cuando modifico calendario, entonces solo puedo editar horizonte permitido de semanas futuras.
- Dado un cambio de día, cuando llega el siguiente día, entonces el sistema bloquea pedidos según regla.
- Dado una excepcion, cuando se guarda, entonces se persiste en `deliveryCalendar/{weekKey}` (ID = `weekKey`).
- Dado una semana sin documento en `deliveryCalendar`, cuando se resuelve calendario, entonces se usa `config/global.deliveryDayOfWeek`.
- Dado que se elimina una excepcion de una semana, cuando se consulta de nuevo, entonces vuelve al calendario por defecto.

### HU-012 Publicar noticias

Como admin quiero publicar noticias para informar a la comunidad.

Criterios de aceptación:
- Dado que soy admin, cuando publico noticia, entonces queda visible para socios.
- Dado que no soy admin, cuando intento publicar, entonces el acceso se deniega.

### HU-013 Enviar notificaciones segmentadas (MVP)

Como admin quiero enviar notificaciones usando los tipos habilitados para comunicar incidencias y avisos.

Criterios de aceptación:
- Dado que soy admin, cuando creo notificación, entonces puedo usar los segmentos/modos habilitados en MVP.
- Dado un envío de notificaciones, cuando se resuelven destinatarios, entonces se usan los dispositivos registrados en `users/{userId}/devices`.
- Dado un socio con actividad reciente, cuando se consulta su último dispositivo, entonces `users.lastDeviceId` apunta al dispositivo activo más reciente.

## 4. Socio (perfil compartido)

### HU-014 Compartir perfil con la comunidad

Como socio quiero compartir foto y texto de mi unidad familiar para que nos conozcamos mejor.

Criterios de aceptación:
- Dado que soy socio, cuando entro a mi perfil compartido, entonces puedo crear/editar/borrar mi contenido.
- Dado que consulto otro socio, cuando abro su ficha compartida, entonces veo foto, nombres de unidad familiar y texto.

## 5. Turnos

### HU-015 Consultar turnos globales y próximos turnos propios

Como socio quiero ver todos los turnos y mis próximos turnos para organizarme.

Criterios de aceptación:
- Dado que estoy autenticado, cuando entro en turnos, entonces veo consulta global.
- Dado que tengo turnos asignados, cuando entro a home o menú, entonces veo próximo turno de reparto y mercado.

### HU-016 Solicitar intercambio de turno

Como socio quiero solicitar intercambio cuando no puedo asistir para resolverlo dentro de la app.

Criterios de aceptación:
- Dado un turno asignado, cuando creo solicitud, entonces queda en estado pendiente para el socio objetivo.
- Dado que otro socio acepta, cuando el solicitante confirma, entonces el intercambio se materializa.
- Dado intercambio confirmado, cuando se aplica, entonces se notifica a todos los socios.

### HU-017 Planificación con socios en alta

Como admin (o sistema de planificación) quiero generar turnos usando solo socios en alta.

Criterios de aceptación:
- Dado un socio con `isActive = false`, cuando se genera planificación, entonces no entra en rotación.
- Dado un socio nuevo o reactivado, cuando se incorpora, entonces se coloca al final de la rotación.

## 6. Revisor Apple/TestFlight

### HU-018 Probar app de producción sin tocar datos reales

Como revisor quiero ejecutar flujos completos sin comprometer datos reales.

Criterios de aceptación:
- Dado usuario revisor allowlist, cuando inicia sesión en app productiva, entonces opera contra backend develop.
- Dado que realiza altas/bajas/modificaciones, cuando guarda cambios, entonces no impacta producción real.

## 7. IA y documentos

### HU-019 Consultar estatutos con IA híbrida

Como socio quiero consultar estatutos con respuestas rápidas para resolver dudas.

Criterios de aceptación:
- Dado pregunta habitual de estatutos, cuando consulto, entonces se responde en modo local.
- Dado pregunta compleja, cuando se detecta mayor complejidad, entonces se puede escalar a nube.

### HU-020 Gestionar turnos con soporte de fuente externa

Como socio/admin quiero que los turnos se lean y actualicen desde una fuente compartida para mantener coherencia.

Criterios de aceptación:
- Dado origen en Google Sheets, cuando la app consulta turnos, entonces refleja datos vigentes.
- Dado un cambio de turno confirmado, cuando se materializa, entonces se sincroniza fuente y se notifica.

## 8. Arranque de app y operaciones de catalogo

### HU-021 Control remoto de version en arranque

Como socio quiero que la app valide la version minima/actual al arrancar para bloquear o avisar cuando mi version no sea valida.

Criterios de aceptacion:
- Si la actualizacion es forzada, la app bloquea uso hasta actualizar.
- Si la actualizacion es opcional, la app permite continuar.

### HU-022 Frescura de datos criticos antes de pedido

Como socio quiero que `Mi pedido` se habilite solo con datos criticos frescos para no comprar con catalogo/reglas desactualizados.

Criterios de aceptacion:
- `Mi pedido` queda deshabilitado mientras la sincronizacion critica este pendiente.
- Si el sync se bloquea, existe timeout y opcion de reintentar.

### HU-023 Refresco de sesion por lifecycle y UX de expiracion

Como socio quiero refresco de sesion en eventos de lifecycle para mantener acceso estable y saber claramente cuando la sesion expira.

Criterios de aceptacion:
- Refresco de sesion/token en arranque y foreground.
- Sesion expirada muestra mensaje explicito y camino de recuperacion.

### HU-027 Home restringido para usuario autenticado no autorizado

Como persona autenticada pero aun no autorizada quiero feedback claro de acceso restringido en home para entender por que no puedo usar la app y que tiene que pasar despues.

Criterios de aceptacion:
- Si un usuario se autentica en Firebase pero no existe un registro activo autorizado en `users` para ese email, home muestra un estado explicito de no autorizado.
- En estado no autorizado, los modulos operativos siguen deshabilitados y los flujos protegidos permanecen bloqueados.
- El estado no autorizado ofrece una salida segura de cierre de sesion distinta de la recuperacion por sesion expirada.
- Si ese usuario pasa a estar autorizado despues, la siguiente resolucion de sesion restaura el acceso normal al home.

### HU-028 Shell del home con drawer y navegacion por rol

Como socio, productor o admin quiero un shell de home mas claro con navegacion por rol para entender mis areas disponibles y el contexto semanal principal desde un unico punto de entrada.

Criterios de aceptacion:
- Home muestra un shell superior preparado para acceso al menu y a notificaciones.
- El drawer expone secciones comunes para todos y secciones adicionales solo cuando el rol del usuario lo permite.
- El drawer puede abrirse y cerrarse desde el disparador de menu, y el soporte de gestos se revisa por plataforma.
- Home reserva espacio visible para contexto semanal y ultimas noticias, aunque inicialmente usen placeholders.
- La version de la app sigue visible en el footer del drawer.

### HU-024 Toggle masivo de disponibilidad productor

Como productor quiero cambiar la visibilidad global de mi catalogo en una sola accion para gestionar semanas de pausa (vacaciones/enfermedad) sin perder la configuracion de cada producto.

Criterios de aceptacion:
- El productor puede habilitar o deshabilitar la visibilidad global de su catalogo con confirmacion.
- Si la visibilidad global del catalogo del productor esta deshabilitada, no deben aparecer ni su `companyName` ni sus productos en listados de pedido.
- Al re-habilitar la visibilidad global del catalogo, no deben sobrescribirse los valores `isAvailable` de cada producto.

### HU-025 Pipeline de imagen de producto

Como productor quiero seleccionar/recortar/subir imagen dentro del formulario de producto para mantener fichas visuales completas.

Criterios de aceptacion:
- La imagen se puede seleccionar y subir a Storage.
- El producto guarda URL de imagen valida al persistir.

## 9. Backlog de catalogo post-MVP

### HU-026 Venta a granel por unidad de peso

Como productor quiero definir productos a granel con un precio unico en modo peso y como socio quiero introducir directamente la cantidad de peso para evitar duplicar productos por distintos pesos.

Criterios de aceptacion:
- El productor puede crear/editar un producto en modo de precio `weight` con `price` unico.
- El socio puede introducir cantidad decimal de peso para productos `weight` en carrito/edicion.
- El subtotal se calcula en tiempo real como `quantity * price`.
- La linea de pedido conserva snapshot para auditoria (`pricingModeAtOrder`, `priceAtOrder`, `quantity` en la unidad de peso del producto).
