# Plan de implementación

## Inspección inicial (20 de septiembre de 2026)

`D:\Projects\dayflow` estaba vacío, incluidos archivos ocultos. No existían `package.json`, código, dependencias, variables de entorno, scripts, tests, configuración TypeScript, estilos ni `.git`. No había instrucciones `AGENTS.md` en el proyecto o sus directorios ascendentes inspeccionados. No se ha migrado ni eliminado código del usuario.

Entorno: Windows, PowerShell, Node 24.18.0 y npm 11.16.0. Se utilizó el scaffold oficial React/TypeScript de Vite. Se conserva Oxlint, el linter del scaffold actual. TypeScript estricto y `noUncheckedIndexedAccess` se activaron expresamente. El lockfile fija las versiones instaladas. React 19, Vite 8 y TypeScript 6 constituyen la base; no se instalaron versiones preliminares.

## Fases y puertas de calidad

| Fase                 | Entrega                                                                                                                          | Validación principal                                                                           |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 1 — Foundation       | Arquitectura, rutas privadas, providers, navegación desktop/móvil, temas, auth, modelos Zod, Dexie, repositorios y migración RLS | TypeScript, lint, unitarias, componentes, seguridad SQL, E2E de navegación y build             |
| 2 — Tasks            | Crear, editar, completar, reabrir, cancelar, prioridad, fechas, subtareas ordenables, filtros y RRULE                            | Reglas de recurrencia/fechas, formularios, login → crear → completar                           |
| 3 — Notes            | TipTap, listas/checklists/enlaces/código, debounce, fijar, archivar, borrar                                                      | Autoguardado, recuperación de errores y crear → editar → persistir                             |
| 4 — Calendar         | Mes y agenda, eventos con zona horaria, fechas civiles de día completo y tareas fechadas                                         | DST, intervalos, filtros y navegación mensual                                                  |
| 5 — Reminders        | Asociaciones, adaptadores web/Capacitor, permisos, programación/cancelación nativa                                               | Adaptadores y pruebas en dispositivos; no anunciar Web Push sin servidor                       |
| 6 — Offline & Sync   | SyncEngine, RPC LWW atómica, ConflictResolver, reintentos, Realtime, registro de dispositivos                                    | Dos clientes, duplicados, cambios concurrentes, cuentas distintas, pérdida de red y tombstones |
| 7 — Dashboard        | Hoy alimentado con tareas, eventos, vencidas y próximos recordatorios reales                                                     | Orden temporal y estados vacíos/error                                                          |
| 8 — Inbox y búsqueda | Captura, conversiones atómicas, etiquetas, búsquedas agrupadas                                                                   | Conversiones sin duplicados y filtros                                                          |
| 9 — PWA y Capacitor  | Manifest, iconos, service worker, instalación y proyectos nativos                                                                | Arranque offline, actualizaciones, Android y iOS                                               |

Antes de cada fase: inspeccionar los archivos afectados, reutilizar repositorios y validaciones, implementar un bloque y ejecutar `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e` y `npm run build`. Corregir los fallos antes de avanzar.

## Primera entrega — alcance histórico

Las fases 2–9 **no se implementan en esta ejecución**, según el apartado 60 de la solicitud. Las rutas futuras son pantallas explícitas de preparación. El panel inicial presenta el estado de Foundation; no es todavía el dashboard de datos personales.

No hay credenciales de Supabase: las pruebas de formularios simulan la frontera de autenticación, y las de SQL ejecutan PostgreSQL embebido con el esquema `auth` simulado. Esto no sustituye una prueba de extremo a extremo contra un proyecto Supabase real (correo de confirmación, login, logout y recuperación). Tampoco hay ejecución nativa, Web Push ni arranque offline en frío hasta sus fases.

## Segunda entrega — Fase 2

Se revisaron modelos, repositorios, rutas, autenticación, formularios, migraciones y scripts existentes antes de implementar. Se reutiliza la base y se añaden `features/tasks/`, utilidades de fecha/RRULE y una migración aditiva de recurrencia. Los esquemas de Auth se separan para que el login no cargue las librerías de recurrencia.

Implementado: captura rápida, CRUD, estados/prioridades, inicio/vencimiento, subtareas ordenables, filtros/búsqueda, recurrencias, persistencia reactiva, rollback optimista y protección frente a formularios obsoletos. Detalles en [tareas](tasks.md).

## Tercera entrega — Fase 3

Se revisaron repositorios, modelo de notas, rutas, autenticación, estilos, esquemas y pruebas existentes. Se añadió TipTap con StarterKit y checklist sobre Dexie, sin cambios destructivos ni una migración nueva.

