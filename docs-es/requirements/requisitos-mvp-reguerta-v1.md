# Requisitos MVP Reguerta (v1)

Fecha: 2026-03-06  
Fuente: consolidación del borrador funcional y rondas Q1-Q35.

## 1. Alcance MVP

Incluye en MVP:
- Flujo semanal de pedido (socio consumidor).
- Gestión de productos y pedidos recibidos (productor/encargado de compras).
- Validación de compromisos obligatorios.
- Soporte de socios inactivos via `isActive` para no considerar olvido.
- Alta controlada de socios por lista preautorizada administrada por admins.
- Salvaguardas de arranque: control remoto de version, refresco de sesion y puerta de frescura de datos criticos.
- Gestión básica de turnos (reparto/mercado) y solicitudes de intercambio.
- Perfil compartido entre socios.
- Publicación de noticias por admin.
- Notificaciones push de recordatorio de pedido.
- Registro de dispositivos por socio para entrega push y seguimiento del ultimo dispositivo activo.
- Usuario revisor en app de producción apuntando a entorno develop.

Fuera de MVP (fase posterior):
- Libro de caja/incidencias digital completo.
- Venta a granel por unidad de peso (precio + cantidad decimal de peso introducida por el socio), trazada como HU-026.
- Sub-rol de comunicación/editor para noticias.
- Auditoría técnica avanzada de chatbot.

## 2. Reglas de calendario

- Día oficial de reparto: miércoles.
- Excepciones permitidas: martes, jueves o viernes por festivos/alertas meteorológicas.
- Solo admin puede modificar días de reparto futuros (horizonte 8-10 semanas, ampliable a 15-20).
- Día siguiente al reparto: bloqueado para pedidos.
- Ventana de pedidos: desde las 00:00 del día +2 tras reparto hasta domingo 23:59.
- Zona horaria única del sistema: Europa/Madrid.
- `deliveryCalendar` usa `weekKey` como ID de documento (no auto-generado).
- `deliveryCalendar` guarda solo semanas excepcionales; las semanas normales se resuelven desde `config/global.deliveryDayOfWeek`.

### 2.1 Configuracion de Calendario

- `RF-CAL-01` Solo admin puede gestionar fechas futuras de reparto.
- `RF-CAL-02` Al cambiar el dia de reparto, deben recalcularse las ventanas de bloqueo/apertura.
- `RF-CAL-03` `deliveryCalendar/{weekKey}` debe usar `weekKey` como ID de documento.
- `RF-CAL-04` `deliveryCalendar` debe persistir solo semanas de excepcion; si falta el documento de semana se aplica el calendario por defecto.
- `RF-CAL-05` `config/global.deliveryDayOfWeek` se mantiene obligatorio como fuente default de fallback.

## 3. Requisitos funcionales

### 3.1 Usuarios y roles

- `RF-ROL-01` El sistema debe soportar roles: socio, productor/encargado de compras y admin.
- `RF-ROL-02` Un socio productor debe conservar capacidades de socio consumidor.
- `RF-ROL-03` Solo admin puede acceder al CRUD de usuarios/socios.
- `RF-ROL-04` Solo admin puede otorgar/revocar rol admin.
- `RF-ROL-05` El sistema nunca debe permitir quedarse sin admins activos.
- `RF-ROL-06` Un admin debe dar de alta/preautorizar al socio en `users` con su email antes del primer acceso operativo.
- `RF-ROL-07` Si un usuario autenticado usa un email no preautorizado, la app muestra alerta `Usuario no autorizado` y mantiene deshabilitados los módulos operativos hasta alta/autorización admin.
- `RF-ROL-08` Si el email autenticado está preautorizado, en el primer login/registro se enlaza la identidad auth con la ficha del socio y se accede a home.
- `RF-ROL-09` La clasificacion de productor debe persistirse en `users.producerParity` (`even`|`odd`|`null`) cuando aplique.
- `RF-ROL-10` La capacidad de encargado de compras comunes debe representarse con `users.isCommonPurchaseManager` (booleano) sin introducir valores extra en `roles`.

### 3.2 Estado del socio y compromisos

- `RF-COM-01` Todo socio en alta con compromiso semanal debe comprar como minimo 1 ecocesta (regla fija, no configurable en MVP).
- `RF-COM-02` Debe existir compromiso bisemanal fijo par/impar para socios legacy.
- `RF-COM-03` Deben soportarse compromisos de temporada por socio+producto+temporada (cantidad fija).
- `RF-COM-04` La baja de un socio se representa en MVP con `isActive = false` (sin motivo obligatorio).
- `RF-COM-05` Un socio con `isActive = false` no debe computar como olvido ni para automatismos de pedido.
- `RF-COM-06` El compromiso de ecocesta se puede cumplir con opcion `pickup` o `no_pickup`; ambas cuentan como compromiso pagado.
- `RF-COM-07` Se elimina la antigua regla de renuncias anuales de ecocesta; en MVP no existe modo de exencion de pago.
- `RF-COM-08` El precio de ecocesta debe ser identico para `pickup` y `no_pickup`, y tambien entre productor par e impar.

