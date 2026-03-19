Q25# Funcionamiento de La Reguerta (Borrador Estructurado)

## 1. Objetivo de este documento

Organizar el borrador funcional en bloques claros para:
- Identificar reglas de negocio confirmadas.
- Detectar huecos de información y ambigüedades.
- Preparar la extracción posterior de requisitos, historias de usuario y modelo de datos en Firestore.

## 2. Alcance funcional actual (resumen)

La app cubre principalmente:
- Gestión de pedidos semanales de socios.
- Gestión de oferta de productos por productores.
- Reglas de compromiso de compra (ecocesta y compras comunes).
- Consulta de pedidos (consumidor y productor).
- Gestión de turnos (reparto y mercado).
- Perfil, ajustes, sugerencias/incidencias y notificaciones.

## 3. Actores y roles

Roles identificados:
- `Socio consumidor`: realiza su pedido semanal.
- `Socio productor`: además de comprar, oferta productos y consulta pedidos recibidos.
- `Productor no socio`: oferta productos, sin obligación de compra.
- `Administrador`: gestiona usuarios, noticias y notificaciones.
- `Unidad familiar`: varias personas acceden con el mismo usuario.
- `Revisor externo (Apple/TestFlight)`: usuario de pruebas en producción con acceso controlado.

## 4. Reglas de negocio confirmadas

### 4.1 Compromisos de compra

- Al darse de alta, un socio se compromete a comprar al menos una ecocesta cada semana.
- La ecocesta la ofrecen dos productores alternándose por semana (par/impar).
- El precio de ecocesta es único: mismo importe para productor par/impar y para opción recogida/no recogida.
- Existen 7 socios antiguos con compromiso bisemanal: solo compran la ecocesta del productor par o impar asignado.
- El resto de productos de esos dos productores se ofertan normalmente en su semana, con excepciones puntuales en la semana opuesta (nunca la ecocesta).
- El resto de productores ofertan semanalmente cuando tienen disponibilidad.
- Los productores no socios no tienen obligación de compra.

### 4.2 Compras comunes

- Hay compras comunes para abaratar costes.
- Algunos socios asumen rol operativo de "productor" en esas compras.
- Puede haber compras comunes de:
  - Un solo producto (ej.: aceite).
  - Varios productos de un proveedor.
- En productos de temporada (actualmente mangos, aguacates, chirimoyas), algunos socios adquieren un compromiso fijo de cantidad por cada semana ofertada.
- Debe impedirse confirmar pedido si no se cumplen los compromisos obligatorios de cada socio.

### 4.3 Operativa semanal

La semana es la unidad principal y define el comportamiento de la app.

Fases:
- `Fase A` (lunes a día de reparto, ambos inclusive): se consulta pedido de semana anterior.
- `Fase B` (día posterior al reparto): no se puede pedir; día reservado a cambios de productores.
- `Fase C` (desde fin de reserva hasta domingo): ventana activa de pedido/modificación.

### 4.4 Flujo de pedido del consumidor

En `Mi pedido`, durante Fase C:
- Si no hay pedido confirmado:
  - Se muestran productos disponibles agrupados por productor.
  - Orden deseado: compras comunes, productor ecocesta comprometida, resto.
  - Hay buscador y filtro por productor.
  - Se añade al carrito y se confirma pedido desde carrito.
  - Si faltan productos obligatorios por compromiso, se bloquea confirmación con aviso.
  - Si se vuelve atrás sin confirmar, el carrito debe persistir para retomar.
- Si el pedido ya está confirmado:
  - Se muestra agrupado por productor con subtotales y total.
  - Se puede modificar dentro de plazo (antes de acabar domingo).

### 4.5 Flujo de productor

En Home, además de `Mi pedido`, aparece `Pedidos recibidos`.

Disponibilidad del botón:
- Habilitado: lunes a día de reparto (inclusive).
- Deshabilitado: desde día posterior al reparto hasta domingo.

Dentro de `Pedidos recibidos`:
- Pestaña 1: agrupado por producto.
- Pestaña 2: agrupado por usuario con subtotal por usuario y total general.

### 4.6 Estados del pedido

Estados mencionados:
- Del lado consumidor: `sin hacer`, `en carrito`, `confirmado`.
- Del lado productor: `unread`, `read`, `prepared`, `delivered`.
- Estado inicial del lado productor: `unread` (sin `null`).

