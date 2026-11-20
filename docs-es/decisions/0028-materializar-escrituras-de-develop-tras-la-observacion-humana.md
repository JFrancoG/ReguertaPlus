# ADR-0028 · Materializar la transacción de avance de Develop tras la última observación previa a la escritura

## Estado

Adoptada para ensayo local el 20 de noviembre de 2026. Se aplica a la migración de avance del libro original de Develop bajo la [ADR-0027](0027-recoger-observaciones-coherentes-de-develop-antes-del-token-escritor.md). Cada ejecución compartida requiere un paquete revisado y su propia autorización.

## Contexto

En el intento 13 quedaban 3,651 segundos de vigencia del manifiesto cuando el operador recibió la última respuesta humana previa a la escritura en Firestore. Todavía faltaba verificar el diario y la fuente. La reproducción local demostró la caducidad. El diario real registró el incidente de la operación y omitió la excepción que lo inició. [Comprobación del intento 13](../testing/hu084-evidencia-inicial-ventana-develop.md#intento-13-cerrado-en-firestore--2026-11-20)

## Decisión

1. Antes de emitir la credencial de escritura, conservar el manifiesto completo de admisión vinculado al alcance autorizado. Verificarlo al entrar en ejecución. Recoger a continuación la observación humana previa a la escritura con la barrera adquirida.
2. Tras esa observación, releer la fuente y sus versiones de Firestore en una transacción de solo lectura. Reconstruir la transacción completa con la hora de admisión y compararla con el manifiesto admitido. Solo una coincidencia exacta permite construir el manifiesto de ejecución a partir de esa misma lectura y con la hora actual. Registrar el manifiesto de ejecución junto con las huellas de la admisión y de su manifiesto.
3. Dentro de la transacción de escritura, releer la fuente y verificar el manifiesto de ejecución completo. Comprobar sus 60 segundos de vigencia y el presupuesto de trabajo hasta la última escritura y la devolución del control al SDK. Volver a observar la barrera después de la operación. Conservar la primera categoría de error, su fase y su hora antes de registrar el incidente. Inspeccionar los resultados inciertos y retirar los permisos temporales.

## Consecuencias

La lectura adicional consume parte del tiempo disponible para el escritor. Una respuesta humana tardía aún puede agotar la ventana de trabajo o la reserva para Sheets y la retirada de permisos. El ensayo local comprueba el orden y la integridad de los cambios. La latencia de los proveedores y la migración compartida requieren su propia evidencia. [Ensayo y siguiente decisión](../testing/hu084-evidencia-inicial-ventana-develop.md#ensayo-local-tras-el-intento-13)