### 3.3 Flujo de pedido del socio

- `RF-ORD-01` En fase de consulta (lunes a día de reparto), el socio debe ver su pedido de la semana anterior.
- `RF-ORD-02` En día bloqueado (día posterior a reparto), debe mostrarse aviso y bloquear creación/modificación.
- `RF-ORD-03` En ventana activa, el socio debe poder crear y editar pedido.
- `RF-ORD-04` El listado de productos debe agruparse por productor y priorizar compras comunes + ecocesta comprometida.
- `RF-ORD-05` Deben existir buscador y filtro por productor.
- `RF-ORD-06` Si faltan compromisos obligatorios, el sistema debe bloquear confirmación y mostrar advertencia.
- `RF-ORD-07` El carrito en curso debe persistir si el usuario sale sin confirmar.
- `RF-ORD-08` Un pedido confirmado debe poder editarse completamente dentro de plazo:
  - aumentar/disminuir cantidad,
  - eliminar líneas,
  - añadir nuevos productos.
- `RF-ORD-09` Estados de consumidor: `sin_hacer`, `en_carrito`, `confirmado`.

### 3.4 Flujo de productor

- `RF-PROD-01` Productor debe ver botón `Pedidos recibidos`.
- `RF-PROD-02` `Pedidos recibidos` habilitado de lunes a día de reparto (incluido), deshabilitado resto.
- `RF-PROD-03` Deben mostrarse vistas por producto y por usuario (con subtotales y total).
- `RF-PROD-04` Estados de productor a nivel pedido completo: `unread`, `read`, `prepared`, `delivered` (estado inicial `unread`).

### 3.5 Catálogo de productos

- `RF-CAT-01` Productor/encargado debe poder crear, editar y archivar productos.
- `RF-CAT-02` No se permite borrado físico de productos en MVP.
- `RF-CAT-03` `vendorId` del producto debe ser inmutable tras creación.
- `RF-CAT-04` Debe existir `disponible` y control de stock.
- `RF-CAT-05` El stock debe poder editarse por entrada directa y soportar modo extendido/infinito.
- `RF-CAT-06` En buscador de productos debe mostrarse `companyName` para desambiguar.
- `RF-CAT-07` El productor puede alternar la visibilidad global de su catalogo en una sola accion confirmada mediante `users.producerCatalogEnabled`, sin sobrescribir `products.isAvailable`.
- `RF-CAT-08` El formulario de producto soporta seleccion/recorte/subida de imagen y persistencia de URL en Storage.
- `RF-CAT-09` (Post-MVP) El sistema debe soportar productos a granel con `pricingMode = weight`, `price` unico y cantidad decimal de peso introducida por el socio.
- `RF-CAT-10` El modelo de producto debe incluir `unitAbbreviation` y `packContainerAbbreviation` para UIs compactas.
- `RF-CAT-11` La eleccion de recogida de ecocesta debe guardarse en la linea de pedido como `ecoBasketOptionAtOrder` (`pickup` o `no_pickup`), no en el documento de producto.
- `RF-CAT-12` El precio de producto ecocesta no puede divergir por opcion ni por productor par/impar.
- `RF-CAT-13` La visibilidad en listado debe combinar estado de productor y producto: `producerCatalogEnabled == true`, `isAvailable == true` y `archived == false`.
- `RF-CAT-14` `products` debe mantenerse ajeno a temporadas concretas; el seguimiento anual o por campaña pertenece a `seasonalCommitments`, no al documento de producto.

### 3.6 Perfil compartido y lista de socios

- `RF-PERF-01` Lista de socios visible para socios autenticados.
- `RF-PERF-02` Vista pública: foto, nombres de unidad familiar y texto libre compartido.
- `RF-PERF-03` Un socio solo puede crear/editar/borrar su propio perfil compartido.
- `RF-PERF-04` Admin debe tener vista de gestión (CRUD usuarios) en la misma área.

### 3.7 Turnos

- `RF-TURN-01` Debe existir pantalla de consulta global de turnos (reparto y mercado).
- `RF-TURN-02` Debe mostrarse de forma visible el próximo turno personal (reparto y mercado).
- `RF-TURN-03` Planificación de turnos solo con socios en alta.
- `RF-TURN-04` Altas nuevas o reincorporaciones deben añadirse al final de la rotación.
- `RF-TURN-05` Debe existir solicitud/aceptación/confirmación de intercambio de turnos.
- `RF-TURN-06` Al materializar un cambio de turno, se debe notificar a todos.
- `RF-TURN-07` Mercado debe asegurar mínimo 3 socios; si falta, tomar del siguiente en rotación.