### 4.7 Menú lateral y módulos

- Histórico semanal de compras.
- Mi perfil (datos personales/familiares compartibles).
- Vista de usuarios/socios (con diferencia entre visibilidad para socios y CRUD admin).
- CRUD de productos para productores, controlando campos editables y evitando inconsistencias.
- Ajustes:
  - Apariencia: light/dark/system.
  - Modo vacaciones productor (oculta toda su oferta semanal sin editar producto a producto).
- Sugerencias de mejora, consulta de estatutos (IA), donaciones, reporte de errores.

### 4.8 Notificaciones

- A socios con compromiso: si el domingo a las 20:00 el pedido sigue `sin hacer` o `en carrito`, enviar aviso (push o alarma local).
- Cada socio mantiene subcoleccion `users/{userId}/devices/{deviceId}` con metadatos de dispositivo para entrega push.
- En iOS, el campo `apiLevel` en dispositivos se guarda como `null`.
- `users.lastDeviceId` guarda el ultimo dispositivo activo del socio.

### 4.9 Turnos

#### Reparto (semanal)

- Dos socios implicados por semana: encargado + ayudante (siguiente en orden).
- Asignación por orden alfabético rotatorio.
- El ayudante se lleva llave/carpeta e incidencias para la siguiente semana.
- Existe caja para incidencias (adelantos/reposiciones), con posible seguimiento de saldo en la app.

#### Mercado (mensual)

- Tercer sábado de cada mes, excepto julio y agosto.
- Asisten 3 socios (a veces 4).
- Deben poder gestionarse intercambios de turno.

### 4.10 Internacionalización y operación

- Idiomas: español e inglés.
- Usuario de pruebas en producción para review (Apple/TestFlight), aislado para no afectar datos reales ni visibilidad.
- Objetivo futuro: chatbot IA local para consultar/cambiar turnos y consultar documentación local/Drive.

## 5. Inconsistencias y puntos ambiguos detectados

1. El "día de reparto" no está fijado formalmente (se menciona normalmente miércoles).
2. No está definido con precisión cuándo empieza y termina la "Fase B" (reserva para productores).
3. No está definido si la app opera con zona horaria única o configurable.
4. No está cerrado qué ocurre si un socio con obligación no confirma a tiempo (más allá del aviso).
5. No está especificado qué puede modificar un pedido ya confirmado dentro de plazo (todo o parcialmente).
6. No hay detalle de reglas de stock, límites o redondeos de cantidad (kg/unidades).
7. No está definido el modelo de permisos exacto por rol ni roles combinados.
8. No está definido qué significa exactamente "baja" para cada entidad (soft delete, archivado, anonimización).
9. No están definidos los campos del perfil visibles para socios vs admin.
10. No están definidos los estados ni ciclo de vida de turnos/intercambios.
11. No está definido el flujo de pagos/liquidaciones/caja con detalle contable.
12. Faltan criterios de seguridad para el usuario de pruebas y para el chatbot de documentos.

## 6. Información faltante para diseñar Firestore correctamente

### 6.1 Catálogos y entidades

- Definición formal de entidades y relaciones:
  - Usuario/socio/unidad familiar.
  - Productor y proveedor.
  - Producto, variante y unidad de medida.
  - Pedido, línea de pedido, estado.
  - Compromiso (ecocesta, temporada, bisemanal).
  - Turno (reparto/mercado), intercambio, incidencia.
  - Notificación y registro de envío.
  - Caja/incidencia/saldo.

### 6.2 Reglas temporales

- Calendario operativo semanal exacto (día/hora de corte por fase).
- Excepciones por festivos o cambios puntuales.
- Calendario de temporada y disponibilidad por productor.

### 6.3 Permisos y seguridad

- Matriz de permisos por rol y operación (lectura/escritura/administración).
- Reglas Firestore para acceso por rol y por pertenencia (socio/productor/admin).
- Estrategia para usuario revisor aislado en producción.

### 6.4 Integración con lo ya existente en Firestore

- Inventario de colecciones/campos actuales.
- Campos obsoletos o inconsistentes.
- Estrategia de migración sin romper app actual.

## 7. Preguntas abiertas (para cerrar antes de requisitos e historias)

### 7.1 Calendario y ventanas

Q1. ¿Cuál es exactamente el día de reparto oficial y su hora límite?

