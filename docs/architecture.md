# Arquitectura

```
src/app/                  providers, router, layouts, preferencias Zustand
src/features/             auth, dashboard Hoy/preparación, settings, tasks, notes, calendar, events, reminders, sync, inbox, search, tags
src/shared/               componentes, hooks, modelos, validación Zod
src/services/database/    Dexie y repositorios por usuario
src/services/supabase/    cliente y servicio de autenticación
src/services/sync/        motor, transporte, codecs, conflictos y recuperación
src/services/notifications/ adaptadores web/nativo, coordinador y ciclo de vida
src/test/                 preparación de pruebas y pruebas SQL
e2e/                      Playwright
supabase/migrations/      esquema PostgreSQL y seguridad RLS
```

Las carpetas de funcionalidades posteriores se crean cuando tengan código. La fase 5 incorpora Capacitor Core, App y Local Notifications para los adaptadores; la fase 9 añade CLI, Android/iOS, configuración y proyectos nativos.

## Responsabilidades

- React Router carga páginas por demanda. `RequireAuth` espera a la restauración de sesión y redirige recuperación de contraseña a su ruta específica.
- `AuthProvider` escucha Supabase Auth, limpia la caché de Query al cambiar eventos de autenticación y libera sus suscripciones. No hace peticiones asíncronas dentro del callback de Auth.
- React Hook Form + Zod valida formularios. La capa de servicios vuelve a validar antes de enviar credenciales.
- Zustand conserva únicamente preferencias locales, no documentos ni tokens. TanStack Query está preparado para estado remoto; tareas y notas viven en Dexie y se observan con `dexie-react-hooks`.
- Los componentes de presentación nunca usan tablas de Supabase directamente. Cada repositorio se construye con el UUID del usuario autenticado y debe descartarse al cambiar de sesión.
- CSS con variables semánticas y Tailwind 4, Lucide y componentes propios pequeños. El diálogo usa `<dialog>` nativo para foco modal, Escape y retorno al disparador. No se cargan fuentes externas.
- Se conserva Ctrl/Cmd+N del navegador. `N` fuera de campos abre creación rápida; Ctrl/Cmd+K abre búsqueda agrupada. En la vista pública se pide acceso antes de consultar documentos.

## Datos y seguridad

La base local es compartida por instalación, con cada consulta/escritura restringida por `userId`. Las rutas `/setup/*` son públicas y no leen registros privados. No son un inicio de sesión alternativo. No se borran datos locales al cerrar sesión para evitar pérdida de operaciones pendientes; otra cuenta no puede leerlos mediante los repositorios. IndexedDB no está cifrada: la seguridad física del perfil del navegador sigue siendo necesaria.

Los errores de persistencia rechazan la operación. Dato y cola se escriben en una transacción; no hay un éxito visual antes del commit. La interfaz optimista de cada feature deberá revertir si falla el repositorio.

Los tipos de dominio usan camelCase y no dependen de tipos generados por Supabase. La migración usa snake_case. El adaptador de persistencia convierte fechas civiles y UTC explícitamente; no se deben subir objetos de dominio directamente con `upsert`. Los IDs de notificaciones son específicos de cada dispositivo, por lo que `notificationId` sólo pertenece al estado local, no a la tabla remota.

## Evolución

No se implementa todavía IA. Los repositorios sirven de frontera para futuros comandos y permiten sustituir almacenamiento/sincronización sin rehacer componentes. Las relaciones entre nota/tarea/evento tienen entidad propia; claves compuestas y triggers verifican pertenencia en PostgreSQL.

En fase 2, `features/tasks` incorpora su servicio de negocio, hooks reactivos, formularios y componentes. El servicio opera tareas/subtareas/cola de forma atómica sobre los repositorios existentes. Las utilidades compartidas de fechas y RRULE utilizan Temporal y rrule; los esquemas de autenticación permanecen separados para conservar carga por demanda.

En fase 3, `features/notes` añade servicio, normalización del documento TipTap, controlador de autoguardado independiente de React, hooks y componentes. Las escrituras se serializan y verifican la versión dentro de la transacción; un formulario obsoleto no sobrescribe otra pestaña. La UI conserva el borrador ante errores o borrados externos y ofrece guardarlo como copia. Esta protección local no sustituye al futuro ConflictResolver remoto. Los módulos de notas/editor se cargan por demanda y reutilizan el repositorio y la cola existentes. Detalles en [notas](notes.md).

En fase 4, `features/events` mantiene validación, formulario, servicio y expansión de series. `features/calendar` agrega eventos y tareas del mismo usuario en una lectura transaccional, proyecta sólo el intervalo visible y presenta mes/agenda. Las repeticiones son vistas del registro original, no filas duplicadas. Ediciones y borrados verifican versión dentro de la transacción existente. Se reutilizan React Hook Form, Zod, Temporal y rrule; no se añade una librería visual de calendario. Detalles en [calendario](calendar.md).

En fase 5, `features/reminders` incorpora CRUD, asociaciones y proyección en calendario. `NotificationService` separa permisos/programación/cancelación del servicio de negocio. El coordinador conserva IDs antes de invocar al sistema y errores recuperables después del guardado. Web informa que no puede programar; Capacitor delega al sistema operativo. El runtime nativo se carga sólo en plataformas nativas y reacciona a sesión/reanudación, sin timers de entrega. Tablas de programación e IDs nunca se sincronizan. Detalles y límites en [recordatorios](reminders.md).

En fase 6, `SyncRuntime` enlaza la sesión con el motor y libera suscriptores, temporizadores y solicitudes al salir. `SupabaseSyncTransport` separa HTTP/Realtime de la lógica local. El motor aplica páginas y acuses en transacciones Dexie, conservando snapshots remotos mientras hay escrituras locales pendientes. `ConflictResolver` y SQL comparten la regla LWW; `features/sync` muestra estado, errores, dispositivos y copias. Las pruebas de integración sustituyen sólo la frontera HTTP/Auth y ejecutan el protocolo SQL real. Detalles en [sincronización](sync.md).

En fase 7, `features/dashboard` mantiene una lectura transaccional por usuario y una proyección pura de Hoy. Reutiliza el servicio de tareas y las proyecciones temporales de calendario/recordatorios. La página privada se monta por sesión, observa Dexie y actualiza sus fechas al recuperar foco o cambiar de día; la preparación pública continúa separada. No almacena un segundo resumen ni añade escrituras por leer el panel. Detalles en [Hoy](dashboard.md).

En fase 8, `features/inbox` convierte capturas mediante una transacción que abarca origen, destinos y cola. `features/tags` valida extremos y mantiene relaciones restaurables con IDs estables. `features/search` separa la lectura de la proyección, permitiendo incorporar un índice full-text en el futuro. Panel y página de búsqueda reutilizan la misma implementación, cargada por demanda. No se añaden tablas ni migraciones. Detalles y límites multidispositivo en [Inbox, búsqueda y etiquetas](inbox-search-tags.md).

En fase 9, `services/pwa` registra y observa el worker exclusivamente en web compilada. Workbox genera la precarga; `InstallationSettings` expone disponibilidad, instalación y actualización sin forzar recargas. `services/native` valida callbacks PKCE, deduplica códigos y conecta la navegación con App. `android/` e `ios/` empaquetan el mismo frontend, con permisos y recursos propios; los datos continúan usando Dexie/SyncEngine. Los tests de producción PWA se separan de Vite dev y de sus artefactos. Detalles en [PWA y Capacitor](pwa-native.md).
