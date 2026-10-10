# Sincronización — Fase 6

## Puesta en marcha

Configura las variables públicas de Supabase y aplica **todas las migraciones pendientes**, incluida `202609240004_sync.sql`. El 3 de octubre de 2026 se aplicaron las cuatro migraciones al proyecto alojado Dayflow y se conectó `.env.local`. Se verificaron Auth con contraseña, RPC, WebSocket Realtime, cambios offline y aislamiento entre cuentas desde contextos de navegador independientes. También existe un backend Docker separado. Consulta [configuración alojada](hosted-backend.md) y [resultados de verificación](verification.md).

La migración conserva los registros y crea un historial inicial para ellos. Revoca INSERT/UPDATE directos de las entidades sincronizadas para clientes autenticados: desde esta versión se escribe mediante RPC. No despliegues un cliente antiguo que escriba directamente en esas tablas. RLS conserva las lecturas por propietario. No modifica documentos ni borra datos del usuario.

## Flujo

La UI lee Dexie. Cada `create`, `update` y `remove` guarda documento y operación de cola en una transacción. Las operaciones contienen snapshots completos, UUID, propietario y reintentos. No se compactan ni se retiran hasta tener un acuse de su ID concreto. Los borrados son tombstones.

`SyncRuntime` crea un motor por sesión, registra una instalación por cuenta y lo detiene al salir/cambiar usuario. `SyncEngine` recupera cambios, ordena operaciones por dependencias, envía snapshots y vuelve a recuperar el historial remoto. El acceso HTTP comprueba la sesión antes de cada petición, usa AbortSignal y un timeout de 15 segundos. Las respuestas tardías de una sesión cancelada no alteran IndexedDB.

Web Locks serializa motores entre pestañas del mismo perfil. En WebViews sin Web Locks hay un mutex en memoria; la idempotencia SQL también protege reintentos concurrentes de contextos diferentes. Cada instalación mantiene su propia base y dispositivo. La actividad se actualiza aproximadamente cada 15 minutos mientras el motor está activo.

## Protocolo SQL

- `dayflow_apply_operation(jsonb)` es una transacción: valida identidad/propietario/tipo, adquiere un bloqueo por usuario, resuelve LWW, escribe la entidad, registra el cambio y guarda el acuse. Un reintento con el mismo ID y contenido devuelve el mismo resultado; reutilizar el ID con otro contenido se rechaza. No hay `upsert` ciego desde el cliente.
- La lista de tablas está cerrada. Las claves foráneas incluyen propietario. Las funciones `security definer` usan `search_path` vacío, verifican `auth.uid()` y no están concedidas a anónimos. Los helpers internos no son invocables por clientes.
- `sync_heads` asigna una secuencia por usuario bajo bloqueo de fila hasta el commit. Evita el problema de que un número mayor se confirme antes que uno menor del mismo usuario.
- `sync_changes` guarda snapshot, tipo y sello de conflicto. `sync_records` identifica el último cambio de cada entidad. Sólo el propietario puede leer el historial y su cabecera; no puede escribirlos directamente.
- `dayflow_pull(after,limit)` pagina hasta 100 cambios por secuencia. La aplicación guarda cada página, sus réplicas y el cursor en una sola transacción IndexedDB. El cursor usa una cadena decimal para no perder precisión de bigint.

Realtime observa únicamente `sync_heads`, con filtro de propietario; el evento despierta una descarga por cursor. No se utiliza el orden del WebSocket como garantía. La publicación `supabase_realtime` se actualiza si existe. Hay comprobación periódica cada 30 segundos cuando no se recibe Realtime, y al recuperar conectividad/reanudar la app. Se limita el trabajo de una pasada para no bloquear indefinidamente la UI.

## Conflictos y seguridad de los datos

La estrategia está centralizada en `ConflictResolver` y su equivalente SQL `dayflow_wins`. El orden es: **fecha de escritura en milisegundos → versión del autor → tombstone en empate → UUID de operación**. El UUID sólo rompe empates; no pretende ser un reloj. La versión visible local puede avanzar al recibir contenido remoto para detectar formularios abiertos obsoletos. El sello del autor se guarda aparte del contador de revisión del documento.

Un borrado más reciente impide que una edición antigua resucite la entidad. Como LWW decide por la fecha, una edición realmente posterior al borrado puede ganar y restaurar el documento. No se hace mezcla de texto colaborativa ni fusión por campo en este MVP.

Se rechazan escrituras adelantadas más de cinco minutos respecto al servidor. Las atrasadas pueden perder un conflicto; la UI advierte si el desfase observado es grande. No se cambia silenciosamente el reloj de un snapshot ya enviado: rompería la idempotencia.

Cuando una operación local pierde y su contenido difiere, se conserva en `syncConflicts` antes de retirar la operación. Configuración muestra esas copias, permite descargarlas como JSON, marcar revisión y restaurar documentos principales con un UUID nuevo. Restaurar una tarea como copia no duplica sus subtareas. Las copias permanecen locales y no se purgan automáticamente.

Una edición nueva hecha durante un envío conserva su propia operación y permanece visible hasta su acuse. `syncReplicas` retiene la última versión remota aunque haya ediciones pendientes; un acuse antiguo no puede borrar un cambio remoto posterior que ya se descargó. Los datos descargados no generan nuevas operaciones de cola.