Q2. ¿Qué franja exacta ocupa el "día de reserva para productores" (inicio/fin)?

Q3. ¿El cierre de pedidos es siempre domingo 23:59 o otra hora concreta?

Q4. ¿Se usa una única zona horaria para todos (Europa/Madrid)?

### 7.2 Compromisos y validaciones

Q5. En compromiso ecocesta semanal, ¿la cantidad obligatoria mínima es siempre 1 unidad?

Q6. Para los 7 socios bisemanales, ¿la asignación par/impar es fija en ficha de socio?

Q7. En compromisos de temporada (mango/aguacate/chirimoya), ¿la cantidad se fija por socio+producto+temporada?

Q8. Si un socio con obligación no confirma a tiempo, ¿qué acción se toma además del aviso (bloqueo, incidencia, cargo, gestión manual)?

Q9. ¿Puede un admin excepcionar manualmente una obligación en una semana concreta?

### 7.3 Pedidos y estados

Q10. ¿Qué campos exactos necesita cada línea de pedido (cantidad, unidad, precio en momento de compra, notas, etc.)?

Q11. ¿Un pedido confirmado puede editarse totalmente hasta el cierre o solo cantidades?

Q12. ¿Los estados `unread`, `read`, `prepared`, `delivered` aplican al pedido completo o por línea/producto?

Q13. ¿Debe existir trazabilidad de cambios (historial de ediciones del pedido)?

### 7.4 Productos y catálogo

Q14. ¿Qué operaciones del CRUD de producto estarán permitidas (crear, editar, archivar) y cuáles prohibidas?

Q15. ¿Qué campos de producto son inmutables por consistencia (ej.: productor propietario, unidad base)?

Q16. ¿Se maneja stock o límite máximo por producto/semana?

Q17. ¿Cómo se modelan productos de compra común multi-proveedor?

### 7.5 Usuarios, perfiles y permisos

Q18. ¿Qué diferencia exacta hay entre "socio", "productor", "productor no socio" y "admin" a nivel de permisos?

Q19. ¿Qué campos del perfil son públicos para otros socios y cuáles privados?

Q20. ¿Cómo se representa la unidad familiar dentro de un único usuario (subperfiles, texto libre, miembros estructurados)?

Q21. ¿Cuántos administradores puede haber y quién los nombra?

### 7.6 Turnos e incidencias

Q22. En reparto, ¿la rotación alfabética excluye temporalmente a socios no disponibles?

Q23. ¿Qué reglas exactas aplican para intercambio de turnos (aprobación, límites, trazabilidad)?

Q24. En mercado, ¿el mínimo es siempre 3 personas y cuándo pasa a 4?

Q25. ¿Qué datos mínimos debe guardar cada incidencia y cómo impacta al saldo de caja?

Q26. ¿El saldo de caja necesita libro contable completo o solo balance acumulado?

### 7.7 Notificaciones y comunicaciones

Q27. ¿Qué canal es obligatorio (push, email, ambos) para avisos de compromiso?

Q28. ¿Debe haber recordatorios adicionales antes del domingo a las 20:00?

Q29. ¿Qué notificaciones pueden enviar admins (segmentadas por rol, todos, listas)?

### 7.8 Usuario revisor y seguridad

Q30. ¿Qué permisos exactos tendrá el usuario de pruebas en producción?

Q31. ¿Debe ver datos reales anonimizados, datos sintéticos o un espacio aislado?

Q32. ¿Cómo se evita que altere tablas y, a la vez, permita review funcional completa?

### 7.9 Chatbot IA

Q33. ¿Qué documentos exactos podrá consultar el chatbot (solo locales, también Drive)?

Q34. ¿El cambio de turnos por chatbot requiere confirmación explícita en app?

Q35. ¿Qué nivel de auditoría se necesita para acciones del chatbot?

## 8. Propuesta de siguiente paso

Tras resolver las preguntas abiertas:
- Derivar requisitos funcionales y no funcionales versionados.
- Escribir historias de usuario con criterios de aceptación.
- Diseñar modelo Firestore objetivo comparándolo con lo ya existente para plan de migración incremental.

## 9. Respuestas confirmadas (Ronda 1: Q1-Q9)

Fecha de consolidación: 2026-03-06 (zona horaria Europa/Madrid).

