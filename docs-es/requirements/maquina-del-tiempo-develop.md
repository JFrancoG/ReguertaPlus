# Maquina Del Tiempo En Develop (Override De Fecha)

## Objetivo

En `develop`, muchos flujos dependen del dia de la semana y de la semana ISO (`Mi pedido`, calendario de reparto, paridad de productor, compromisos). Esta herramienta permite validar sin tocar datos backend ni cambiar la hora del sistema.

## Alcance

- Paridad de plataforma: Android + iOS.
- Entorno: pensada para builds y pruebas en `develop`.
- Persistencia: el override se guarda en local y se mantiene al cerrar/abrir app.

## Donde usarla

- Ir a `Ajustes`.
- En la zona de herramientas de develop, usar controles de **Reloj de pruebas**:
  - `-1 dia`
  - `+1 dia`
  - `Ahora`
  - `Reset`

## Comportamiento

1. Si hay override activo, la app usa ese timestamp simulado como `now`.
2. Toda la logica conectada a `nowMillisProvider` usa esa fecha simulada.
3. `Mi pedido` calcula ventana de consulta y semana con esa misma fecha simulada.
4. `Reset` borra el override y vuelve a fecha/hora real del dispositivo.

## Flujo practico de prueba para HU-005

1. Fijar fecha simulada a lunes antes de reparto.
2. Entrar en `Mi pedido`.
3. Esperado: aparece vista de pedido de semana anterior.
4. Si no existe pedido de semana anterior, debe salir estado vacio con mensaje (no la vista de hacer pedido de semana actual).
5. Avanzar dias (`+1 dia`) para validar limites hasta el dia de reparto inclusive.

## Notas de resolucion de calendario

La ventana de consulta en pedidos resuelve fecha de reparto en este orden:

1. Override en `deliveryCalendar/{weekKey}` (semana actual)
2. Dia por defecto en `config/global.deliveryDayOfWeek`
3. Compatibilidad con claves legacy:
   - `deliveryDateOfWeek` (top-level)
   - `otherConfig.deliveryDayOfWeek`
   - `otherConfig.deliveryDateOfWeek`

Los lectores de Firestore para calendario/config tambien contemplan rutas legacy para evitar lecturas vacias cuando hay datos historicos en nodos con estructura distinta.