Implementado: listado responsive, creación, editor con formato, colores, autoguardado con debounce, fijado optimista, archivo/restauración, búsqueda local y borrado lógico. Las pruebas cubren persistencia, rollback, concurrencia, navegación con cambios pendientes, edición offline, cuentas aisladas y formato en navegador. Detalles en [notas](notes.md).

## Cuarta entrega — Fase 4

Se inspeccionaron las utilidades de fechas y RRULE, los esquemas de eventos, los repositorios, los adaptadores SQL, las rutas, preferencias, formularios y pruebas. Se reutilizan esas piezas sin nuevas dependencias ni migraciones.

Implementado: calendario mensual, agenda por mes, selección de día, navegación por teclado, preferencias de semana/zona/formato horario, filtros de eventos/tareas/completadas y apertura del editor de tareas. Los eventos incluyen CRUD, horas/días completos, lugar, descripción, series RRULE y protección de cambios sin guardar o versiones obsoletas. Las series se expanden en memoria sólo para la ventana consultada. Detalles en [calendario](calendar.md).

Las vistas semanales/diarias se añadieron en la continuación del 3 de octubre. Las excepciones individuales de series siguen pendientes.

## Quinta entrega — Fase 5

Implementado: CRUD de recordatorios, asociación única a tarea/evento/nota, RRULE y zonas horarias, calendario, búsqueda/filtros, permisos y estado por dispositivo. Se añaden adaptadores Web y Capacitor Local Notifications, registro durable de IDs antes de programar, cancelación previa al borrado, reintentos explícitos, renovación al abrir/reanudar la app nativa y cancelación al cerrar sesión. No se utilizan timers para entregar avisos. Detalles en [recordatorios](reminders.md).

Dexie v2 añade sólo tablas locales de programación; SQL 003 añade la zona de repetición. Los IDs y permisos no se envían a Supabase. Las llamadas nativas se verifican con dobles de prueba; falta la validación de entrega real en dispositivos Android/iOS, que depende de los proyectos de la fase 9. La web informa que no dispone de alarmas programadas.

## Sexta entrega — Fase 6

Implementado: SyncEngine por sesión, transporte Supabase con timeout/aborto, RPC atómica idempotente, validación de propietario, LWW centralizada, cursor paginado, Realtime como señal de recuperación, reintentos, registro de dispositivos y estado real en Configuración. Los conflictos conservan copias locales descargables/restaurables. Los rechazos no retiran operaciones; su reenvío con fecha nueva es explícito y conserva los intentos anteriores.

SQL 004 crea historial, cabeceras y metadatos de resolución, migra los registros existentes y exige RPC para mutaciones de clientes. Dexie v3 añade checkpoints, réplicas y copias sin borrar tablas previas. Las tareas recurrentes generan IDs deterministas para evitar sucesoras duplicadas entre dispositivos.

Verificado con dos bases IndexedDB independientes y PostgreSQL embebido, también desde dos contextos de navegador. Sin credenciales locales, no se modifica un servicio externo ni se declara verificada la conexión real a Supabase/Auth/WebSocket. Detalles en [sincronización](sync.md).

## Séptima entrega — Fase 7

Implementado: panel privado Hoy sobre una instantánea reactiva de Dexie, captura rápida con vencimiento hoy, finalización de tareas, vencidas sin duplicados, eventos del día, próximos recordatorios y enlaces a los editores existentes. El resumen usa cantidades reales; distingue carga, fallo con reintento, vacío y desconexión.

Se reutilizan repositorios, servicio de tareas, recurrencias y utilidades de fechas. La zona y el formato horario siguen preferencias; las fechas se renuevan al cambiar de día o recuperar foco. No se añaden dependencias ni migraciones. La página de preparación permanece pública y separada de los datos personales. Detalles en [Hoy](dashboard.md).

## Octava entrega — Fase 8

Implementado: Inbox con captura, edición, búsqueda, borrado y conversión a tarea/nota/evento/recordatorio; búsqueda global agrupada con filtros y teclado; etiquetas compartidas con gestión y asignación desde los editores. Se reutilizan las tablas, la cola y los adaptadores existentes, sin dependencias ni migraciones nuevas.

Las conversiones son atómicas en IndexedDB y usan IDs deterministas para reintentos y convergencia al mismo tipo. La sincronización sigue siendo por entidad; decisiones offline hacia tipos diferentes se conservan ambas. La búsqueda es local y contempla contenido, acentos, etiquetas y archivo. Se verifican rollback, aislamiento, versiones obsoletas, restauración de asociaciones y protocolo SQL. Detalles en [Inbox, búsqueda y etiquetas](inbox-search-tags.md).

