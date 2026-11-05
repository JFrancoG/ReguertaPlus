# ADR-0020: Inicializar coberturas desde fuentes canónicas revisadas

## Estado

Aceptado para la preparación autorizada el 2026-10-27. El mantenedor confirma
expresamente cero compensaciones iniciales pendientes y que no constan reservas
previas activas. La aplicación compartida y la activación mantienen sus gates.

## Contexto

Las cuentas y socios ya existen en `users` de Firestore de cada entorno.
Coberturas necesita además observaciones privadas de pertenencia, evidencia de
reservas y generaciones del registro de compensaciones. La conciliación ordinaria
puede crear reservas, abrir casos futuros y cancelar compensaciones tras una baja
permanente explícita. Ejecutarla para todos cambiaría negocio al inicializar.
Una colección vacía tampoco demuestra que no existan derechos previos.

## Decisión

- Usar usuarios canónicos, agregados de rotación e historial público de propietarios
  ordinarios del mismo entorno. Los enlaces Auth autorizan al operador; tener una
  cuenta de acceso no determina la pertenencia o participación en la rotación.
  Conservar cuentas, flags de usuarios, colas y asignaciones publicadas.
- Vincular una captura completa acotada y versiones de documentos a una decisión
  administrativa explícita: entorno, ID de operación, instante de observación
  inicial, referencia de confirmación, cero compensaciones y ausencia de reservas
  previas. Generar un plan determinista con creaciones y bloqueos concretos.
- Crear observaciones de partida para los socios elegibles de las cohortes,
  sin darles una fecha nueva de entrada en reserva. Conservar registros privados
  válidos e historial de compensaciones consumidas o canceladas. Inicializar una
  generación ausente a cero sólo si es coherente con su historial completo. No
  inventar casos completados, fechas FIFO, fronteras de reserva o bajas permanentes
  a partir de la inactividad actual.
- Reservas activas contradictorias, compensaciones o claims pendientes, cohortes
  sin conciliar, historial inválido y trabajo en curso bloquean el plan completo.
  No sobrescribir ni borrar registros existentes. Mantener separados propietario
  publicado y participante efectivo; una sustitución o permuta anterior no prueba
  un derecho pendiente.
- Aplicar mediante un adaptador backend inyectado bajo la barrera existente de
  entrada cerrada, con administrador actual enlazado recíprocamente y digest
  esperado exacto. Recapturar conjuntos completos en la misma transacción que
  las creaciones, respetar el presupuesto y crear un recibo inmutable más su
  puntero fijo. Cambios de fuente, documentos nuevos e inicializaciones
  concurrentes no pueden producir una inicialización parcial.
- El reintento exacto devuelve el recibo original sin reiniciar cambios posteriores
  de pertenencia o contabilidad. Si se pierde la confirmación final de la barrera,
  conservar el incidente duradero existente y no declarar finalización limpia.
  El flag Firestore de mantenimiento no demuestra agotamiento de escritores externos.
- Exigir también el recibo/puntero inicial verificado al admitir el backend normal
  e incluirlo en su digest de disponibilidad capturada. Esto no activa
  `operationalReady` ni cambia el contrato de las apps.
- La primera herramienta de terminal prepara una revisión desde JSON local.
  No crea clientes SDK, no tiene modo de aplicación y no selecciona proyecto
  cloud implícitamente. Probar el adaptador de aplicación con SDK/Rules demo fijo.

## Consecuencias

La migración inicial es una inicialización trazable del estado privado de turnos,
no una importación de cuentas ni otro planificador. La confirmación de saldos cero
evita introducir un modelo de compensaciones manuales históricas en este alcance.
Una contradicción exige revisar registros concretos antes de aplicar otro plan.

La prueba local acredita orden transaccional, conservación del historial y
rechazos. Capturar datos compartidos, admitir operador/plano de control, aplicar
un lote acotado y comprobarlo requieren su handoff concreto autorizado. Entropía
real, ratificación y despliegue siguen siendo requisitos para habilitar coberturas.

## Trabajo relacionado

- [ADR-0015](0015-registrar-ciclo-explicito-de-pertenencia-en-coberturas.md)
- [ADR-0018](0018-vincular-coberturas-nativas-a-la-disponibilidad-del-backend-autenticado.md)
- [ADR-0019](0019-coordinar-proyecciones-y-notificaciones-de-coberturas.md)
- [Plan HU-084](../../spec/shifts/hu-084-stable-shift-coverage-and-credits/plan.md)
