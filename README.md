# Dayflow

Una aplicaciÃ³n personal para organizar notas, tareas, calendario y recordatorios, disponible como web, PWA y aplicaciÃ³n Android. En iOS, el alcance actual es Safari y PWA.

**Web publicada:** [Dayflow en Vercel](https://dayflow-by-shadowstudio.vercel.app/auth/login).

Incluye notas, tareas, vistas de calendario de mes/semana/dÃ­a, recordatorios, relaciones, Dashboard, Inbox, bÃºsqueda, etiquetas y perfil con estadÃ­sticas. Ofrece sincronizaciÃ³n con Supabase, instalaciÃ³n como PWA, arranque offline, actualizaciones sin interrumpir borradores y proyectos nativos de Capacitor. El 13 de noviembre de 2026 se verificaron en Chrome y Edge sobre Windows 11 25H2 la actualizaciÃ³n de la PWA instalada a `322f123` con sesiÃ³n, datos y borrador conservados, y la persistencia y sincronizaciÃ³n de la cola tras una interrupciÃ³n de red. La confirmaciÃ³n y recuperaciÃ³n por correo y Web Push cuentan con validaciÃ³n manual documentada en Vercel. El 18 de noviembre de 2026 se completaron el alta y la recuperaciÃ³n por cÃ³digo en Vercel con Brevo y un buzÃ³n externo. La APK integrada de Android y la PWA instalada en Chrome cuentan con pruebas fÃ­sicas documentadas en el Redmi Note 11S. Quedan pendientes la firma y distribuciÃ³n de la APK y la entrega mientras el telÃ©fono sigue en Doze profundo. La aplicaciÃ³n nativa iOS estÃ¡ descartada del alcance actual. Consulta la [validaciÃ³n de publicaciÃ³n](docs/release-validation.md) y la [configuraciÃ³n de Vercel](docs/vercel.md).

El 16 de noviembre de 2026 se verificaron en Safari 18.6 sobre macOS 15.7.9 la persistencia de sesiÃ³n, la cola offline y su envÃ­o automÃ¡tico, y los permisos y la recepciÃ³n de Web Push. La PWA del Dock conservÃ³ sesiÃ³n, datos y una nota guardada al reabrir con y sin red. El recorrido incluyÃ³ relaciones persistidas y revisiÃ³n de ocho pantallas a 320 px en un iframe de Safari. El 18 de noviembre el usuario confirmÃ³ la detecciÃ³n de una actualizaciÃ³n en la PWA del Dock y su reapertura a las 09:00 CET conservando sesiÃ³n y nota guardada; despuÃ©s volviÃ³ a estar lista sin conexiÃ³n y dejÃ³ de ofrecer la actualizaciÃ³n. Los SHA de los workers de partida y destino no se identificaron directamente. [AuditorÃ­a de macOS](docs/audits/2026-11-16-pwa-macos.md).

El 18 de noviembre de 2026, el propietario confirmÃ³ en un iPhone 11 con iOS 27.2.1 declarada la instalaciÃ³n nueva de la PWA, apertura independiente, persistencia de sesiÃ³n, ediciÃ³n offline, sincronizaciÃ³n con Chrome del Mac sin duplicados, aislamiento entre cuentas, reanudaciÃ³n tras 64 minutos y recepciÃ³n/apertura de Web Push. La actualizaciÃ³n real A â B y el recorrido separado en pestaÃ±a de Safari siguen pendientes. [AuditorÃ­a del iPhone y lÃ­mites](docs/audits/2026-11-18-pwa-ios.md).

## Inicio rÃ¡pido

Requisito recomendado: Node.js 24 LTS con npm. Desde esta carpeta:

```sh
npm ci
npm run dev
```

Abre la direcciÃ³n que imprime Vite (habitualmente `http://localhost:5173`). Sin variables de Supabase, `/` abre `/setup`, una vista pÃºblica de preparaciÃ³n sin datos personales. Puedes explorar la navegaciÃ³n y cambiar apariencia/preferencias sin crear una cuenta.

**Para usar cuentas y sincronizaciÃ³n sin un proyecto Supabase:** abre Docker Desktop y ejecuta `npm run backend:start` antes de iniciar Vite. Abre <http://127.0.0.1:5173> y crea tu cuenta; confirma el email desde el [buzÃ³n local](http://127.0.0.1:54324), en el mismo navegador. Consulta [arranque, pruebas y lÃ­mites del backend local](docs/local-backend.md).

## Stack

React 19, TypeScript 6 estricto, Vite 8, React Router 7, TanStack Query 5, Zustand 5, React Hook Form, Zod 4, Tailwind CSS 4, Lucide, Supabase JS 2, Dexie 4, TipTap 3, rrule y Temporal polyfill para fechas y zonas horarias. Pruebas: Vitest, React Testing Library, fake-indexeddb, PostgreSQL embebido PGlite y Playwright. Lint: Oxlint. Formato: Prettier. Versiones exactas reproducibles en `package-lock.json`.

## Supabase y variables de entorno

Para un proyecto alojado (alternativa al [backend local](docs/local-backend.md)):

Consulta la [guÃ­a de conexiÃ³n a Supabase alojado](docs/hosted-backend.md), con acceso administrativo, revisiÃ³n de migraciones, URLs de Auth y verificaciÃ³n entre clientes.

1. Crea un proyecto de desarrollo Supabase.
2. Copia `.env.example` a `.env.local` y completa:

   ```env
   VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
   VITE_SUPABASE_ANON_KEY=TU-CLAVE-PUBLICA
   ```

3. Aplica las migraciones de `supabase/migrations/` en orden: `202609200001_foundation.sql`, `202609200002_task_recurrence.sql`, `202609240003_reminder_timezone.sql`, `202609240004_sync.sql`, `202610040005_web_push.sql`, `202610090006_security_privileges.sql` y `202610120007_sync_hardening.sql`. Ejecuta sÃ³lo las pendientes. La cuarta conserva los datos existentes y exige la RPC para escrituras de clientes; la quinta aÃ±ade suscripciones y reservas de Web Push; la sexta retira permisos sobrantes de triggers y exige permisos explÃ­citos de cliente para nuevos objetos. La sÃ©ptima endurece las versiones, fechas y permisos de sincronizaciÃ³n. Su aplicaciÃ³n en Supabase alojado se verificÃ³ el 13 de noviembre de 2026 con 74/74 comprobaciones de historial y catÃ¡logo. Consulta la [auditorÃ­a SQL](docs/audits/2026-10-12-sql-hardening.md#estado-del-despliegue). El repositorio ya tiene configuraciÃ³n CLI; tambiÃ©n puedes usar `npx supabase link --project-ref TU-PROYECTO` y `npx supabase db push`.
4. En Auth â URL Configuration configura Site URL y redirect URLs del entorno, incluyendo `http://localhost:5173/` y `http://localhost:5173/auth/update-password`.
5. Activa email/contraseÃ±a y confirmaciÃ³n por email; configura [SMTP propio para destinatarios externos](docs/auth-smtp.md) antes de ampliar la beta. Usa una contraseÃ±a mÃ­nima de 12 caracteres tambiÃ©n en la polÃ­tica del servidor.
6. Reinicia Vite. Registro, login, logout, restauraciÃ³n de sesiÃ³n y recuperaciÃ³n utilizan el servicio real. Con las plantillas de Brevo, introduce el cÃ³digo en Dayflow. Si el mensaje contiene un enlace PKCE, Ã¡brelo en el mismo navegador y perfil donde lo solicitaste.

Las variables `VITE_*` son pÃºblicas. Nunca uses `service_role` ni secretos. `.env` y `.env.*` estÃ¡n ignorados, con excepciÃ³n de `.env.example`. La configuraciÃ³n de este ordenador contiene Ãºnicamente la URL y clave pÃºblica del proyecto alojado; las claves administrativas no se guardan en el frontend.

**Correo de la beta externa:** Brevo estÃ¡ activo. El propietario confirmÃ³ el alta y la recuperaciÃ³n por cÃ³digo con un buzÃ³n ajeno al equipo de Supabase en Vercel. Gmail mostrÃ³ SPF, DKIM y DMARC en PASS para un mensaje recibido. En una segunda ronda con Outlook, el correo llegÃ³ a No deseado y se completaron el alta y el cambio de contraseÃ±a. Consulta la [evidencia de la prueba](docs/auth-smtp.md).

RLS se aplica a todas las tablas privadas. Las relaciones incluyen propietario; DELETE estÃ¡ revocado para clientes. El cierre de sesiÃ³n mantiene IndexedDB para conservar cambios pendientes y los repositorios aÃ­slan los datos por UUID de usuario. Consulta [base de datos](docs/database.md).

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

`npm run test:watch` abre Vitest en modo observaciÃ³n. `npm run format` formatea el proyecto.

Las pruebas de repositorios cubren transacciones, cola, rollback, aislamiento por cuenta, borrado lÃ³gico, persistencia y concurrencia. Las pruebas SQL ejecutan la migraciÃ³n en PGlite con un esquema de Auth simulado y comprueban RLS y restricciones reales de PostgreSQL. Los componentes verifican formularios y rutas protegidas. Playwright cubre escritorio y tamaÃ±o mÃ³vil, modo oscuro persistente, navegaciÃ³n, diÃ¡logo, 320 px y desconexiÃ³n.

Los E2E de Foundation ejecutan sin backend; los mÃ³dulos privados pasan por el formulario de login y el cliente Supabase, con respuestas HTTP interceptadas exclusivamente en Playwright para un dominio de prueba. Cubren creaciÃ³n, ediciÃ³n, persistencia, desconexiÃ³n, filtros, eliminaciÃ³n e independencia de cuentas en desktop y mÃ³vil. Las notas verifican formato y autoguardado; el calendario comprueba fechas, eventos de varios dÃ­as, series, tareas y protecciÃ³n de cambios sin guardar. Los escenarios de sincronizaciÃ³n ejecutan las RPC SQL en PGlite y comprueban dos instalaciones independientes, conflictos y recuperaciÃ³n de fallos. No hay bypass de autenticaciÃ³n en la aplicaciÃ³n. AdemÃ¡s, `npm run test:local` comprueba Auth, correos capturados en Mailpit, RPC, WebSocket Realtime y aislamiento RLS contra Supabase local real en Docker, sin interceptar HTTP. Consulta [los resultados y lÃ­mites de verificaciÃ³n](docs/verification.md).

## Inbox, etiquetas y bÃºsqueda

En **Inbox**, escribe y pulsa Enter. **Organizar** permite editar, eliminar o convertir la captura a tarea, nota, evento o recordatorio; para los dos Ãºltimos indica las fechas. La conversiÃ³n conserva el texto y retira la captura sÃ³lo despuÃ©s de guardar su destino.

En **Etiquetas**, crea un nombre/color y asÃ­gnalo desde el editor de una nota, tarea o evento guardado. **Ver elementos** filtra la bÃºsqueda por esa etiqueta. Eliminar etiquetas conserva sus documentos.

**Buscar** en la navegaciÃ³n o **Ctrl/Cmd+K** fuera de campos abre resultados agrupados. Consulta tÃ­tulos, contenido, descripciones y etiquetas, sin distinguir acentos o mayÃºsculas. Puedes filtrar por tipo/etiqueta e incluir notas archivadas. La bÃºsqueda funciona sobre los datos locales, tambiÃ©n sin conexiÃ³n. Consulta [comportamiento, atomicidad y lÃ­mites](docs/inbox-search-tags.md).

## Uso de Hoy

DespuÃ©s de iniciar sesiÃ³n, `/` abre **Hoy**. Puedes aÃ±adir una tarea para el dÃ­a actual y completarla desde el panel. Las vencidas aparecen separadas; eventos y recordatorios abren sus editores al pulsarlos. Los prÃ³ximos recordatorios abarcan siete dÃ­as civiles, incluido hoy, con una prÃ³xima ocurrencia por recordatorio. Fecha, horarios y lÃ­mites del dÃ­a siguen la zona de preferencias. Consulta [Hoy y sus criterios](docs/dashboard.md).

## Uso de tareas

DespuÃ©s de iniciar sesiÃ³n, abre **Tareas** (`/tasks`). Escribe y pulsa Enter para capturar; **Nueva tarea** permite aÃ±adir detalles. Pulsa sobre una fila para editarla y gestionar sus subtareas. La casilla completa o reabre; el formulario permite cancelar o poner en progreso. El borrado necesita confirmaciÃ³n y conserva tombstones.

Las vistas Pendientes, Hoy, Vencidas, Completadas, Canceladas y Todas combinan bÃºsqueda por tÃ­tulo/descripciÃ³n con filtros de prioridad/estado y orden. Los lÃ­mites sin hora duran todo el dÃ­a en la zona de preferencias; los lÃ­mites con hora son instantes UTC.

La repeticiÃ³n crea la siguiente ocurrencia al completar, conserva el historial y copia las subtareas sin completar. Reabrir y volver a completar no duplica la siguiente tarea. Las reglas son RRULE estÃ¡ndar (diaria/semanal/mensual/anual), con presets y ediciÃ³n avanzada. Consulta [tareas y recurrencias](docs/tasks.md) para los lÃ­mites y decisiones.

## Uso de notas

DespuÃ©s de iniciar sesiÃ³n, abre **Notas** (`/notes`) o **CreaciÃ³n rÃ¡pida â Nota**. Escribe un tÃ­tulo opcional y pulsa Enter. El editor admite pÃ¡rrafos, tÃ­tulos, negrita, cursiva, listas, checklist, enlaces web/correo, citas y bloques de cÃ³digo. Los cambios se guardan en IndexedDB tras 600 ms sin editar y tambiÃ©n al cerrar o navegar.

Puedes elegir color, fijar, archivar/restaurar y eliminar con confirmaciÃ³n. La bÃºsqueda local consulta tÃ­tulo y contenido, ignorando mayÃºsculas y acentos. Las vistas Mis notas, Fijadas y Archivo separan las notas activas de las archivadas.

Ante un error, el borrador permanece visible y puedes reintentar. Si otra pestaÃ±a cambiÃ³ la nota, **Guardar como copia** conserva ambas versiones. Espera a **Guardado en este dispositivo** antes de cerrar el navegador; ese estado no implica sincronizaciÃ³n remota. Consulta [notas y autoguardado](docs/notes.md). Esta fase reutiliza la tabla `notes` existente y no requiere una migraciÃ³n nueva.

## Uso del calendario

Abre **Calendario** (`/calendar`). La vista **Mes** muestra seis semanas y la **Agenda** reÃºne los elementos del mes. **Semana** y **DÃ­a** muestran un horario de 24 horas y una fila para elementos sin hora. Puedes avanzar por el periodo elegido, saltar a una fecha con el selector o volver a Hoy; la vista y la fecha quedan en la URL. Selecciona un dÃ­a del mes para ver sus detalles debajo; en mÃ³vil, las casillas muestran cantidades y la agenda del dÃ­a ofrece los tÃ­tulos completos. El inicio de semana, la zona de visualizaciÃ³n y el formato horario siguen tus preferencias.

**Nuevo evento** y **CreaciÃ³n rÃ¡pida â Evento** abren el formulario. Indica tÃ­tulo, fechas, horas o Todo el dÃ­a, zona horaria, lugar, descripciÃ³n y repeticiÃ³n opcional. El Ãºltimo dÃ­a de un evento de dÃ­a completo se incluye en el formulario y se almacena como un final exclusivo. Guarda explÃ­citamente; se advierte antes de descartar cambios. Editar o eliminar una repeticiÃ³n afecta a **toda la serie** en esta fase.

Los filtros permiten mostrar eventos, tareas, recordatorios e incluir tareas completadas. Pulsar un elemento abre su editor. SÃ³lo se proyectan las ocurrencias de tareas ya creadas al completar sus antecesoras. Los recordatorios recurrentes se expanden para la ventana visible.

Consulta [calendario y eventos](docs/calendar.md) para las decisiones sobre zonas, recurrencias y lÃ­mites. Se reutiliza la tabla `events`, los adaptadores de persistencia y la migraciÃ³n Foundation; no hay una migraciÃ³n nueva ni dependencias aÃ±adidas.

## Elementos relacionados

Los editores de notas, tareas y eventos guardados incluyen **Elementos relacionados** para vincularlos, abrirlos y desvincularlos sin eliminar su contenido, tambiÃ©n sin conexiÃ³n. Consulta [relaciones y protecciÃ³n de borradores](docs/relations.md).

## Build y despliegue

Consulta tambiÃ©n [recordatorios y notificaciones](docs/reminders.md): abre **Recordatorios â Nuevo recordatorio**, indica fecha, hora, zona, repeticiÃ³n y asociaciÃ³n opcional. Desde tareas, notas y eventos puedes usar **Crear recordatorio**. La configuraciÃ³n permite gestionar permisos y avisos nativos o activar **Web Push** en la PWA de producciÃ³n. El servidor alojado comprueba los recordatorios sincronizados cada minuto. Consulta [activaciÃ³n y despliegue de Web Push](docs/web-push.md); la suscripciÃ³n no garantiza la entrega.

```sh
npm run build
npm run preview
```

La salida estÃ¡ en `dist/`. Un hosting estÃ¡tico debe resolver las rutas de la SPA hacia `index.html` y servir HTTPS. La web publicada estÃ¡ alojada en Vercel. Configura las variables pÃºblicas antes de compilar.

## Arquitectura y siguientes fases

- [InspecciÃ³n y plan de nueve fases](docs/implementation-plan.md)
- [Arquitectura y decisiones](docs/architecture.md)
- [Esquema y seguridad](docs/database.md)
- [Contrato de sincronizaciÃ³n](docs/sync.md)

La UI observa Dexie a travÃ©s de servicios y repositorios; no escribe tablas de Supabase directamente. Dexie guarda entidad y operaciÃ³n en una transacciÃ³n. `SyncEngine` envÃ­a la cola mediante RPC, recupera pÃ¡ginas del historial y usa Realtime para despertar nuevas descargas. En **ConfiguraciÃ³n â SincronizaciÃ³n** puedes reintentar, exportar cambios pendientes, revisar/restaurar copias de conflictos y ver dispositivos. Los rechazos y errores no borran cambios locales. Consulta [el protocolo, lÃ­mites y recuperaciÃ³n](docs/sync.md).

## PWA y Capacitor

Para conectar Android al Supabase de este ordenador, usa la variante **Dayflow Local**: [compilaciÃ³n, instalaciÃ³n y conexiÃ³n por USB/emulador](docs/android-local.md). Tiene identificador y recursos propios; el APK habitual de fase 9 se conserva por separado. Se han verificado en emulador registro/PKCE, sincronizaciÃ³n con la web, entrega de avisos en segundo plano y cancelaciÃ³n/retirada al cerrar sesiÃ³n.

Con el APK compilado y un Android autorizado por USB: `npm run android:device -- check` comprueba el entorno y `npm run android:device -- install` instala y conecta la app. Usa `connect` para restablecer el tÃºnel tras reconectar el cable. Si hay varios dispositivos, aÃ±ade el SERIAL.

Compila con `npm run build` y sirve `dist/` mediante HTTPS (o `npm run preview` en localhost). En **ConfiguraciÃ³n â InstalaciÃ³n y actualizaciones** puedes instalar Dayflow cuando el navegador lo permita y comprobar nuevas versiones. Espera a **Lista para abrir sin conexiÃ³n** antes de desconectarte. El acceso privado requiere una sesiÃ³n guardada que pueda restaurarse; si necesita renovarse, tendrÃ¡s que recuperar conexiÃ³n.

Las actualizaciones esperan a que cierres todas las ventanas de Dayflow. La cachÃ© contiene sÃ³lo archivos pÃºblicos de la aplicaciÃ³n; los datos personales siguen en IndexedDB. En desarrollo y dentro de Capacitor no se registra el worker.

```sh
npm run icons
npm run native:sync
npm run native:android
# En macOS:
npm run native:ios
```

Los proyectos `android/` e `ios/` usan `com.dayflow.app`, nombre Dayflow y recursos compilados en `dist/`. Android necesita JDK 21 y SDK 36; iOS requiere macOS/Xcode 26 y usa Swift Package Manager. Configura Supabase antes de compilar para activar cuentas. Los redirects nativos son `dayflow://auth/callback` y `dayflow://auth/callback?next=recovery`; deben estar permitidos en Supabase.

`npm run test:pwa` verifica dos builds de producciÃ³n: instalaciÃ³n, arranque sin red, actualizaciÃ³n entre ventanas y aislamiento tras logout. Consulta [PWA, proyectos nativos y despliegue](docs/pwa-native.md) para compilaciÃ³n, cachÃ©, permisos, callbacks y lÃ­mites.

El plan de nueve fases queda implementado como base de desarrollo. Quedan pendientes completar la validaciÃ³n de Safari/PWA en dispositivos Apple y la firma y distribuciÃ³n de Android. El 15 de noviembre se confirmaron en el Redmi Note 11S la instalaciÃ³n, el guion de arranque offline y persistencia, y la reanudaciÃ³n de la PWA tras una hora con los cambios conservados. La actualizaciÃ³n de `5e5107ff` a `dd0ec83` en Chrome Android conservÃ³ la sesiÃ³n, los datos locales y el borrador al cerrar y reabrir la PWA. [AuditorÃ­a de PWA mÃ³vil](docs/audits/2026-10-12-pwa-mobile.md).

## Referencias oficiales consultadas

La [web principal](https://dayflow-by-shadowstudio.vercel.app/auth/login) estÃ¡ publicada en Vercel. El alojamiento anterior en Sites se conserva como referencia histÃ³rica. La [guÃ­a de validaciÃ³n de publicaciÃ³n y dispositivos](docs/release-validation.md) recoge las compilaciones probadas, los pasos de correo real y las comprobaciones pendientes en Safari y hardware fÃ­sico.

- [Vite: guÃ­a de inicio](https://vite.dev/guide/)
- [Supabase: eventos de autenticaciÃ³n](https://supabase.com/docs/reference/javascript/auth-onauthstatechange)
- [Dexie: transacciones](<https://dexie.org/docs/Dexie/Dexie.transaction()>)
- [rrule: reglas y fechas UTC](https://github.com/jkbrzt/rrule)
- [Temporal: zona horaria y desambiguaciÃ³n](https://tc39.es/proposal-temporal/docs/zoneddatetime.html)
- [TipTap: integraciÃ³n React](https://tiptap.dev/docs/editor/getting-started/install/react)
- [TipTap: StarterKit](https://tiptap.dev/docs/editor/extensions/functionality/starterkit)

## DocumentaciÃ³n y CI

El [estado vigente del 12 de octubre de 2026](docs/audits/2026-10-12-ci-deployment.md)
vincula CI y producciÃ³n con el SHA `b7b2a69c2cab8c8c630783a0c7b3585f0a9597d6`:
296 unitarias, 106 E2E y 20 PWA correctos; Vercel READY. Incluye fechas, jobs,
artefactos y evidencia conservada, sin extender estos resultados a cambios posteriores.

Consulta el [Ã­ndice documental](docs/README.md), la [auditorÃ­a](docs/audits/README.md) y la [polÃ­tica de notificaciones](docs/notifications-policy.md). Ejecuta `npm run docs:check` y `npm run test:docs` antes de enviar cambios. GitHub Actions valida documentaciÃ³n, TypeScript, lint, formato, unitarias, build, E2E y PWA en PR y push a main.

## Avisos prioritarios en Android

El modo opcional **Avisos prioritarios en este dispositivo** usa alarmas de reloj de Android y estÃ¡ desactivado por defecto. La preferencia es local por cuenta y dispositivo. El PR #11 integrÃ³ la implementaciÃ³n y el parche reproducible de Capacitor en `main` (`b023b1f`). En la APK integrada `dd4ac54` se confirmÃ³ la recepciÃ³n de un aviso despuÃ©s de reiniciar y desbloquear, y la recuperaciÃ³n del permiso de notificaciones. El ensayo de Doze registrÃ³ la recepciÃ³n tras salir de `IDLE`. [GuÃ­a de avisos prioritarios](docs/android-priority-alarms.md) Â· [Resultados del Redmi Note 11S](docs/audits/2026-10-29-redmi-note11s.md#apk-integrada-del-14-y-15-de-noviembre-de-2026).
