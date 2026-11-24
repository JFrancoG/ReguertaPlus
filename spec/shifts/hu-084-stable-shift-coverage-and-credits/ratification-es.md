# HU-084 — acuerdo de asamblea sobre las sustituciones

**Escrito para socios aprobado el 18 de noviembre de 2026**, según comunicó el
mantenedor. [English](ratification.md).

El [escrito aprobado por los socios](propuesta-turnos-para-socios.md) es la
referencia para las reglas de sustitución. La [PR #278](https://github.com/JFrancoG/ReguertaPlus/pull/278)
contiene la implementación provisional que se contrastará con el acuerdo.

## Base que conviene conservar

Los turnos publicados de las demás personas no cambian. Se distingue quién tenía
el turno en la rotación de quién lo realiza finalmente. El mercado conserva tres
personas distintas y el reparto respeta sus responsables y ayudantes. Los hechos
de turnos ya completados no se reescriben. Una cobertura exige aceptación expresa.
Estas garantías de integridad no son opciones para simplificar el desarrollo.

## Correspondencia técnica D01–D15

La asamblea aprobó el escrito para socios como conjunto. Esta matriz relaciona
sus reglas con las decisiones de diseño. La conciliación técnica al final de la matriz recoge el estado de las omisiones en rondas congeladas (D02/D03), el desempate por identificador (D01/D04/D08) y la fuente pública del sorteo (D09).

| ID | Tema | Regla y correspondencia técnica |
| --- | --- | --- |
| D01 | Altas y reincorporaciones | Incorporar al final de la primera ronda nueva aún no congelada, sin saltar rondas publicadas. Ordenar por fecha efectiva de elegibilidad y, en empate exacto, identificador estable. No recuperar un puesto antiguo. |
| D02 | Baja definitiva | Cubrir individualmente los turnos ya publicados. En una ronda congelada, omitir el puesto todavía no publicado sin adjudicar un turno ficticio ni otorgar crédito. La omisión sólo se confirma junto con un reparto o mercado completo y válido. |
| D03 | Pérdida de elegibilidad | La conversión en productor real o la desactivación excluye de nuevas asignaciones. Aplicar cobertura a lo publicado y omisión registrada a lo no publicado de una ronda congelada. Una ausencia temporal de una persona que sigue siendo elegible sólo afecta a su turno. La vuelta a ser elegible sigue D01. |
| D04 | Reserva voluntaria | Mantener una reserva por tipo de turno, con ofertas por orden de entrada y desempate por identificador. Aceptar es voluntario. |
| D05 | Continuidad de reserva | No reiniciarla en agosto. Rechazar o dejar vencer una oferta descarta sólo ese caso, sin penalizar ni cambiar el orden para futuros casos. Aceptar conserva la entrada, pero bloquea nuevas coberturas del mismo tipo según D13. |
| D06 | Salida de reserva | La salida se produce al llegar la fecha del primer turno ordinario del mismo tipo, aunque lo cubra otra persona, o antes si se pierde elegibilidad. Publicar una temporada no adelanta la salida. Implementado y validado localmente en HU-089 usando el propietario original y el límite de entrada en la reserva. Pendiente de integración compartida de HU-084. |
| D07 | Plazos | Con al menos 14 días, reserva/voluntarios/sorteo/responsables 2/7/2/3 días; desde 5 hasta menos de 14 días, 1/2/1/1. Reserva, voluntariado y sorteo tienen máximos por fase completa; los 3/1 días administrativos son objetivos de gestión. Administración puede resolver un turno futuro tras el objetivo original, registrando el retraso sin reiniciarlo ni volver a las fases de búsqueda. Cada oferta conserva un vencimiento dentro del máximo configurado para responder y estrictamente anterior al turno; la aceptación expresa dentro de plazo sigue siendo obligatoria. Días de 24 horas, sin reinicio por candidato y cierre al aceptar una persona válida. Con menos de 5 días, gestión exclusiva e inmediata por responsables, sin iniciar fases de reserva/voluntarios/sorteo. Véase [ADR-0017](../../../docs-es/decisions/0017-mantener-resolucion-administrativa-tras-su-plazo-objetivo.md). |
| D08 | Varios voluntarios | Tiene prioridad quien se haya ofrecido primero. Para empates exactos se aplica un orden fijo y registrado. La propuesta técnica utiliza el identificador estable. |
| D09 | Sorteo | Tras reservas y voluntariado, fijar participantes antes de conocer una fuente pública futura de aleatoriedad. Conservar un único orden verificable y recorrerlo sin repetir el sorteo por rechazos o cancelaciones. La persona seleccionada debe aceptar. El acuerdo delega la elección del proveedor y la gestión de fallos en la integración técnica. |
| D10 | Nadie acepta | Un administrador registra la resolución y ofrece el turno a una persona elegible, que también debe aceptar. Si nadie lo cubre, dejar la incidencia abierta y visible; no registrar cobertura o cumplimiento ficticios. |
| D11 | Compensación | Una cobertura completada y confirmada concede un crédito para omitir una futura participación del mismo tipo. No concede crédito ofrecerse o aceptar. Nunca se elimina por crédito un turno ya publicado. |
| D12 | Caducidad y bajas | Las compensaciones no caducan salvo baja permanente explícita, que cancela el saldo pendiente sin borrar el historial. Una vuelta posterior no recupera ese saldo. La suspensión temporal conserva el saldo. Implementado y validado localmente en HU-089 con declaración administrativa y recibos conservados. Pendiente de integración compartida de HU-084. |
| D13 | Acumulación y proximidad | Bloquear una segunda cobertura del mismo tipo mientras haya una aceptada sin terminar o un crédito pendiente; fallo sin crédito libera el bloqueo. Mantener ayuda en el reparto anterior y responsabilidad en el siguiente; nunca ambos papeles en el mismo reparto, también al sortear. Mínimo de 10 semanas entre turnos ordinarios como responsable de reparto de la misma persona en vueltas distintas; no computar ayudantes ni aplicar al mercado. Sustituciones por reserva, voluntariado, sorteo o responsables exentas. Por fuerza mayor, como evitar un turno vacío, los responsables pueden autorizar una excepción al mínimo dejando constancia del motivo. No se relajan las incompatibilidades de papeles ni se mueven fechas publicadas. |
| D14 | Crédito que deja el turno incompleto | Aplazar los créditos necesarios en orden inverso al recorrido de la cola hasta poder cubrir la unidad completa. La persona trabaja su turno ordinario y conserva el crédito para otra ronda elegible. Evita crear una cadena de reemplazos que genere más créditos. Si sigue siendo imposible cubrir la unidad, bloquear la activación y escalar a administración. |
| D15 | Permisos y confirmación | El socio comunica su ausencia; administración puede gestionarla. Quien la abre puede cancelarla antes de que se acepte, y administración también. Después de una aceptación, la incidencia exige resolución administrativa. Sólo administración confirma la realización efectiva y el crédito, sin anticiparla al turno. |

## Registro del acuerdo y trabajo posterior

El [acuerdo comunicado del 18 de noviembre de 2026](propuesta-turnos-para-socios.md#acuerdo-de-la-asamblea)
aprueba el escrito. En la asamblea también se indicó que, tras un tiempo de uso
y varios casos, se podrán ampliar o acortar sus plazos o hacer otros ajustes
mediante actualizaciones de la app si todos los socios están de acuerdo. Se
mantienen los plazos aprobados para la puesta en marcha. La referencia al acta y
la fecha de entrada en vigor quedan pendientes.

La conciliación técnica que sigue identifica las diferencias pendientes.
La activación de coberturas y su reversión requieren autorización propia.

Véanse la [especificación](spec.md#assembly-decision-and-technical-reconciliation),
las [tareas](tasks.md#0-live-activation-decision-gate) y la [evidencia](review.md).

## Conciliación técnica del 20 de noviembre de 2026

Revisión de código y pruebas versionadas en la candidata `24dd092c`. La columna de evidencia identifica qué comportamiento cubren los casos locales existentes. La aceptación con cuentas normales en Develop sigue pendiente.

| Decisión | Evidencia local y diferencia pendiente |
| --- | --- |
| D01 | La revisión de la candidata del día 20 identificó que la ronda usaba la hora de conciliación. La corrección local del 21 ordena altas y retornos por el instante efectivo conservado por Firestore. Si coincide, decide el identificador estable. La primera ronda nueva respeta lo ya congelado. Las ofertas siguen el orden de entrada en reserva. [Evidencia de la corrección](review.md#d01-effective-eligibility-on-21-november-2026) · [Contrato del escritor](../../../docs-es/decisions/0015-registrar-ciclo-explicito-de-pertenencia-en-coberturas.md#fecha-efectiva-de-elegibilidad-para-d01--21-de-noviembre-de-2026) |
| D02–D03 | La baja o pérdida de elegibilidad abre un caso por turno publicado afectado. En rondas congeladas la omisión conserva titular y motivo, y se confirma junto con la unidad completa. El socio que sigue siendo elegible puede abrir una ausencia puntual. Queda documentado cómo el registro interno de omisión se corresponde con el resultado aprobado. [Bajas, productores y reincorporación](../../../functions/test/shift-coverage.emulator.test.cjs#L709) · [Publicación e inversa](../../../functions/test/shift-credit-publication.test.cjs#L494) · [Ausencia puntual](../../../functions/src/shift-coverage-store.ts#L451) |
| D04–D05, D08 | Hay una reserva por tipo, sin reinicio en agosto. Los rechazos y vencimientos se guardan en el caso. La reserva se ordena por entrada y el voluntariado por hora de recepción, ambos con desempate por identificador. La oferta requiere respuesta expresa. [Selección](../../../functions/src/shift-coverage-selection.ts#L186) · [Rechazo y vencimiento](../../../functions/test/shift-coverage.emulator.test.cjs#L230) · [Empates](../../../functions/test/shift-coverage.emulator.test.cjs#L272) · [Continuidad en agosto](../../../functions/test/shift-coverage.emulator.test.cjs#L690) |
| D06, D12 | La reserva termina al llegar el turno ordinario del titular original para ese tipo. La suspensión conserva el crédito y la baja permanente explícita anula sólo el saldo pendiente, conservando su historial incluso si la persona regresa. [Salida por turno ordinario](../../../functions/test/shift-membership-lifecycle.emulator.test.cjs#L114) · [Suspensión y baja](../../../functions/test/shift-membership-lifecycle.emulator.test.cjs#L182) |
| D07, D10 | Las pruebas cubren los umbrales de 14 y 5 días, los máximos por fase y la vía administrativa exclusiva bajo 5 días. Al agotarse los candidatos, el caso queda visible a administración. Una oferta administrativa requiere aceptación y conserva el motivo y, si procede, el retraso respecto al plazo original. [Plazos](../../../functions/test/shift-coverage-deadlines.test.cjs#L18) · [Caso sin candidatos](../../../functions/test/shift-coverage.emulator.test.cjs#L473) · [Vista autorizada](../../../functions/src/shift-coverage-client.ts#L81) · [Recibo de resolución](../../../functions/src/shift-coverage-store.ts#L755) |
| D09 | La candidata usa drand Quicknet. Firestore debe registrar los participantes y la ronda antes de que se publique el valor. Un fallo avisa a administración y conserva la ronda. Un compromiso tardío requiere resolución administrativa. Cancelar y reabrir conserva el sorteo original. [Decisión técnica](../../../docs-es/decisions/0029-usar-drand-quicknet-para-sortear-coberturas.md) · [Evidencia](review.md#d09-public-draw-on-21-november-2026) |
| D11, D13 | Completar una cobertura concede un crédito del mismo tipo. Mientras hay aceptación o crédito pendiente se bloquea otra del mismo tipo. Las pruebas conservan titulares, relevos y fechas, aplican las diez semanas a responsables ordinarios de distintas vueltas y limitan la excepción por fuerza mayor. [Crédito y relevo](../../../functions/test/shift-coverage.emulator.test.cjs#L75) · [Acumulación](../../../functions/test/shift-coverage.emulator.test.cjs#L150) · [Diez semanas](../../../functions/test/shift-delivery-spacing.test.cjs#L46) · [Límite de las excepciones](../../../functions/test/shift-delivery-spacing.test.cjs#L146) |
| D14 | El plan aplaza créditos en orden inverso, conserva el saldo y bloquea una unidad imposible de completar. Falta demostrar que el rechazo llega al responsable en la operación compartida y que el plan con créditos puede publicarse allí. [Aplazamiento y rechazo](../../../functions/test/shift-credit-unit.test.cjs#L25) · [Publicación e inversa en emulador](../../../functions/test/shift-credit-publication.test.cjs#L177) |
| D15 | El socio sólo puede abrir su propia ausencia. Quien la abrió o administración pueden cancelarla antes de aceptar. Tras la aceptación, sólo administración puede registrar fallo o realización, y se rechaza una confirmación anterior al turno. [Permisos](../../../functions/src/shift-coverage-store.ts#L142) · [Apertura](../../../functions/src/shift-coverage-store.ts#L451) · [Cancelación y confirmación](../../../functions/src/shift-coverage-store.ts#L619) · [Rechazo sin escritura](../../../functions/test/shift-coverage.emulator.test.cjs#L177) |

El planificador del entorno ya integra los créditos y el espaciado de los repartos. [Implementación y reintentos comprobados en local](review.md#credit-publication-and-delivery-spacing-on-21-november-2026).

Para aceptar HU-084 en Develop quedan la integración en el entorno compartido de D01 y D09, ya verificadas localmente, la publicación de créditos y espaciado fuera del emulador y la verificación de los controles de escritura de los procesos que actualizan Sheets y entregan avisos. [Cierre y recuperación en local](review.md#completed-coverage-delivery-on-21-november-2026). Operación debe poder detectar casos atascados, agotamiento, reintentos y fallos de crédito. El backend mantiene cerrado el acceso normal. Con esas condiciones verificadas, los dos recorridos compartidos son mercado y reparto. El aviso de sesión se verifica en el recorrido afectado. Las cuatro comprobaciones del calendario base corresponden a la activación de HU-085. [Acceso](../../../functions/src/index.ts#L3203) · [Límite del planificador](../../../functions/src/shift-credit-publication.ts#L81) · [Observabilidad](review.md#acceptance-matrix) · [Hoja de ruta](../../../docs-es/requirements/estado-y-hoja-de-ruta-turnos-2026-11-12.md#los-seis-escenarios-de-aceptación-funcional)
