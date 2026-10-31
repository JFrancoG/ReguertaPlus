# ADR-0021: Usar mantenimiento acordado con el propietario en hojas de turnos

## Estado

Aceptado como política el 2026-10-28 tras elegir expresamente el mantenedor
«Mantenimiento acordado con el propietario». La implementación, el ensayo del
procedimiento revisado en copia, la disponibilidad operativa y la autorización
de cada fase real mantienen sus condiciones separadas. Esta decisión no autoriza
escrituras compartidas, permisos ni despliegues.

## Contexto

El mantenedor cree que las hojas usan cuentas personales, pero no está totalmente
seguro; no se ha verificado la ausencia de Workspace. El ensayo aceptado en copia
demostró que el bloqueo global de contenido de Drive impide escribir tanto al
propietario como al backend, y que el propietario puede retirarlo. Proteger rangos
no permite quitar sus permisos. Desbloquear no establece un escritor único físico.

ADR-0013 y HU-085 exigían excluir técnicamente todas las vías del propietario.
Para este alcance, el mantenedor acepta una ventana acotada de cooperación.
Solo se modifica esa exclusión absoluta; siguen siendo obligatorios los demás
controles de escritores, eventos, efectos, seguridad y notificaciones.

## Decisión

- Conservar el ID/enlace del archivo, las fechas y el orden de las asignaciones
  publicadas. Firestore sigue siendo la autoridad de la app. Durante el mantenimiento,
  el backend revisado es el único escritor automático autorizado; las propuestas
  manuales pasan por sus comandos y conciliación gobernados, no por una importación automática libre.
- Antes de las operaciones candidatas no hay escritores activos autorizados de
  los datos de origen. El propietario identificado conserva su capacidad técnica,
  pero ejercerla queda fuera del acuerdo. Durante la fase candidata solo pueden
  escribir los comandos backend exactos revisados. Ninguna fase afirma cero
  escritores físicos ni una autoridad física de escritor único.
- Vincular el acuerdo a propietario identificado, entorno, archivo, ámbito,
  operaciones y plazo, con revisión/digest de origen y confirmación registrada.
  El propietario confirma que la hoja está en línea, cerrada y sin cambios
  pendientes sin conexión, y acuerda no editar, desbloquear, cambiar permisos ni
  iniciar actividad mediante OAuth, scripts u otras automatizaciones propias
  durante la ventana. Solo se exceptúa una acción sellada de permisos/protección
  autorizada por separado si también es el controlador de permisos identificado:
  no permite editar contenido ni otra automatización, y su flujo/credenciales
  temporales se cierran inmediatamente después.
- Inventariar y cerrar las vías de los demás editores, automatizaciones,
  credenciales y autoridades privilegiadas del plano de control. Esto incluye el
  uso automatizado de credenciales del propietario: la excepción solo cubre su
  capacidad humana identificada. Conciliar las peticiones enviadas antes del
  cierre, que pueden terminar después. Escritores desconocidos o sin controlar
  y efectos sin resolver impiden avanzar.
- Acotar la ventana y su resultado de recuperación/reanudación. El vencimiento o
  un cambio de propietario, participantes, pertenencia o autoridad efectiva
  invalida el acuerdo. Detener el avance automático; obtener otra confirmación
  del propietario y lecturas actuales antes de continuar con la autorización de
  fase correspondiente. Vencer no demuestra que una petición se haya cancelado
  ni terminado.
- Comparar revisión/contenido registrados antes y después de cada lote. No es
  CAS de Sheets: detecta algunos cambios, no evita carreras entre lectura y
  escritura y puede omitir ediciones transitorias. Los cambios observados o las
  escrituras inciertas detienen el avance, los reintentos y la reversión ciega
  automáticos. Conservar pruebas y conciliar el resultado concreto con operador
  y propietario antes de admitir por separado la continuación o recuperación.
- Mantener los controles fuertes de entrega duradera, trabajo anterior/concurrente
  de Admin SDK, consecuencias causales, envíos externos y posible entrega de
  avisos. Las reglas de cliente o un registro nuevo no explican las escrituras
  privilegiadas anteriores. Se conservan admisión por época/revisión, copias,
  recuperación y liberación de avisos; la época de seguridad nunca retrocede.
- El adaptador de barrera existente sigue aceptando solo su prueba estricta.
  No marcar la capacidad residual del propietario como técnicamente cerrada,
  introducir un booleano de evasión ni usar un paquete de ensayo local como
  prueba operativa. La implementación y el contrato de evidencias revisados,
  junto con el ensayo en copia, deben representar esta política expresamente
  antes de admitir una operación real. Este ADR por sí solo no cambia `canApply`
  ni `operationalReady`.

## Consecuencias

Se pueden conservar el archivo y el plan publicado sin exigir contratar
Workspace, crear otro proyecto Firebase ni transferir la propiedad. Se acepta
depender de la cooperación del propietario identificado, con el riesgo residual
de ediciones concurrentes o transitorias no detectadas. Transferir a otro
propietario personal solo traslada esa capacidad; no se presupone que una cuenta
de servicio sea una solución de propiedad.

Aceptar esta política no equivale a aceptar un relevo terminado. Faltan la
implementación, las pruebas acotadas, las evidencias actuales del proveedor y las
autorizaciones separadas de aplicación/recuperación. La excepción no se extiende
a otros escritores ni sustituye el control técnico de operaciones anteriores y
efectos inciertos.

## Trabajo relacionado

- [ADR-0013](0013-modelar-turnos-como-rotaciones-continuas-con-proyecciones-estacionales.md): aquí solo se modifica su condición de exclusión absoluta del propietario.
- [HU-085](../../spec/shifts/hu-085-production-shift-workbook-activation/spec.md)
- [Ensayo de relevo HU-084](../testing/hu084-relevo-backend.md)
- Google: [protección de rangos](https://support.google.com/docs/answer/1218656?hl=es), [restricciones de contenido](https://developers.google.com/workspace/drive/api/guides/content-restrictions) y [transferencia de propiedad](https://developers.google.com/workspace/drive/api/guides/transfer-file).