Nota de gobierno: la política definitiva para cubrir bajas sobrevenidas tras publicar turnos queda para asamblea.

### 3.8 Noticias y comunicación

- `RF-NOTI-01` En MVP solo admin puede publicar noticias.
- `RF-NOTI-02` Debe existir envío de notificaciones push.
- `RF-NOTI-03` Recordatorios automáticos para socios con compromiso y pedido no confirmado en domingo a las 20:00, 22:00 y 23:00.
- `RF-NOTI-04` Admin puede usar los tipos de envío de notificaciones disponibles en el sistema MVP.
- `RF-NOTI-05` El sistema debe guardar dispositivos por socio en `users/{userId}/devices/{deviceId}`, persistir el ultimo `fcmToken` conocido cuando exista, y mantener `users.lastDeviceId` con el ultimo dispositivo activo.

### 3.9 Usuario revisor (Apple/TestFlight)

- `RF-REV-01` Debe existir usuario revisor conocido por la asociación.
- `RF-REV-02` Al autenticar ese usuario en app de producción, su backend debe enrutarse a `develop`.
- `RF-REV-03` Ese usuario puede crear/editar/eliminar en `develop` sin afectar datos productivos.

### 3.10 IA (MVP acotado)

- `RF-IA-01` Consulta de estatutos con enfoque híbrido:
  - local por defecto,
  - nube para preguntas complejas.
- `RF-IA-02` Turnos con fuente en Google Sheets (lectura y cambios) integrable con app.
- `RF-IA-03` Para MVP, la trazabilidad de acciones de turnos se apoya en notificación global de cambios.

### 3.11 Arranque de app y sincronizacion

- `RF-APP-01` En arranque, la app debe leer politica remota de version y soportar actualizacion forzada u opcional.
- `RF-APP-02` El acceso a `Mi pedido` debe depender de frescura de datos criticos (con timeout y reintento).
- `RF-APP-03` El refresco de sesion/token debe ejecutarse en arranque y foreground, con UX explicita de sesion expirada.
- `RF-APP-04` El sistema debe ejecutar sincronizacion selectiva en foreground usando TTL/throttling y timestamps remotos por coleccion.
- `RF-APP-05` Los entornos runtime incluyen `local`, `develop` y `production`, manteniendo override de revisor definido en RF-REV-*.

## 4. Requisitos no funcionales

- `RNF-01` Seguridad por roles en reglas Firestore (lectura/escritura según permisos).
- `RNF-02` Consistencia temporal obligatoria con zona `Europe/Madrid`.
- `RNF-03` Idempotencia en automatismos semanales (recordatorios, generación automática opcional de pedidos).
- `RNF-04` Borrado lógico para entidades históricas críticas (productos, socios, pedidos).
- `RNF-05` Internacionalización inicial en español e inglés.
- `RNF-06` Observabilidad mínima de acciones automáticas (errores de job, envíos push, cambios de turno).
- `RNF-07` Debe mantenerse aislamiento y seguridad entre entornos `local`/`develop`/`production`.

## 5. Criterios de aceptación global MVP

- Todos los flujos semanales respetan calendario operativo configurado por admin.
- Ningún socio con compromiso puede confirmar pedido incumpliendo obligaciones activas.
- La validacion de ecocesta acepta opciones `pickup` y `no_pickup`, y ambas siguen siendo lineas pagadas dentro del total.
- Las lineas de ecocesta usan el mismo precio en `pickup` y `no_pickup`, independientemente del productor par/impar.
- Un socio con `isActive = false` no recibe tratamiento de olvido.
- Turnos son consultables globalmente y cada socio ve sus próximos turnos.
- Un intercambio aceptado y confirmado se refleja en turnos y dispara notificación.
- Usuario revisor opera en `develop` sin riesgo para producción real.
- Un usuario autenticado que no esté en la lista de socios preautorizados permanece en modo restringido hasta que un admin le dé de alta.
- Una politica de actualizacion forzada bloquea versiones no soportadas en arranque.
- `Mi pedido` solo se habilita tras validar frescura de datos criticos.

## 6. Riesgos y decisiones abiertas (no bloqueantes)

- Definir en asamblea política final de reemplazo cuando hay baja sobrevenida tras publicación de turnos.
- Definir restricciones adicionales de edición de producto (además de `vendorId` inmutable).
- Definir estrategia exacta Android para fallback de recordatorios (push vs alarma local según versión/políticas).
- Referencia: `docs-es/requirements/reconciliacion-features-implementadas-v1.md`.