- `Q1` Resuelta:
  - Día oficial de reparto: miércoles.
  - Excepciones: puede moverse a martes, jueves o viernes por festivos o alertas meteorológicas.
  - Debe existir ajuste solo admin para mover días de reparto futuros.
  - Horizonte sugerido de planificación: 8-10 semanas; ampliable a 15-20 si fuese necesario.
  - No es necesario modelar hora exacta de reparto para la lógica de pedido.
- `Q2` Resuelta:
  - El día inmediatamente posterior al reparto queda bloqueado para pedidos.
- `Q3` Resuelta:
  - Ventana de pedido: desde las 00:00 del día +2 tras reparto hasta las 23:59 del domingo.
  - Ejemplo con reparto miércoles: jueves bloqueado; pedidos desde viernes 00:00 a domingo 23:59.
- `Q4` Resuelta:
  - Zona horaria única: Europa/Madrid.
- `Q5` Resuelta:
  - Compromiso minimo ecocesta: 1 cesta (regla fija, no configurable).
- `Q6` Resuelta:
  - En los 7 socios bisemanales, la asignación par/impar (productor comprometido) es fija.
- `Q7` Resuelta:
  - En temporada, el compromiso se fija por combinación socio + producto + temporada.
- `Q8` Resuelta (estado actual + oportunidad):
  - Estado actual: no hay acción automática si el socio olvida confirmar.
  - Operativa manual actual: contacto por teléfono/WhatsApp con productores.
  - Mejora deseada: detectar olvidos y crear automáticamente pedido mínimo con compromisos.
- `Q9` Pendiente de aclaración:
  - Resuelto en Ronda 2.

## 10. Respuestas confirmadas (Ronda 2: Q9-Q13)

Fecha de consolidación: 2026-03-06 (zona horaria Europa/Madrid).

- `Q9` Resuelta:
  - Si existe casuistica de baja temporal de socios (ejemplo: enfermedad grave).
  - Decision de modelado MVP: usar `isActive = false` para bajas temporales o definitivas.
  - Necesidad funcional: diferenciar operativamente olvido real vs ausencia justificada usando `isActive`.
  - No es necesario guardar el motivo concreto de la baja.
- `Q10` Resuelta:
  - Estado actual de línea de pedido en Firestore: incluye como mínimo `orderId`, `userId`, `productId`, `companyName`, `quantity`, `subtotal`, `week`.
  - En histórico 2025 migrado se añadieron más campos snapshot para preservar contexto: `createdAt`, `packContainerName`, `packContainerPlural`, `packContainerQty`, `priceAtOrder`, `productImageUrl`, `productName`, `unitName`, `unitPlural`, `unitQty`, `vendorId`, `weekKey`.
  - Decisión actual: mantener riqueza de datos histórica útil y eliminar del esquema objetivo los campos legacy de compatibilidad que ya no aportan (`archivedFrom`, `lineTotal`, `schemaVersion`).
- `Q11` Resuelta:
  - Pedido confirmado editable dentro de plazo con operaciones completas:
    - Aumentar/disminuir cantidad.
    - Eliminar líneas.
    - Añadir nuevos productos.
- `Q12` Resuelta:
  - Estados de productor (`unread`, `read`, `prepared`, `delivered`) aplican al pedido completo.
- `Q13` Resuelta:
  - No se requiere historial/auditoría detallada de cambios del pedido.

## 11. Implicaciones directas para requisitos

- Debe usarse `users.isActive` como bandera unica de alta/baja operativa para no disparar automatismos de olvido.
- Si se implementa creacion automatica de pedido por olvido, debe excluir socios con `isActive = false`.
- El modelo de línea de pedido puede mantener snapshot de datos de producto en el momento de compra para preservar histórico.
- El ciclo de edición del pedido dentro de ventana abierta exige recalcular validaciones de compromiso en cada cambio.

## 12. Respuestas confirmadas (Ronda 3: Q14-Q17)

Fecha de consolidación: 2026-03-06 (zona horaria Europa/Madrid).

- `Q14` Resuelta:
  - Operaciones permitidas en producto: crear, editar y archivar.
  - Operación no permitida: borrado físico (`delete`) para no romper consistencia/histórico.
- `Q15` Resuelta (parcial en restricciones):
  - `vendorId` queda determinado por el productor propietario y debe ser inmutable.
  - El resto de campos, en principio, podrían modificarse.
  - Pendiente de diseñar restricciones adicionales por consistencia para algunos campos.
