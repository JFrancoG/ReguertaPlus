# HU-084 — propuesta para ratificación

Estado: **borrador para debatir; ninguna regla de esta propuesta se considera ratificada**.
Preparado el 2026-10-04. [English](ratification.md).

El mantenedor confirma que no existe acuerdo previo ni aprobación formal. Ha
habido conversaciones informales con el presidente y algunos miembros, con buena
acogida entre las personas consultadas. Esto no equivale a una aprobación de toda
la cooperativa. Texto para compartir: [propuesta para socios](propuesta-turnos-para-socios.md).

La [PR #278](https://github.com/JFrancoG/ReguertaPlus/pull/278) contiene una
implementación provisional validada. Aprobar técnicamente esa PR no sustituye el
acuerdo de asamblea ni completa la integración real de coberturas.

## Base que conviene conservar

Los turnos publicados de las demás personas no cambian. Se distingue quién tenía
el turno en la rotación de quién lo realiza finalmente. El mercado conserva tres
personas distintas y el reparto respeta sus responsables y ayudantes. Los hechos
de turnos ya completados no se reescriben. Una cobertura exige aceptación expresa.
Estas garantías de integridad no son opciones para simplificar el desarrollo.

## Texto propuesto y decisiones

Cada fila requiere aceptación o una enmienda explícita. Son recomendaciones para
la discusión, no valores que deban activarse ahora en la aplicación.

| ID | Tema | Propuesta para debatir |
| --- | --- | --- |
| D01 | Altas y reincorporaciones | Incorporar al final de la primera ronda nueva aún no congelada, sin saltar rondas publicadas. Ordenar por fecha efectiva de elegibilidad y, en empate exacto, identificador estable. No recuperar un puesto antiguo. |
| D02 | Baja definitiva | Cubrir individualmente los turnos ya publicados. En una ronda congelada, omitir el puesto todavía no publicado sin adjudicar un turno ficticio ni otorgar crédito. La omisión sólo se confirma junto con un reparto o mercado completo y válido. |
| D03 | Pérdida de elegibilidad | La conversión en productor real o la desactivación excluye de nuevas asignaciones. Aplicar cobertura a lo publicado y omisión registrada a lo no publicado de una ronda congelada. Una ausencia temporal de una persona que sigue siendo elegible sólo afecta a su turno. La vuelta a ser elegible sigue D01. |
| D04 | Reserva voluntaria | Mantener una reserva por tipo de turno, con ofertas por orden de entrada y desempate por identificador. Aceptar es voluntario. |
| D05 | Continuidad de reserva | No reiniciarla en agosto. Rechazar o dejar vencer una oferta descarta sólo ese caso, sin penalizar ni cambiar el orden para futuros casos. Aceptar conserva la entrada, pero bloquea nuevas coberturas del mismo tipo según D13. |
| D06 | Salida de reserva | El mantenedor confirma la salida al llegar la fecha del primer turno ordinario del mismo tipo, aunque lo cubra otra persona, o antes si se pierde elegibilidad. Publicar una temporada no adelanta la salida. Pendiente reconciliar implementación y pruebas. |
| D07 | Plazos | Confirmado para la propuesta: con al menos 14 días, reserva/voluntarios/sorteo/responsables 2/7/2/3 días; desde 5 hasta menos de 14 días, 1/2/1/1. Máximos por fase completa, días de 24 horas, sin reinicio por candidato y cierre al aceptar una persona válida. Con menos de 5 días, gestión exclusiva e inmediata por responsables, sin iniciar fases de reserva/voluntarios/sorteo. La aceptación expresa sigue siendo obligatoria. |
| D08 | Varios voluntarios | El mantenedor elige a quien se haya ofrecido primero. Se mantiene como propuesta el desempate exacto por identificador estable. Pendiente aprobación colectiva del conjunto. |
| D09 | Sorteo | Tras reservas y voluntariado, fijar participantes antes de conocer una fuente pública futura de aleatoriedad. Conservar un único orden verificable y recorrerlo sin repetir el sorteo por rechazos o cancelaciones. La persona seleccionada debe aceptar. El proveedor concreto y su indisponibilidad requieren una decisión técnica posterior. |
| D10 | Nadie acepta | Un administrador registra la resolución y ofrece el turno a una persona elegible, que también debe aceptar. Si nadie lo cubre, dejar la incidencia abierta y visible; no registrar cobertura o cumplimiento ficticios. |
| D11 | Compensación | Una cobertura completada y confirmada concede un crédito para omitir una futura participación del mismo tipo. No concede crédito ofrecerse o aceptar. Nunca se elimina por crédito un turno ya publicado. |
| D12 | Caducidad y bajas | El mantenedor propone que las compensaciones no caduquen salvo baja permanente, que cancela el saldo pendiente sin borrar el historial. Una vuelta posterior no recupera ese saldo. La suspensión temporal conserva el saldo. Pendiente ratificación e implementación de las diferencias. |
| D13 | Acumulación y proximidad | Confirmado: bloquear una segunda cobertura del mismo tipo mientras haya una aceptada sin terminar o un crédito pendiente; fallo sin crédito libera el bloqueo. Mantener ayuda en el reparto anterior y responsabilidad en el siguiente; nunca ambos papeles en el mismo reparto, también al sortear. Mínimo de 10 semanas entre turnos ordinarios como responsable de reparto de la misma persona en vueltas distintas; no computar ayudantes ni aplicar al mercado. Sustituciones por reserva, voluntariado, sorteo o responsables exentas. Por fuerza mayor, como evitar un turno vacío, los responsables pueden autorizar una excepción al mínimo dejando constancia del motivo. No se relajan las incompatibilidades de papeles ni se mueven fechas publicadas. |
| D14 | Crédito que deja el turno incompleto | Aplazar los créditos necesarios en orden inverso al recorrido de la cola hasta poder cubrir la unidad completa. La persona trabaja su turno ordinario y conserva el crédito para otra ronda elegible. Evita crear una cadena de reemplazos que genere más créditos. Si sigue siendo imposible cubrir la unidad, bloquear la activación y escalar a administración. |
| D15 | Permisos y confirmación | El socio comunica su ausencia; administración puede gestionarla. Quien la abre puede cancelarla antes de que se acepte, y administración también. Después de una aceptación, la incidencia exige resolución administrativa. Sólo administración confirma la realización efectiva y el crédito, sin anticiparla al turno. |

## Lo primero que hay que resolver

1. Presentar el texto a los socios: se ha confirmado que no existe acuerdo previo.
   Registrar después la fecha y el contenido de lo que realmente se apruebe.
2. Incorporar las decisiones ya confirmadas por el mantenedor (D06, D07 y D13)
   al texto que se presenta, sin volver a tratarlas como dudas pendientes.
3. Ratificar o enmendar el resto como un paquete, dejando constancia de cada cambio.

No es necesario elegir un proveedor de aleatoriedad ni detalles de Firebase en
esta primera conversación. Sí debe aprobarse qué garantías exige el sorteo.

## Registro del acuerdo y trabajo posterior

Fecha y referencia del acta: **pendientes**. Texto aprobado/enmiendas por ID:
**pendientes**. Confirmación del mantenedor del alcance reconciliado: **pendiente**.

Tras el acuerdo: actualizar requisitos EN/ES y esta especificación, contrastar
cada regla con código y pruebas, implementar las diferencias y completar proveedor,
observabilidad, integración real y recuperación. Después preparar la activación y
su reversión con autorización propia. HU-085 no absorbe automáticamente esos trabajos.

Fuentes: [decisiones pendientes](spec.md#assembly-decisions-required),
[tareas](tasks.md#0-live-activation-decision-gate) y [evidencia](review.md).
