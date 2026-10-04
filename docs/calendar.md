# Calendario y eventos — Fase 4

## Uso y alcance

`/calendar` requiere sesión y `/setup/calendar` es una presentación pública sin datos privados. La creación rápida abre el mismo formulario que Nuevo evento. La página se carga por demanda; no se añade una dependencia de calendario.

- Mes: seis semanas, respetando lunes/domingo de preferencias. Flechas, Inicio/Fin y RePág/AvPág navegan por las fechas al enfocar una casilla. El día seleccionado muestra su agenda debajo; en móvil la cuadrícula usa cantidades en lugar de comprimir los títulos.
- Semana y Día: horario de 24 horas agrupado por hora de inicio, con una fila para elementos de día completo o sin hora. Los eventos que continúan del día anterior aparecen a las 00:00. Los simultáneos se conservan; las horas repetidas por cambio horario se ordenan por instante y los eventos que cruzan un cambio de offset lo indican. El horario se desplaza dentro de su propio contenedor en pantallas pequeñas.
- La fecha y la vista se conservan en la URL. Las flechas avanzan por el periodo elegido, el selector permite saltar a una fecha y Hoy vuelve al día actual. La cabecera de cada día abre su vista diaria y el botón de añadir crea un evento para esa fecha.
- Agenda: elementos del mes agrupados por día. Un evento de varios días se presenta en cada día ocupado. Las horas usan la zona y el formato 12/24 de preferencias; los días completos no cambian de fecha al cambiar de zona.
- Eventos: creación, edición, borrado lógico confirmado, título, descripción, lugar, zona, intervalos horarios o días completos y repetición. Se guarda mediante el botón del formulario, sin autoguardado. Cerrar, Escape, volver atrás o navegar con cambios pendientes muestra una confirmación de descarte; cerrar/recargar el navegador usa su aviso nativo cuando la plataforma lo permite.
- Tareas: se muestran las que tienen vencimiento; se excluyen canceladas y eliminadas y, por defecto, completadas. Pulsarlas abre el editor de Tasks existente. Una tarea sin hora ocupa su fecha civil; una tarea con hora usa la zona de visualización. Las futuras ocurrencias se incorporan cuando el servicio de tareas las crea al completar la anterior.
- Filtros: eventos, tareas, recordatorios e inclusión de tareas completadas. Desde fase 5 se proyectan las ocurrencias de recordatorios y se abre su editor al pulsarlas. Su presencia en calendario no implica una alarma programada.

Arrastrar eventos, representar su duración mediante bloques proporcionales, excepciones individuales e importación/exportación iCalendar siguen pendientes. La programación de avisos se gestiona en Recordatorios.

## Fechas y recurrencias

Todos los intervalos de eventos son `[inicio, fin)`: el final no ocupa otro día si coincide con su medianoche. En el formulario de día completo, el usuario indica el último día incluido; el adaptador de formulario suma un día al guardarlo y resta uno al abrirlo. La base almacena fechas civiles para `allDay` e instantes UTC para eventos con hora, manteniendo su zona original.

Las horas inexistentes o ambiguas introducidas manualmente se rechazan con un mensaje. Si un evento ya tiene un instante durante la segunda hora repetida, editar su título conserva el instante y sus segundos, siempre que no se modifiquen sus campos de fecha/hora/zona. Cambiar la zona del formulario mantiene los valores de reloj escritos y cambia el instante; esta decisión se explica junto al selector.

RRULE usa el parser compartido: frecuencias diaria/semanal/mensual/anual, intervalos, selecciones BY y límites COUNT/UNTIL. La fecha inicial debe coincidir con el patrón. UNTIL de día completo es una fecha, y UNTIL de eventos horarios es un instante UTC. Se omiten horas locales inexistentes sin consumir COUNT y se usa la primera ocurrencia de una hora repetida, salvo el instante original ya guardado.

`event-recurrence.ts` expande en tiempo de reloj de la zona del evento y convierte cada resultado a UTC. La duración es un número de días civiles para eventos de día completo y milisegundos transcurridos para eventos horarios. Al cruzar DST, la hora inicial recurrente se conserva y la hora final puede reflejar el cambio de offset. La consulta incluye eventos iniciados antes de la ventana que todavía se solapan con ella.

Las series con COUNT se recorren desde su origen en una sola pasada; el resto se evalúa entre límites acotados. Se limita a 512 ocurrencias de una misma serie que se solapen con la vista. Si una serie excede el límite o contiene un patrón inválido, se informa de cuál no pudo mostrarse y se conservan los demás resultados; no se truncan silenciosamente.

No se guardan copias de cada repetición. Abrir una ocurrencia edita el registro original y la interfaz avisa de que **guardar o borrar afecta a toda la serie, incluidas las fechas pasadas**. No hay EXDATE, excepciones ni edición de «sólo esta ocurrencia» todavía.

## Persistencia y seguridad

`event-service.ts` valida con los esquemas existentes, normaliza UTC/RRULE y reutiliza el repositorio de eventos. Actualizar y eliminar comprueba la versión dentro de la misma transacción de entidad y cola. Un error mantiene el formulario; si otra pestaña modificó el evento, no se sobrescribe su versión. El usuario puede conservar/copiar su texto y reabrir el evento para aplicar los cambios. Un borrado externo no desmonta un formulario abierto.

`calendar-service.ts` lee eventos y tareas del mismo usuario en una transacción de sólo lectura. La UI observa Dexie y los componentes no acceden a Supabase. Se conservan UUID, versiones, auditoría, tombstones y operaciones de sincronización. Se reutilizan `events` de Foundation, sus restricciones/RLS y la conversión civil/UTC de `services/supabase/persistence.ts`; no hay migración nueva.

Crear y editar funciona sin conexión después de cargar el módulo e iniciar sesión. La cola sigue pendiente de SyncEngine en fase 6; no se promete sincronización entre dispositivos ni arranque offline en frío antes de PWA en fase 9.

## Verificación

Pruebas de servicio: UTC, persistencia, aislamiento, concurrencia, rollback y borrado lógico. Fechas/proyección: límites exclusivos, zonas distintas, años/meses/bisiestos, semanas desde domingo/lunes, tareas filtradas, series antiguas, COUNT/UNTIL, días ordinales, meses cortos y cambios DST. Formularios: fin exclusivo, rechazo de horas ambiguas, conservación de instantes preexistentes y errores de almacenamiento.

E2E desktop/móvil: crear → editar → recargar, días completos, navegación y preferencias, integración con Tasks, filtros, series sin duplicar registros, borrado, 320 px, tema oscuro, offline, descarte explícito, conflictos entre pestañas y aislamiento de cuentas. Auth se intercepta sólo en Playwright; IndexedDB y los servicios de la aplicación son reales. La emulación móvil no sustituye pruebas en dispositivos nativos.

Referencias: [rrule](https://github.com/jkbrzt/rrule), [Temporal.PlainDate](https://tc39.es/proposal-temporal/docs/plaindate.html) y [Temporal.ZonedDateTime](https://tc39.es/proposal-temporal/docs/zoneddatetime.html).