- `Q16` Resuelta (estado actual + necesidades detectadas):
  - Existen campos de `stock` y `disponible`.
  - Dolor operativo actual: actualización de stock de uno en uno no es práctica para productos con disponibilidad casi permanente.
  - Necesidad: soportar stock alto/infinito o edición directa de stock (entrada manual de número).
  - Necesidad futura detectada (pos-MVP): productos a granel con precio por unidad de peso y cantidad libre por parte del socio, con cálculo dinámico de subtotal.
- `Q17` Resuelta:
  - Sobre coincidencias de producto entre productores: actualmente no suele haber conflicto de nombre/descripción y se diferencia por `companyName`.
  - En buscador debe mantenerse visible `companyName` para desambiguar resultados.
  - Compras comunes:
    - Aceite: evento puntual (cada 6-8 meses) con selección de productos y precio negociado.
    - Temporada (mango/aguacate/chirimoya): compromiso semanal por kg durante campaña.
  - No es necesario conservar estructura de campaña de un año a otro para reutilización, porque cantidades y precios cambian significativamente (incluso dentro de la misma temporada por variedad).

## 13. Implicaciones directas para requisitos (Ronda 3)

- Catálogo de productos con estrategia de borrado lógico (`archived`) y sin borrado físico.
- Reglas de inmutabilidad mínimas: `vendorId` no editable tras creación.
- Modelo de stock debe soportar al menos:
  - edición manual directa del valor,
  - modo de disponibilidad extendida (stock muy alto o semántica de ilimitado).
- Feature de venta a granel (precio por unidad de peso con cantidad libre) se considera candidata para fase posterior al MVP.

## 14. Respuestas confirmadas (Ronda 4: Q18-Q21 + ampliación Q17)

Fecha de consolidación: 2026-03-06 (zona horaria Europa/Madrid).

- `Q17` Resuelta:
  - No se requiere persistencia reutilizable entre campañas/años.
  - Se prioriza operativa semanal y/o de campaña vigente.
  - `companyName` visible en listados y buscador para distinguir productos similares.
- `Q18` Resuelta (matriz funcional base):
  - Socio normal:
    - Acceso a su flujo de pedido y a histórico de pedidos realizados.
    - Sin acceso a histórico de pedidos recibidos.
    - Sin acceso a CRUD de productos.
    - Sin acceso a CRUD de usuarios.
  - Productor / encargado de compras:
    - Acceso a gestión de sus productos.
    - Acceso a pedidos recibidos e histórico asociado.
    - Mantiene capacidades de socio consumidor.
  - Admin:
    - Acceso a CRUD de usuarios/socios.
    - Puede marcar/desmarcar rol admin de otros socios.
  - Ajustes:
    - Comunes para todos.
    - Ajustes adicionales para productor/admin según rol.
  - Noticias/publicación:
    - Para MVP, solo admin publica.
    - Evolución futura opcional: sub-rol específico de comunicación/editor.
- `Q19` Resuelta:
  - Lista de socios visible para todos los socios.
  - Si es admin: ve detalle de gestión (CRUD administrativo).
  - Si no es admin: ve solo información compartida de cada socio.
  - Datos compartidos previstos:
    - Foto.
    - Texto libre amplio.
    - Nombres de unidad familiar.
- `Q20` Resuelta:
  - La información de unidad familiar se modela como contenido de perfil compartido (con campo de nombres + descripción libre), no como estructura compleja obligatoria en esta fase.
- `Q21` Resuelta:
  - Puede haber varios admins.
  - Solo un admin puede otorgar o revocar privilegio admin.
  - Un admin puede quitarse a sí mismo el rol solo si no es el único admin activo.

## 15. Implicaciones directas para requisitos (Ronda 4)

- En la lista de socios se necesita vista dual por permisos:
  - vista pública compartida para todos,
  - vista administrativa con acciones de gestión para admins.
- En UI de lista de usuarios:
  - Botones de alta/edición/baja solo habilitados para admin.
  - Acción de ver info compartida disponible para socios.
  - En perfil propio, permitir crear/editar/borrar contenido compartido (borrado duro aceptado en esta sección de perfil).
- Reglas de integridad de admins:
  - Nunca permitir estado sin ningún admin.
- Compras comunes:
  - Modelo orientado a operación vigente; no requiere repositorio histórico de plantillas de campaña entre años.

