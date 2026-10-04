# Recordatorios y notificaciones — Fase 5

## Uso

`/reminders` permite crear, editar y eliminar recordatorios, buscar por título/descripción y filtrar por intención de aviso. Fecha y hora son obligatorias; se convierten a UTC conservando una zona IANA para la repetición. El formulario rechaza horas inexistentes o ambiguas por DST y conserva un instante original sin redondearlo cuando sólo cambia el texto. Incluye confirmación antes de descartar cambios, edición con comprobación de versión y borrado lógico con confirmación.

La asociación es opcional y única: tarea, evento o nota del mismo propietario, existente y sin borrar. Los editores de esas entidades incluyen un enlace para crear el recordatorio asociado. Borrar o cambiar el elemento asociado **no elimina ni desplaza el recordatorio**: tiene su propia fecha; aparece «Elemento asociado no disponible» y puede desvincularse. El calendario incluye sus ocurrencias y un filtro independiente, también si el usuario ha desactivado el aviso.

RRULE admite los mismos presets y validaciones que eventos. Se edita toda la serie; no hay excepciones individuales todavía. La expansión reutiliza el motor de eventos (COUNT/UNTIL, ordinales, DST y zona de origen), sin crear entidades para cada repetición.

## Guardado y programación

`features/reminders/services/reminder-service.ts` valida, comprueba versión/propietario/asociaciones y guarda entidad + cola en una transacción. Después llama al coordinador de notificaciones. Si falla el sistema operativo, **el recordatorio permanece guardado**, su estado indica error y se ofrece reintentar desde Configuración. El borrado primero exige cancelar sus IDs conocidos; si falla, no crea el tombstone.

`services/notifications/scheduler.ts` serializa cambios de datos y llamadas al sistema mediante Web Locks y un mutex por base como alternativa en WebViews sin esa API. Guarda los IDs antes de llamar a Local Notifications; un cierre o error parcial conserva una lista cancelable. Al renovar, cancela los avisos conocidos, vuelve a leer permisos e intención y reconstruye la programación. Una caída entre cancelación y nueva programación deja un estado pendiente recuperable al volver a abrir. No se confunde una escritura local con una entrega.

Dexie v2 incorpora `notificationJobs`, `notificationStates` y `notificationPreferences`. Son locales al dispositivo; las preferencias se separan por cuenta. Los IDs son enteros positivos autoincrementales y se comprueba el límite de 32 bits. `Reminder.notificationId` guarda el primer ID confirmado sin crear una nueva versión de contenido ni operación remota. La cola y `toReminderRow` excluyen este dato; `fromReminderRow` nunca recupera IDs remotos. SQL `202609240003_reminder_timezone.sql` añade `timezone` con valor inicial UTC y valida zonas mediante el trigger existente.

## Adaptadores

- **WebNotificationService** representa la ausencia de alarmas locales del navegador. El envío remoto se implementa por separado mediante `web-push.ts`, el worker de producción y una función periódica de Supabase. La activación es voluntaria desde Configuración. Consulta [Web Push](web-push.md) para despliegue, privacidad, reintentos y límites; no se confunde la suscripción con una entrega confirmada.
- **CapacitorNotificationService** usa `LocalNotifications.schedule`, `cancel`, `getPending`, permisos y configuración de alarmas exactas de Android. Crea el canal Android de recordatorios y pasa fechas reales al sistema. No programa sin permiso ni presenta como exacta una alarma degradada por Android. Al cerrar sesión se cancelan pendientes y se retiran notificaciones entregadas identificadas como propias de Dayflow.
- **NotificationRuntime** renueva la programación al restaurar sesión, reanudar la app nativa o recibir una notificación en primer plano. Las acciones abren el recordatorio sólo cuando el usuario de la notificación coincide con la sesión activa. Si la sesión desaparece, intenta cancelar y muestra un error si no puede. El cierre de sesión explícito espera a la cancelación.

Con Local Notifications 8.3, Android conserva también entregas en el resultado histórico de `getPending`. El adaptador utiliza `getAll({ state: 'SCHEDULED' })` para comprobar pendientes reales. Al retirar avisos entregados consulta sus metadatos mediante `getByIds`, porque `extra` sólo está disponible directamente en las entregas de iOS. Conserva notificaciones sin la marca de Dayflow y aquellas con un tag ajeno, incluso si comparten un ID.

## Límites explícitos

Se seleccionan los **60 avisos más próximos de toda la cuenta**, dentro de una ventana de **366 días**, para respetar un presupuesto conservador bajo el límite de pendientes de iOS. Las repeticiones se programan como fechas individuales: no se traduce arbitrariamente RRULE a un intervalo fijo. Cada recordatorio muestra número de avisos y última fecha programada. Hace falta abrir Dayflow para renovar; una serie ilimitada **no queda garantizada para siempre**. Un recordatorio sin cupo queda pendiente, sin afirmar que se programó.

El permiso no garantiza la entrega: Doze, ahorro de energía, modo silencio y ajustes del sistema pueden limitarla. El coordinador verifica los IDs pendientes devueltos por el sistema, no que el usuario haya recibido o leído cada aviso. Estado y programación son específicos de este dispositivo y no se sincronizan. No se garantiza que sobrevivan a la desinstalación o al borrado de datos del navegador.

## Validación nativa

La fase 9 generó los proyectos Android/iOS y sincronizó Core, App y Local Notifications 8, incluyendo los permisos de notificaciones y alarmas exactas. La variante [Dayflow Local](android-local.md) permite ejecutar las comprobaciones contra Supabase local desde un emulador. Los resultados de entrega realmente ejecutados se registran en [verificación](verification.md).

Las pruebas de servicios usan IndexedDB real en Playwright, fake-indexeddb en Vitest y un doble del plugin para comprobar llamadas y errores. Sigue siendo necesario validar en teléfonos físicos el diálogo de permisos, denegación/revocación, Doze prolongado, reinicio y cambios de zona. Compilar y probar iOS requiere macOS/Xcode.

## Referencias oficiales

- [Capacitor Local Notifications: límites, permisos, programación y cancelación](https://capacitorjs.com/docs/apis/local-notifications).
- [Capacitor App: ciclo de vida y reanudación](https://capacitorjs.com/docs/apis/app).
