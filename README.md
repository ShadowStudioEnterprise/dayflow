# Dayflow

Una aplicación personal para organizar notas, tareas, calendario y recordatorios, diseñada para evolucionar a web, PWA, Android e iOS.

**Web publicada:** [Dayflow en Vercel](https://dayflow-by-shadowstudio.vercel.app/auth/login).

Incluye notas, tareas, vistas de calendario de mes/semana/día, recordatorios, relaciones, Dashboard, Inbox, búsqueda, etiquetas y perfil con estadísticas. Ofrece sincronización con Supabase, instalación como PWA, arranque offline, actualizaciones sin interrumpir borradores y proyectos Android/iOS. La confirmación y recuperación por correo y las notificaciones web se verificaron manualmente en el alojamiento anterior; la recepción en el nuevo dominio sigue pendiente de prueba manual. Quedan pendientes la firma y publicación en tiendas y la validación en dispositivos físicos. Consulta la [validación de publicación](docs/release-validation.md) y la [configuración de Vercel](docs/vercel.md).

## Inicio rápido

Requisito recomendado: Node.js 24 LTS con npm. Desde esta carpeta:

```sh
npm ci
npm run dev
```

Abre la dirección que imprime Vite (habitualmente `http://localhost:5173`). Sin variables de Supabase, `/` abre `/setup`, una vista pública de preparación sin datos personales. Puedes explorar la navegación y cambiar apariencia/preferencias sin crear una cuenta.

**Para usar cuentas y sincronización sin un proyecto Supabase:** abre Docker Desktop y ejecuta `npm run backend:start` antes de iniciar Vite. Abre <http://127.0.0.1:5173> y crea tu cuenta; confirma el email desde el [buzón local](http://127.0.0.1:54324), en el mismo navegador. Consulta [arranque, pruebas y límites del backend local](docs/local-backend.md).

## Stack

React 19, TypeScript 6 estricto, Vite 8, React Router 7, TanStack Query 5, Zustand 5, React Hook Form, Zod 4, Tailwind CSS 4, Lucide, Supabase JS 2, Dexie 4, TipTap 3, rrule y Temporal polyfill para fechas y zonas horarias. Pruebas: Vitest, React Testing Library, fake-indexeddb, PostgreSQL embebido PGlite y Playwright. Lint: Oxlint. Formato: Prettier. Versiones exactas reproducibles en `package-lock.json`.

## Supabase y variables de entorno

Para un proyecto alojado (alternativa al [backend local](docs/local-backend.md)):

Consulta la [guía de conexión a Supabase alojado](docs/hosted-backend.md), con acceso administrativo, revisión de migraciones, URLs de Auth y verificación entre clientes.

1. Crea un proyecto de desarrollo Supabase.
2. Copia `.env.example` a `.env.local` y completa:

   ```env
   VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
   VITE_SUPABASE_ANON_KEY=TU-CLAVE-PUBLICA
   ```

3. Aplica las migraciones de `supabase/migrations/` en orden: `202609200001_foundation.sql`, `202609200002_task_recurrence.sql`, `202609240003_reminder_timezone.sql`, `202609240004_sync.sql` y `202610040005_web_push.sql`. Ejecuta sólo las pendientes. La cuarta conserva los datos existentes y exige la RPC para escrituras de clientes; la quinta añade suscripciones y reservas de Web Push. El repositorio ya tiene configuración CLI; también puedes usar `npx supabase link --project-ref TU-PROYECTO` y `npx supabase db push`.
4. En Auth → URL Configuration configura Site URL y redirect URLs del entorno, incluyendo `http://localhost:5173/` y `http://localhost:5173/auth/update-password`.
5. Activa email/contraseña y confirmación por email; configura SMTP antes de producción. Usa una contraseña mínima de 12 caracteres también en la política del servidor.
6. Reinicia Vite. Registro, login, logout, restauración de sesión y recuperación ya utilizan el servicio real. Con PKCE, abre el enlace de confirmación/recuperación en el mismo navegador donde lo solicitaste.

Las variables `VITE_*` son públicas. Nunca uses `service_role` ni secretos. `.env` y `.env.*` están ignorados, con excepción de `.env.example`. La configuración de este ordenador contiene únicamente la URL y clave pública del proyecto alojado; las claves administrativas no se guardan en el frontend.

RLS se aplica a todas las tablas privadas. Las relaciones incluyen propietario; DELETE está revocado para clientes. El cierre de sesión mantiene IndexedDB para conservar cambios pendientes y los repositorios aíslan los datos por UUID de usuario. Consulta [base de datos](docs/database.md).

## Comprobaciones

```sh
npm run typecheck
npm run lint
npm test
npx playwright install chromium
npm run test:e2e
npm run build
npm run format:check
```

`npm run test:watch` abre Vitest en modo observación. `npm run format` formatea el proyecto.

Las pruebas de repositorios cubren transacciones, cola, rollback, aislamiento por cuenta, borrado lógico, persistencia y concurrencia. Las pruebas SQL ejecutan la migración en PGlite con un esquema de Auth simulado y comprueban RLS y restricciones reales de PostgreSQL. Los componentes verifican formularios y rutas protegidas. Playwright cubre escritorio y tamaño móvil, modo oscuro persistente, navegación, diálogo, 320 px y desconexión.

Los E2E de Foundation ejecutan sin backend; los módulos privados pasan por el formulario de login y el cliente Supabase, con respuestas HTTP interceptadas exclusivamente en Playwright para un dominio de prueba. Cubren creación, edición, persistencia, desconexión, filtros, eliminación e independencia de cuentas en desktop y móvil. Las notas verifican formato y autoguardado; el calendario comprueba fechas, eventos de varios días, series, tareas y protección de cambios sin guardar. Los escenarios de sincronización ejecutan las RPC SQL en PGlite y comprueban dos instalaciones independientes, conflictos y recuperación de fallos. No hay bypass de autenticación en la aplicación. Además, `npm run test:local` comprueba Auth, correos capturados en Mailpit, RPC, WebSocket Realtime y aislamiento RLS contra Supabase local real en Docker, sin interceptar HTTP. Consulta [los resultados y límites de verificación](docs/verification.md).

## Inbox, etiquetas y búsqueda

En **Inbox**, escribe y pulsa Enter. **Organizar** permite editar, eliminar o convertir la captura a tarea, nota, evento o recordatorio; para los dos últimos indica las fechas. La conversión conserva el texto y retira la captura sólo después de guardar su destino.

En **Etiquetas**, crea un nombre/color y asígnalo desde el editor de una nota, tarea o evento guardado. **Ver elementos** filtra la búsqueda por esa etiqueta. Eliminar etiquetas conserva sus documentos.

**Buscar** en la navegación o **Ctrl/Cmd+K** fuera de campos abre resultados agrupados. Consulta títulos, contenido, descripciones y etiquetas, sin distinguir acentos o mayúsculas. Puedes filtrar por tipo/etiqueta e incluir notas archivadas. La búsqueda funciona sobre los datos locales, también sin conexión. Consulta [comportamiento, atomicidad y límites](docs/inbox-search-tags.md).

## Uso de Hoy

Después de iniciar sesión, `/` abre **Hoy**. Puedes añadir una tarea para el día actual y completarla desde el panel. Las vencidas aparecen separadas; eventos y recordatorios abren sus editores al pulsarlos. Los próximos recordatorios abarcan siete días civiles, incluido hoy, con una próxima ocurrencia por recordatorio. Fecha, horarios y límites del día siguen la zona de preferencias. Consulta [Hoy y sus criterios](docs/dashboard.md).

## Uso de tareas

Después de iniciar sesión, abre **Tareas** (`/tasks`). Escribe y pulsa Enter para capturar; **Nueva tarea** permite añadir detalles. Pulsa sobre una fila para editarla y gestionar sus subtareas. La casilla completa o reabre; el formulario permite cancelar o poner en progreso. El borrado necesita confirmación y conserva tombstones.

Las vistas Pendientes, Hoy, Vencidas, Completadas, Canceladas y Todas combinan búsqueda por título/descripción con filtros de prioridad/estado y orden. Los límites sin hora duran todo el día en la zona de preferencias; los límites con hora son instantes UTC.

La repetición crea la siguiente ocurrencia al completar, conserva el historial y copia las subtareas sin completar. Reabrir y volver a completar no duplica la siguiente tarea. Las reglas son RRULE estándar (diaria/semanal/mensual/anual), con presets y edición avanzada. Consulta [tareas y recurrencias](docs/tasks.md) para los límites y decisiones.

## Uso de notas

Después de iniciar sesión, abre **Notas** (`/notes`) o **Creación rápida → Nota**. Escribe un título opcional y pulsa Enter. El editor admite párrafos, títulos, negrita, cursiva, listas, checklist, enlaces web/correo, citas y bloques de código. Los cambios se guardan en IndexedDB tras 600 ms sin editar y también al cerrar o navegar.

Puedes elegir color, fijar, archivar/restaurar y eliminar con confirmación. La búsqueda local consulta título y contenido, ignorando mayúsculas y acentos. Las vistas Mis notas, Fijadas y Archivo separan las notas activas de las archivadas.

Ante un error, el borrador permanece visible y puedes reintentar. Si otra pestaña cambió la nota, **Guardar como copia** conserva ambas versiones. Espera a **Guardado en este dispositivo** antes de cerrar el navegador; ese estado no implica sincronización remota. Consulta [notas y autoguardado](docs/notes.md). Esta fase reutiliza la tabla `notes` existente y no requiere una migración nueva.

## Uso del calendario

Abre **Calendario** (`/calendar`). La vista **Mes** muestra seis semanas y la **Agenda** reúne los elementos del mes. **Semana** y **Día** muestran un horario de 24 horas y una fila para elementos sin hora. Puedes avanzar por el periodo elegido, saltar a una fecha con el selector o volver a Hoy; la vista y la fecha quedan en la URL. Selecciona un día del mes para ver sus detalles debajo; en móvil, las casillas muestran cantidades y la agenda del día ofrece los títulos completos. El inicio de semana, la zona de visualización y el formato horario siguen tus preferencias.

**Nuevo evento** y **Creación rápida → Evento** abren el formulario. Indica título, fechas, horas o Todo el día, zona horaria, lugar, descripción y repetición opcional. El último día de un evento de día completo se incluye en el formulario y se almacena como un final exclusivo. Guarda explícitamente; se advierte antes de descartar cambios. Editar o eliminar una repetición afecta a **toda la serie** en esta fase.

Los filtros permiten mostrar eventos, tareas, recordatorios e incluir tareas completadas. Pulsar un elemento abre su editor. Sólo se proyectan las ocurrencias de tareas ya creadas al completar sus antecesoras. Los recordatorios recurrentes se expanden para la ventana visible.

Consulta [calendario y eventos](docs/calendar.md) para las decisiones sobre zonas, recurrencias y límites. Se reutiliza la tabla `events`, los adaptadores de persistencia y la migración Foundation; no hay una migración nueva ni dependencias añadidas.

## Elementos relacionados

Los editores de notas, tareas y eventos guardados incluyen **Elementos relacionados** para vincularlos, abrirlos y desvincularlos sin eliminar su contenido, también sin conexión. Consulta [relaciones y protección de borradores](docs/relations.md).

## Build y despliegue

Consulta también [recordatorios y notificaciones](docs/reminders.md): abre **Recordatorios → Nuevo recordatorio**, indica fecha, hora, zona, repetición y asociación opcional. Desde tareas, notas y eventos puedes usar **Crear recordatorio**. La configuración permite gestionar permisos y avisos nativos o activar **Web Push** en la PWA de producción. El servidor alojado comprueba los recordatorios sincronizados cada minuto. Consulta [activación y despliegue de Web Push](docs/web-push.md); la suscripción no garantiza la entrega.

```sh
npm run build
npm run preview
```

La salida está en `dist/`. Un hosting estático debe resolver las rutas de la SPA hacia `index.html` y servir HTTPS. No se ha desplegado la aplicación. Configura las variables públicas antes de compilar.

## Arquitectura y siguientes fases

- [Inspección y plan de nueve fases](docs/implementation-plan.md)
- [Arquitectura y decisiones](docs/architecture.md)
- [Esquema y seguridad](docs/database.md)
- [Contrato de sincronización](docs/sync.md)

La UI observa Dexie a través de servicios y repositorios; no escribe tablas de Supabase directamente. Dexie guarda entidad y operación en una transacción. `SyncEngine` envía la cola mediante RPC, recupera páginas del historial y usa Realtime para despertar nuevas descargas. En **Configuración → Sincronización** puedes reintentar, exportar cambios pendientes, revisar/restaurar copias de conflictos y ver dispositivos. Los rechazos y errores no borran cambios locales. Consulta [el protocolo, límites y recuperación](docs/sync.md).

## PWA y Capacitor

Para conectar Android al Supabase de este ordenador, usa la variante **Dayflow Local**: [compilación, instalación y conexión por USB/emulador](docs/android-local.md). Tiene identificador y recursos propios; el APK habitual de fase 9 se conserva por separado. Se han verificado en emulador registro/PKCE, sincronización con la web, entrega de avisos en segundo plano y cancelación/retirada al cerrar sesión.

Con el APK compilado y un Android autorizado por USB: `npm run android:device -- check` comprueba el entorno y `npm run android:device -- install` instala y conecta la app. Usa `connect` para restablecer el túnel tras reconectar el cable. Si hay varios dispositivos, añade el SERIAL.

Compila con `npm run build` y sirve `dist/` mediante HTTPS (o `npm run preview` en localhost). En **Configuración → Instalación y actualizaciones** puedes instalar Dayflow cuando el navegador lo permita y comprobar nuevas versiones. Espera a **Lista para abrir sin conexión** antes de desconectarte. El acceso privado requiere una sesión guardada que pueda restaurarse; si necesita renovarse, tendrás que recuperar conexión.

Las actualizaciones esperan a que cierres todas las ventanas de Dayflow. La caché contiene sólo archivos públicos de la aplicación; los datos personales siguen en IndexedDB. En desarrollo y dentro de Capacitor no se registra el worker.

```sh
npm run icons
npm run native:sync
npm run native:android
# En macOS:
npm run native:ios
```

Los proyectos `android/` e `ios/` usan `com.dayflow.app`, nombre Dayflow y recursos compilados en `dist/`. Android necesita JDK 21 y SDK 36; iOS requiere macOS/Xcode 26 y usa Swift Package Manager. Configura Supabase antes de compilar para activar cuentas. Los redirects nativos son `dayflow://auth/callback` y `dayflow://auth/callback?next=recovery`; deben estar permitidos en Supabase.

`npm run test:pwa` verifica dos builds de producción: instalación, arranque sin red, actualización entre ventanas y aislamiento tras logout. Consulta [PWA, proyectos nativos y despliegue](docs/pwa-native.md) para compilación, caché, permisos, callbacks y límites.

El plan de nueve fases queda implementado como base de desarrollo. El siguiente paso recomendado es validar Supabase alojado, iOS y entrega de notificaciones en dispositivos reales, y preparar firma y distribución.

## Referencias oficiales consultadas

La [web HTTPS publicada](https://dayflow-productividad.gptgonzaleznavarrete.chatgpt.site) tiene acceso privado mediante Sites. La [guía de validación de publicación y dispositivos](docs/release-validation.md) contiene el APK actualizado, los pasos de correo real y las comprobaciones pendientes en Safari y hardware físico.

- [Vite: guía de inicio](https://vite.dev/guide/)
- [Supabase: eventos de autenticación](https://supabase.com/docs/reference/javascript/auth-onauthstatechange)
- [Dexie: transacciones](<https://dexie.org/docs/Dexie/Dexie.transaction()>)
- [rrule: reglas y fechas UTC](https://github.com/jkbrzt/rrule)
- [Temporal: zona horaria y desambiguación](https://tc39.es/proposal-temporal/docs/zoneddatetime.html)
- [TipTap: integración React](https://tiptap.dev/docs/editor/getting-started/install/react)
- [TipTap: StarterKit](https://tiptap.dev/docs/editor/extensions/functionality/starterkit)