## 16. Respuestas confirmadas (Ronda 5: Q22-Q26 + cierre parcial Q18 noticias)

Fecha de consolidación: 2026-03-06 (zona horaria Europa/Madrid).

- `Q22` Resuelta (con punto de gobernanza pendiente):
  - Al generar turnos, solo entran socios en alta (se excluyen bajas temporales y definitivas).
  - Altas nuevas o reactivaciones tras estar inactivo: se anaden al final de la cola de turnos.
  - Si alguien causa baja después de publicar turnos:
    - Operativa actual: buscar voluntario.
    - Alternativa propuesta: correr posiciones siguientes.
  - La política definitiva para cubrir bajas sobrevenidas debe decidirse en asamblea.
  - Necesidad UX confirmada:
    - Pantalla de consulta general de turnos (todos).
    - Mensaje visible para cada socio con próximos turnos de reparto y mercado.
- `Q23` Resuelta:
  - Flujo de intercambio:
    - Un socio solicita cambio desde la vista de turnos.
    - Otro socio acepta solicitud.
    - Puede requerir confirmación final del solicitante antes de ejecutar cambio.
  - Tras hacerse efectivo el cambio, comunicar a todos (push recomendado).
- `Q24` Resuelta:
  - Mercado: mínimo fijo de 3 socios por evento.
  - Si no se cubre, se toma del siguiente socio en rotación.
- `Q25` Resuelta:
  - Incidencias de caja identificadas (retraso/ausencia con adelanto desde caja y reposición posterior).
  - Esta funcionalidad (incidencias + saldo de caja en app) se considera fuera de MVP.
- `Q26` Resuelta:
  - Gestión de caja detallada fuera de MVP (se mantiene operativa actual en papel en esta fase).
- `Q18` (noticias) Resuelta para MVP:
  - Para MVP, publicación de noticias restringida a admins.
  - Posible evolución futura a sub-rol específico de comunicación/editor.

## 17. Implicaciones directas para requisitos (Ronda 5)

- Turnos:
  - El planificador debe filtrar automáticamente socios en alta.
  - Debe soportar altas/reincorporaciones añadiéndolas al final de la rotación vigente.
  - Debe existir módulo de solicitudes de intercambio con aceptación y confirmación final.
  - Debe notificarse el resultado de cambios de turno a todos los socios.
- UX de seguimiento:
  - Vista global de turnos accesible desde home o menú lateral.
  - Indicador personal de próximos turnos (reparto y mercado) en zona visible.
- Caja/incidencias:
  - Excluidas del MVP, pero conviene dejar el modelo preparado para ampliación.
- Noticias:
  - Permiso de publicación limitado a admin en MVP.

## 18. Respuestas confirmadas (Ronda 6: Q27-Q32)

Fecha de consolidación: 2026-03-06 (zona horaria Europa/Madrid).

- `Q27` Resuelta:
  - Canal de aviso de compromiso: solo notificaciones push.
  - En Android se valora apoyo con alarma local en dispositivos/versiones donde aplique.
- `Q28` Resuelta:
  - Además del recordatorio principal (domingo 20:00), se desean dos recordatorios nocturnos adicionales.
  - Horas confirmadas: domingo 22:00 y domingo 23:00.
- `Q29` Resuelta:
  - Para MVP, el admin podrá usar todos los tipos de envío de notificaciones que implementemos (si se ofrecen varios segmentos/modos).
- `Q30` Resuelta:
  - Usuario revisor de producción con capacidad funcional completa.
- `Q31` Resuelta:
  - El usuario revisor, al autenticarse en app de producción, debe trabajar contra datos/entorno de `develop`.
- `Q32` Resuelta:
  - No es necesario bloquear escritura para el usuario revisor mientras opere contra `develop`.
  - Puede crear, editar y eliminar libremente en ese entorno no productivo.

## 19. Implicaciones directas para requisitos (Ronda 6)

- Notificaciones:
  - Implementar push como canal obligatorio para avisos de compromiso.
  - Añadir recordatorios en domingo a las 20:00, 22:00 y 23:00 para socios con compromiso y pedido sin confirmar.
- Revisor Apple/TestFlight:
  - Requiere enrutado por identidad (usuario/UID allowlist) para usar backend `develop` desde binario de producción.
  - Debe existir separación estricta de datos entre producción real y entorno de revisión.
  - El usuario revisor podrá ejecutar flujos completos sin riesgo para tablas productivas al operar en `develop`.