## Novena entrega — Fase 9

Implementado: manifest e iconos propios, worker con precarga de todos los módulos, instalación y estados verificables, actualización diferida hasta cerrar ventanas y proyectos Android/iOS con Capacitor. Los recursos públicos se almacenan en caché; datos y autenticación conservan sus servicios existentes. No se añade una migración.

Los proyectos nativos incluyen iconos/splash, plugins App y Local Notifications, permisos Android, retorno PKCE por esquema propio y botón Atrás con protección de diálogos. iOS usa Swift Package Manager. La versión web no registra workers en desarrollo ni dentro de Capacitor. Los tests PWA construyen dos versiones aisladas y prueban instalación, arranque offline, actualizaciones, logout y móvil. Detalles en [PWA y Capacitor](pwa-native.md).

El plan de nueve fases queda implementado como base de desarrollo. Siguiente trabajo recomendado: configurar y validar Supabase alojado, compilar/probar iOS en macOS, verificar alarmas en dispositivos y preparar firma/distribución. Los resultados y límites de esta entrega se registran en [verificación](verification.md).

## Continuación — backend local operativo

Al no disponer de proyecto Supabase alojado, se añadió un entorno local Docker con CLI fijado, cuatro migraciones aplicadas, configuración pública automática, buzón Mailpit y comandos para arrancar y detener conservando datos. Dos E2E adicionales comprueban Auth, correos, recuperación, RPC, Realtime, reconexión y RLS contra servicios reales. No requiere cuenta de Supabase. Consulta [el arranque local](local-backend.md). El siguiente paso de distribución sigue siendo conectar un backend accesible desde los dispositivos de destino.

## Continuación — Android conectado al backend local

Se añadió la variante depurable `local`, con paquete y recursos separados, configuración HTTP limitada a loopback y conexión ADB. El script genera sus recursos desde la configuración Capacitor del proyecto; `assembleLocal` produce un APK independiente. La prueba de integración nativa usa Auth real, retorno PKCE y una cuenta compartida con la web. Se corrigió un defecto de lectura del callback en WebView 124 y se incorporó una regresión unitaria. Instrucciones en [Android local](android-local.md) y resultados en [verificación](verification.md).

## Continuación — instalación USB preparada

El comando `android:device` permite listar, diagnosticar, instalar y reconectar Dayflow Local con selección explícita cuando hay varios dispositivos. Verifica el APK y los servicios antes de instalar, conserva datos y túneles existentes y no concede permisos automáticamente. Se verificaron siete casos con dobles y el flujo real en emulador. El 3 de octubre el usuario indicó que no dispone de un Android físico; esa validación permanece pendiente.

## Continuación — calendario semanal/diario y relaciones

Las vistas Semana y Día añaden navegación por fechas civiles, horario de 24 horas, agrupación de elementos sin hora y desplazamiento interno en móvil. Conservan fechas y vista en la URL, preferencias de zona/semana/formato, filtros y apertura de los editores existentes. Los cambios horarios conservan el orden de los instantes y muestran los cambios de offset cuando corresponden. Detalles en [calendario](calendar.md).

Los editores de notas, tareas y eventos incorporan vínculos bidireccionales con búsqueda, filtro, navegación y retirada sin borrar los documentos. Reutilizan `links` y su cola, con IDs deterministas y validación de propietario en transacciones. La navegación respeta los borradores y el autoguardado. No se añaden dependencias ni migraciones. Detalles en [relaciones](relations.md) y resultados en [verificación](verification.md).

## Continuación — Web Push con Supabase alojado

El 4 de octubre se añadieron suscripción voluntaria por navegador, recepción mediante el worker de producción, aislamiento de cuentas y cancelación al cerrar sesión. Una quinta migración incorpora suscripciones y reservas de envío; el emisor comparte el motor de recurrencias con el calendario. La función y Cron están desplegados en Supabase, con claves VAPID privadas fuera del frontend y autenticación del planificador mediante Vault.

Se verificaron el planificador real, cifrado, retirada de endpoints caducados y recepción con un evento inyectado en Chromium. La suscripción real al proveedor no respondió durante la comprobación; no se declara entrega completa verificada. El siguiente paso de distribución es publicar la web con HTTPS, configurar los retornos de Auth y comprobar correo y Web Push desde navegadores de uso real. Detalles en [Web Push](web-push.md).
