# Fase 2 — Tareas

## Estructura

- `features/tasks/pages/TasksPage.tsx`: coordinación de la pantalla; usuario obligatorio, estado de vista y parámetros para el editor.
- `components/`: toolbar, filas, formulario, editor y subtareas, sin acceso a Supabase.
- `hooks/use-tasks.ts`: lectura reactiva mediante `useLiveQuery` y completar/reabrir optimista con rollback.
- `services/task-service.ts`: operaciones de negocio y transacciones que incluyen tareas, subtareas y cola.
- `services/task-filters.ts`: filtrado y orden determinista.
- `schemas/task-form.ts`: validación de formulario y conversión de fecha civil/hora local a UTC.
- `shared/utils/dates.ts` y `recurrence.ts`: fechas y RRULE independientes de la zona horaria del navegador.

Se conserva la arquitectura de Foundation. Las rutas públicas `/setup/*` no leen tareas. Las tareas requieren una sesión Supabase; no se añadió un modo de autenticación ficticio ni una cuenta local compartida.

## Operaciones

Captura con título + Enter, creación detallada, edición, completar, reabrir, cancelar, en progreso, borrar con confirmación, prioridades, inicio, vencimiento civil o con hora. Subtareas: añadir, renombrar, completar, reabrir, subir/bajar con botones accesibles y eliminar. Cada operación valida el propietario y escribe su cola en la misma transacción.

Al eliminar una tarea también se marcan sus subtareas como eliminadas. Una operación recurrente crea su sucesora y las copias de sus subtareas, y completa la original de forma atómica. Si falla una escritura, ninguna queda aplicada. La tarea completada conserva su UUID e historial básico.

Los formularios mantienen su contenido si falla la persistencia. Al guardar una edición se verifica la versión que se abrió; si otra ventana cambió la tarea, se pide revisar la versión actual, sin sobrescribirla. No es todavía el ConflictResolver multidispositivo de fase 6.

## Recurrencias

Formato estándar RRULE; no hay formato propietario. Se usa `rrule` para la expansión y Temporal para convertir la hora de pared a un instante en la zona guardada con la tarea.

- FREQ: DAILY, WEEKLY, MONTHLY, YEARLY.
- Opciones: INTERVAL, BYDAY, BYMONTHDAY, BYMONTH, BYSETPOS, WKST, COUNT o UNTIL. Se rechazan duplicados, valores fuera de rango y combinaciones no admitidas. COUNT/INTERVAL tienen límite operativo de 10000.
- La fecha inicial define el ancla estable; COUNT no se reinicia al crear la siguiente tarea. Las fechas que no encajan con la regla siguen la expansión de RRULE desde el ancla; para patrones como lunes, conviene seleccionar un primer vencimiento que también sea lunes.
- Completar crea la siguiente fecha programada después del vencimiento actual, no después de la fecha del clic. No salta silenciosamente ocurrencias vencidas.
- Hora recurrente estable en la zona IANA elegida. Se omiten horas inexistentes sin consumir COUNT, y se usa la primera ocurrencia de horas repetidas según RFC 5545.
- Un vencimiento manual ambiguo o inexistente se rechaza con un mensaje para elegir otra hora.
- Fechas civiles no se convierten a instantes. UNTIL debe ser civil para tareas sin hora y UTC para tareas con hora.
- Reabrir y completar de nuevo no genera duplicados. La referencia `nextOccurrenceId` se conserva incluso si posteriormente se elimina la sucesora.
- Una tarea que ya generó su sucesora no permite cambiar fecha, zona o regla; esos cambios se hacen en la siguiente tarea. El resto de campos sigue siendo editable. No existe aún edición masiva de toda la serie.

Desde fase 5, el editor incluye **Crear recordatorio** para abrir un recordatorio asociado con fecha propia. Su estado y permisos se gestionan en Recordatorios y Configuración; la web no simula alarmas. El temporizador que actualiza textos de «Hoy» y «Vencida» sólo refresca etiquetas.

Desde fase 6, la sucesora recurrente obtiene un UUIDv8 determinista a partir de tarea y fecha. Sus subtareas usan el ID de sucesora y subtarea original. Así dos dispositivos que completen la misma ocurrencia offline no crean dos sucesoras distintas. Los repositorios rechazan sobrescribir una entidad existente durante una creación.

## Persistencia y migración

`202609200002_task_recurrence.sql` añade `timezone`, `recurrence_anchor`, `next_occurrence_id`, una foreign key compuesta por propietario y validación de zona horaria. No borra ni reescribe datos existentes. IndexedDB admite los campos opcionales sin cambiar sus índices, por lo que no necesita una migración destructiva. El adaptador de persistencia conserva los campos de recurrencia.

El guardado funciona sin red una vez abierta la app y restaurada la sesión. La cola no se vacía ni se sube todavía a Supabase. Arranque offline en frío depende del service worker de fase 9.

## Pruebas

Unitarias: fechas, cambios horarios, COUNT/UNTIL, lunes ordinales, bisiestos, versiones, concurrencia de completado, rollback de la serie, subtareas e aislamiento. Componentes: título obligatorio, errores de guardado y rollback optimista. SQL: migración aplicada sobre Foundation y restricciones de propietario/zona. Playwright: login con respuestas Auth interceptadas, CRUD real en IndexedDB, subtareas, recurrencia, offline, filtros, 320px y cambio de cuenta.

Las respuestas Auth interceptadas existen sólo en los tests. La prueba contra un Supabase real, correo y multidispositivo sigue pendiente de configuración/fase 6.
