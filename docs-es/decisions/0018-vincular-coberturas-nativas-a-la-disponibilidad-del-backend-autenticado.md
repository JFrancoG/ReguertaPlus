# ADR-0018: Vincular coberturas nativas a la disponibilidad del backend autenticado

## Estado

Aceptado para la implementación de la composición de HU-084 autorizada por el
mantenedor el 27/10/2026. La ratificación colectiva, la preparación operativa y
la activación compartida siguen siendo requisitos independientes.

## Contexto

La máquina de estados y los formularios de coberturas se han probado en un
proyecto de ensayo fijo. Las apps normales ya tienen clientes HTTP autenticados
de Firebase y sesiones con cuenta, socio y entorno canónicos. Cambiar solamente
la URL del ensayo perdería esas garantías y podría elegir otro entorno o dejar
continuar una petición después de cambiar de cuenta. Habilitar coberturas exige
también coordinarse con los escritores de planificación, Sheets y notificaciones.

## Decisión

- Reutilizar una implementación transaccional de coberturas que recibe Firestore
  y el entorno desde la composición de confianza del servidor. El envoltorio de
  ensayo conserva su cliente SDK, proyecto y puertos aislados. Los actores
  indicados directamente por ID de socio quedan restringidos a ese envoltorio
  local registrado; las peticiones compartidas usan identidades Auth verificadas.
- Exponer una petición exacta `resolveShiftCoverageAccess` y el contrato existente
  de acciones mediante HTTP autenticado. Rechazar el transporte mal formado antes
  de Auth. Reutilizar los clientes Admin, la verificación de tokens revocados,
  vínculos actuales, roles, autoridad de escritura y errores canónicos. No aceptar
  un actor indicado por el cliente ni cambiar silenciosamente el entorno después
  de autenticar la petición.
- Guardar la disponibilidad privada en el campo opcional
  `shiftPlanningState/sourcePolicy.coverage`. Sus campos exactos son `enabled`,
  `environment`, `policyRevision`, `ratificationReference` y
  `maximumOfferWindowMillis`. Una política ausente, incorrecta, deshabilitada, de
  otro entorno o no soportada no concede acceso. El límite de respuesta sigue
  siendo explícito; esta conexión no inventa un plazo de negocio por defecto.
  Evitar `config/global`, cuya operación de clonación existente copia el documento
  de develop a producción.
- Resolver el acceso antes de mostrar la navegación normal. Una respuesta positiva
  no autoriza órdenes futuras: cada transacción del servidor, incluida la
  repetición de un recibo, comprueba otra vez disponibilidad e identidad actuales.
  Vincular la política inicial con la transacción para que un cambio de plazo o
  revisión no permita reutilizar datos anteriores.
- Vincular las operaciones nativas a UID, socio canónico, entorno y generación de
  sesión; rechazar la suplantación de otro socio. Los roles y la responsabilidad
  de compras observados deben invalidar ese ámbito aunque un refresco antiguo de
  metadata conserve la generación global. iOS ya avanza su revisión central ante
  esos cambios de valor; Android incluye una copia tipada en la sesión de
  coberturas. Comprobar después de obtener el
  token e inmediatamente antes del transporte y descartar respuestas antiguas.
  Capturar entorno y revisión esperada en el formulario para conservar la intención
  original al reintentar. Compartir formularios y operaciones de presentación con
  los envoltorios de ensayo; las rutas normales no muestran sus credenciales ni
  abren otra sesión Auth.
- Mantener la composición exportada cerrada operativamente en el código. Un
  documento de política no puede activarla mientras falten el dueño de efectos
  frente a los eventos ordinarios, los leases del archivo de HU-083, el inventario
  de escritores, la entropía real y la migración autorizada de compensaciones y
  pertenencia. No retirar las barreras provisionales del planificador o de
  publicación para aparentar que esa preparación está terminada.

## Consecuencias

Ambas apps pueden usar el transporte autenticado real y el ámbito de su cuenta
sin duplicar las reglas de coberturas ni crear otro planificador. La misma
implementación del servidor puede probarse en ambos espacios de entorno mediante
clientes SDK locales reales de Auth y Firestore. Esas pruebas no acreditan un
despliegue ni preparación operativa compartida. Si falta el endpoint o el acceso
está deshabilitado, la función permanece indisponible; el resto de la app conserva
su funcionamiento.

Preparar la conexión no necesita cambiar configuración compartida, datos de
producción, desplegar ni enviar notificaciones. Antes del uso compartido siguen
siendo necesarios los requisitos operativos, la ratificación y la autorización de
un despliegue acotado.

## Trabajo relacionado

- [ADR-0008](0008-acotar-operaciones-moviles-de-sesion.md)
- [ADR-0013](0013-modelar-turnos-como-rotaciones-continuas-con-proyecciones-estacionales.md)
- [ADR-0015](0015-registrar-ciclo-explicito-de-pertenencia-en-coberturas.md)
- [Plan de HU-084](../../spec/shifts/hu-084-stable-shift-coverage-and-credits/plan.md)
- [Issue HU-084](https://github.com/JFrancoG/ReguertaPlus/issues/268)