## 20. Respuestas confirmadas (Ronda 7: cierre Q28 + Q33-Q35)

Fecha de consolidación: 2026-03-06 (zona horaria Europa/Madrid).

- `Q28` Resuelta:
  - Se confirman tres avisos push en domingo: 20:00, 22:00 y 23:00.
- `Q33` Resuelta:
  - Consulta de estatutos con enfoque híbrido:
    - Prioridad a modelo local para preguntas habituales sobre documento corto.
    - Escalado a nube para preguntas más complejas.
  - Para turnos:
    - Migrar/asegurar fuente en Google Sheets (si aún está en Excel).
    - Leer turnos para mostrarlos en app.
    - Permitir cambios de turnos desde app sobre esa fuente.
- `Q34` Resuelta:
  - En cambios de turno, se mantiene flujo de confirmación explícita antes de materializar el cambio (alineado con ronda de intercambio ya definida).
- `Q35` Resuelta:
  - No se requiere auditoría técnica compleja para chatbot en MVP.
  - Control operativo esperado:
    - Cada cambio efectivo dispara notificación a todos.
    - Validación social por implicados/admin al recibir la notificación.

## 21. Implicaciones directas para requisitos (Ronda 7)

- IA estatutos:
  - Diseñar estrategia híbrida local+nube con criterio de escalado por complejidad.
- Turnos con fuente externa:
  - Definir integración con Google Sheets para lectura y actualización de turnos.
  - Mantener coherencia entre cambios ejecutados y notificaciones globales.
- Auditoría chatbot:
  - Para MVP basta trazabilidad operativa vía notificación de cambios.
  - Auditoría técnica extendida se puede dejar para fase posterior si se detecta necesidad.

## 22. Artefactos derivados generados

Tras cerrar preguntas funcionales, se generaron estos documentos de trabajo:
- `requisitos-mvp-reguerta-v1.md`
- `historias-usuario-mvp-reguerta-v1.md`
- `firestore-estructura-mvp-propuesta-v1.md`
- `reconciliacion-features-implementadas-v1.md`

## 23. Regla adicional confirmada: alta de nuevo socio y autorizacion de acceso

Fecha de consolidacion: 2026-03-07 (zona horaria Europa/Madrid).

- Cuando entra un socio nuevo:
  - Se le facilita acceso a app iOS o Android segun su dispositivo.
  - Un admin debe darlo de alta/preautorizarlo en la lista de `users`.
- En primer uso, el socio puede registrarse o loguearse con Firebase Auth.
- Si el email usado en auth no esta en la lista de socios preautorizados:
  - La app muestra alerta `Usuario no autorizado`.
  - El usuario queda dentro de la app en modo restringido con funcionalidades operativas deshabilitadas.
  - El estado se mantiene hasta que un admin lo de de alta en `users`.
- Si el proceso esta bien hecho (email preautorizado por admin):
  - En el primer login/registro entra directamente a la pantalla principal.

## 24. Implicaciones directas para requisitos (Regla adicional)

- Debe existir validacion de autorizacion de acceso por email preautorizado en `users`.
- El flujo de onboarding debe contemplar:
  - prealta admin en `users`,
  - primer login/registro del socio,
  - enlace de identidad auth a la ficha de socio.
- Debe modelarse explicitamente el comportamiento de usuario autenticado no autorizado:
  - alerta visible,
  - app en modo restringido sin operativa de negocio.
- El modelo de notificaciones debe considerar dispositivos por socio y mantener coherencia de `lastDeviceId`.

## 25. Resoluciones de reconciliacion aceptadas (todas opcion A)

Fecha de consolidacion: 2026-03-07 (zona horaria Europa/Madrid).

- Se formaliza control remoto de version en arranque (actualizacion forzada y opcional).
- `Mi pedido` queda supeditado a validacion de frescura de datos criticos (con timeout/reintento).
- Refresco de sesion/token en arranque y foreground con UX explicita de sesion expirada.
- Se acepta en MVP el toggle masivo de disponibilidad de productos del productor.
- Se acepta en MVP pipeline de imagen de producto (seleccion/recorte/subida/persistencia URL).
- Se formalizan entornos runtime `local`, `develop`, `production`.
- La sincronizacion selectiva por timestamps se considera requisito formal de orquestacion.