Las sucesoras de tareas recurrentes y sus subtareas utilizan UUIDv8 deterministas (SHA-256 sobre padre y ocurrencia). Completar la misma tarea offline desde dos dispositivos produce la misma sucesora, no dos tareas independientes. Las operaciones siguen teniendo UUID propios para registrar cada intento.

## Errores y recuperación

`SyncEngine.syncOnce(force?)` devuelve `Promise<SyncResult>` y `synchronizeNow(userId)` propaga ese resultado. Una promesa resuelta no certifica que la sincronización haya terminado: el consumidor debe comprobar `result.completed` o `result.status === 'success'`.

| Estado    | `completed` | Significado                                                                                                                                                   |
| --------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `success` | `true`      | La descarga final alcanzó el fin del historial y no quedan operaciones de esta cuenta en la cola local. Se actualiza `lastSuccessAt`.                         |
| `partial` | `false`     | Queda trabajo (`reason: 'pending'`), se omitió la pasada por una pausa de reintento (`'backoff'`, con `nextAttemptAt`) o se detuvo la sesión (`'cancelled'`). |
| `offline` | `false`     | El navegador informa de desconexión, al comenzar o durante un fallo. Incluye `message`.                                                                       |
| `error`   | `false`     | Falló la pasada o quedan operaciones bloqueadas. Incluye `message` y `kind`: `transient`, `auth`, `setup` o `permanent`.                                      |

Los límites de 200 envíos y 20 páginas por descarga, las operaciones aplazadas y las nuevas ediciones durante un envío pueden producir `partial`. Los rechazos permanentes permiten continuar con otras operaciones, pero el resultado sigue siendo `error`. Un fallo de transporte con el navegador online es `error`, pues estar online no prueba que el servidor sea accesible. Los llamantes concurrentes comparten el resultado de la pasada en curso; `force` no reinicia una pasada que ya comenzó. La cancelación, incluso mientras se espera el bloqueo entre pestañas, nunca devuelve éxito.

La confirmación describe el estado observado al finalizar la pasada; una edición local o remota posterior requiere otra sincronización. El botón manual informa de los resultados incompletos, y el indicador no presenta una confirmación anterior como finalización de una pasada parcial o desconectada.

Los errores de red reintentan con espera exponencial y jitter, hasta cinco minutos. Autenticación/configuración usan una pausa larga para no saturar el backend; el botón **Sincronizar ahora** permite reintentar inmediatamente. Los datos rechazados por validación quedan bloqueados y visibles, sin perder el snapshot ni bloquear permanentemente otros documentos.

**Exportar cambios pendientes** conserva la cola en JSON. Tras corregir datos o el reloj, **Reenviar versión actual** solicita confirmación, archiva los intentos anteriores, crea un ID de operación nuevo y usa la fecha actual. Puede sustituir contenido remoto; nunca se hace automáticamente. Una copia archivada no implica que se haya sincronizado.

El indicador muestra **Guardado local** y el estado actual de la cola, incluida la cantidad pendiente durante una desconexión o un error. Una cola vacía se identifica como **Sin pendientes**; no acredita el estado actual del servidor. Durante la lectura inicial o si falla IndexedDB, la interfaz indica que el guardado y la cola están pendientes de comprobar.

Configuración separa **En este dispositivo**, **Cola de envío** y **Última confirmación remota completa**. Esta última muestra la fecha de `lastSuccessAt`, actualizada únicamente tras descargar hasta el final del historial y confirmar toda la cola conocida de esa cuenta. La fecha se conserva como evidencia histórica aunque haya nuevas operaciones, desconexión, error o una pasada parcial; nunca se convierte en la etiqueta de estado actual **Sincronizado**. Si no existe confirmación, se indica explícitamente. Configuración también muestra errores, copias y dispositivos. Estar online no demuestra que Supabase responda. Si falta la migración, la aplicación informa del error y continúa guardando localmente.

## Límites y continuidad

El protocolo admite tareas, notas, eventos, recordatorios, subtareas, etiquetas, asociaciones, inbox y dispositivos. Perfil de Auth, apariencia y preferencias de notificaciones permanecen fuera de esta cola. Los IDs de alarmas nunca viajan al servidor. El runtime nativo observa cambios remotos de recordatorios y renueva su programación mediante el sistema operativo.

El máximo por operación es 2 MiB en SQL. El historial, los acuses y los tombstones se conservan; no hay purgado automático. Antes de introducir retención será necesario un contrato de expiración de cursores y bootstrap completo. La sincronización automática se ejecuta mientras la aplicación está abierta/activa; no promete un worker de fondo con la aplicación cerrada. La PWA y el arranque offline en frío están implementados; consulta [sus requisitos de sesión y límites](pwa-native.md).

## Referencias oficiales

- [Supabase: funciones SQL y permisos](https://supabase.com/docs/guides/database/functions).
- [Supabase: invocación RPC](https://supabase.com/docs/reference/javascript/rpc).
- [Supabase: Postgres Changes y filtros](https://supabase.com/docs/guides/realtime/postgres-changes).
