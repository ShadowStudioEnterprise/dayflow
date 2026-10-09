# Base de datos

Migración inicial: `supabase/migrations/202609200001_foundation.sql`. Fase 2 añade `202609200002_task_recurrence.sql` (zona horaria, ancla, referencia a sucesora y validación/índices). Fase 5 añade `202609240003_reminder_timezone.sql` (zona IANA para las recurrencias de recordatorios, inicialmente UTC). Fase 6 añade `202609240004_sync.sql` (historial, cursores, resolución de conflictos y RPC idempotente). Aplicar en orden sólo las migraciones pendientes.

Incluye `profiles`, `notes`, `tasks`, `subtasks`, `events`, `reminders`, `tags`, `note_tags`, `task_tags`, `event_tags`, `devices`, `sync_operations`, además de `inbox` y `entity_links`.

Las tablas de entidades tienen `user_id`, RLS y políticas SELECT/INSERT/UPDATE que exigen `auth.uid() = user_id`. La fase 6 revoca los permisos de escritura directa de las entidades sincronizadas y exige la RPC, que valida el propietario. No se conceden DELETE a clientes. Las foreign keys de relaciones incluyen `user_id` para impedir referencias a entidades de otra cuenta incluso conociendo su UUID. El trigger de alta crea un perfil, con `search_path` vacío. Los índices priorizan propietario, actualización, fechas y padres de subtareas.

`created_at`, `updated_at`, `deleted_at`, `version` soportan auditoría y sincronización. Los triggers mantienen creación/propietario y el avance de revisión; la RPC conserva la fecha lógica de la escritura y resuelve conflictos mediante un sello independiente. Consulta [el protocolo de sincronización](sync.md).

## Fechas

- Instantes: `timestamptz`; dominio ISO 8601 con offset explícito, normalizado a UTC en el adaptador.
- Eventos de día completo: `start_date`/`end_date`, tipo `date`; final exclusivo, sin conversión por zona del navegador.
- Eventos con hora: `start_at`/`end_at`, conservando `timezone` IANA.
- Tareas: `due_at` o `due_date`, mutuamente excluyentes. El dominio `dueAt` admite un instante o una fecha civil; el adaptador discrimina por formato validado.
- Recordatorios: `trigger_at` siempre es un instante; `timezone` conserva la hora local de las repeticiones.

Dexie v2 añade tres tablas locales: `notificationJobs`, `notificationStates` y `notificationPreferences`. No tienen equivalente remoto ni generan operaciones de sincronización. Los registros anteriores sobreviven a la migración. La cola excluye `notificationId` y los adaptadores de recordatorios convierten sus fechas y relaciones explícitamente.

## Verificación y aplicación

Las pruebas usan PGlite (PostgreSQL embebido), creando roles `anon`/`authenticated` y `auth.uid()` de prueba; ejecutan la migración real y verifican RLS, foreign keys, fechas, auditoría y soft delete. No se ha aplicado la migración a un servicio externo.

Para Supabase, configura un proyecto y aplica el archivo con SQL Editor, o inicializa Supabase CLI en este repositorio (`supabase init`), enlaza tu proyecto (`supabase link --project-ref ...`) y ejecuta `supabase db push`. Revisa el destino antes de aplicar migraciones. Usa una base vacía de desarrollo para esta migración inicial.

La migración `202609240004_sync.sql` añade `sync_heads`, `sync_changes` y `sync_records`, y un resultado idempotente en `sync_operations`. Conserva los registros existentes y los incorpora al historial. Las escrituras cliente de entidades y operaciones se revocan: la RPC `dayflow_apply_operation` es la única entrada de mutación. RLS mantiene las lecturas por cuenta; helpers internos y tablas de metadatos no se exponen para escritura. `dayflow_pull` entrega páginas del propietario autenticado.

Realtime observa `sync_heads`, añadido a `supabase_realtime` cuando esa publicación existe. Dexie v3 conserva checkpoints, réplicas remotas y copias de conflictos por propietario. No altera la cola ni elimina tablas anteriores. Storage sigue pendiente de incorporar archivos: bucket privado y RLS por propietario.

## Inbox y etiquetas

Fase 8 reutiliza `inbox`, `tags`, las tres tablas de asociaciones y las entidades existentes, sin una migración adicional. Las conversiones guardan destino, tombstone y cola atómicamente en Dexie; la RPC remota sigue confirmando cada entidad por separado. Las asociaciones se pueden restaurar explícitamente con una versión posterior y el mismo ID. Los índices SQL de nombre de etiqueta y asociación activa conservan su unicidad. Véanse [los límites de concurrencia](inbox-search-tags.md).

## Purgado futuro

Conservar tombstones hasta tener acuse de sincronización de todos los dispositivos activos y un plazo de retención definido. Un job privilegiado purgará tras ese umbral, con rebootstrap obligatorio de dispositivos antiguos. No hay borrado automático en esta fase ni pérdida silenciosa de colas locales.

## Migración Web Push

`202610040005_web_push.sql` añade suscripciones y reservas de envío; sus RPC privilegiadas deben contrastarse con los permisos efectivos del entorno. Consulta [Web Push](web-push.md) y la [auditoría](audits/2026-10-09.md).

## Permisos explícitos de clientes

`202610090006_security_privileges.sql` retira EXECUTE de `PUBLIC`, `anon` y `authenticated` en las cinco funciones trigger de alta, auditoría y validación. Mantiene los permisos de las RPC de cliente y de `service_role`. Los triggers siguen ejecutándose en su contexto de alta y actualización.

Para futuros objetos creados por `postgres` en `public`, tablas y secuencias no conceden permisos automáticos a clientes, y las funciones no conceden EXECUTE automático a `anon`/`authenticated`. La revocación del permiso base de EXECUTE de `PUBLIC` es global para futuras funciones de `postgres`, porque una revocación por esquema no puede neutralizar el default global de PostgreSQL. Toda nueva función de ese propietario, incluso en otro esquema, debe declarar sus permisos necesarios. Los objetos existentes conservan sus permisos salvo los cinco triggers indicados. Las nuevas migraciones deben conceder explícitamente únicamente los accesos de cliente requeridos.
