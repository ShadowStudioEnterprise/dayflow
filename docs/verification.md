# Verificación — Fases 1–9, incluida PWA y Capacitor

## Consolidación documental — 9 de octubre de 2026

Ejecución local en Linux, Node 24.19.0, npm 11.9.0. Base inmutable: `a9f5d460964a79c5c84ab30ea94505a141a863c2`; árbol de trabajo de la rama `docs/ci-consolidation`, con cambios documentales y automatización. No se atribuyen estos resultados al commit base sin modificaciones. Huella SHA-256 de rutas y contenidos de los 11 archivos de implementación (excluye este registro): `1718b2724d17123d13ea9b5d5a4917894e7e2169bc6afc61f27591a1b07a6fd6`.

| Comprobación                        | Resultado nuevo                                                     | Código |
| ----------------------------------- | ------------------------------------------------------------------- | ------ |
| npm ci                              | Correcto, 614 paquetes                                              | 0      |
| npm run docs:check                  | Documentos, enlaces locales, anclas, índice y migraciones correctos | 0      |
| npm run test:docs                   | 3 pruebas correctas                                                 | 0      |
| npm run typecheck                   | Correcto                                                            | 0      |
| npm run lint                        | Correcto                                                            | 0      |
| npm test                            | 206 pruebas en 40 archivos, correctas                               | 0      |
| npm run build                       | Correcto, worker generado                                           | 0      |
| npm run format:check                | Correcto                                                            | 0      |
| npx playwright install chromium     | Descarga inválida, fallo al descomprimir                            | 1      |
| npm run test:e2e / npm run test:pwa | No ejecutados: Chromium no disponible                               | —      |

El build emite un aviso de importación dinámica/estática de Capacitor sin afectar su resultado. E2E y PWA quedan configuradas en CI para Chromium; no se declara una ejecución remota aprobada. Docker/Supabase real y dispositivos físicos no se han probado en esta ejecución.

Se incorporan [índice documental](README.md), [auditoría histórica](audits/README.md), [política de notificaciones](notifications-policy.md) y [workflow CI](../.github/workflows/ci.yml). El validador cubre enlaces Markdown inline y referencias explícitas, títulos ATX y migraciones enumeradas en database.md; no interpreta todo CommonMark, HTML, enlaces externos ni verifica exactitud semántica. Se retiraron cinco enlaces rotos a capturas históricas locales, conservando sus nombres y alcance.

## Evaluación sin dispositivo móvil — 3 de octubre de 2026

Se repitieron las comprobaciones sobre el código actual: **192 unitarias**, **92 E2E de navegador** y **10 PWA**, todas correctas, sin reintentos. TypeScript, lint, formato y build correctos; `npm audit --omit=dev` informó de cero vulnerabilidades conocidas.

Se amplió el comprobador alojado para verificar una relación nota–tarea entre dos navegadores, su retirada offline y la convergencia posterior, además de un evento visible en Semana y Día. También pasaron login, RPC, Realtime, aislamiento entre cuentas y logout. Se eliminaron las cuentas temporales y se verificó que no quedaban usuarios de prueba. No se enviaron correos.

La revisión visual a 1280 y 320 px permitió reducir el ancho mínimo del horario semanal de 1060 a 840 px para mostrar los siete días en el escritorio comprobado. Tras este cambio de CSS se repitieron las cuatro pruebas específicas de calendario, la comprobación alojada y el build: correctos. La suite PWA completa corresponde al código anterior a ese ajuste visual. No se realizaron pruebas nativas en esta evaluación.

El [informe de evaluación web](web-evaluation.md) recoge alcance, capturas, resultados y pendientes. El script y los artefactos de Supabase están en `.toolchains/hosted-verification.mjs`, `.toolchains/hosted-verification-result.json` y `.toolchains/web-evaluation/`; están ignorados y no contienen credenciales guardadas.

## Calendario semanal/diario y relaciones — 3 de octubre de 2026

Verificación de la continuación sobre el código actual:

- **192 pruebas unitarias en 36 archivos, todas correctas** (`npm test`). Incluyen navegación civil entre años y cambios horarios, agrupación de eventos nocturnos, horas repetidas, relaciones bidireccionales, IDs deterministas entre bases, aislamiento, restauración y rollback.
- **92 pruebas Playwright, todas correctas, sin reintentos** (`npm run test:e2e`). Los nuevos escenarios verifican Semana/Día, preferencias, filtros, creación, URL tras recarga, 320 px y relaciones entre los tres editores con borradores, autoguardado y desvinculación offline. También pasan los flujos previos de tareas, notas, recordatorios, sincronización, Inbox, búsqueda, etiquetas, Hoy y Foundation.
- TypeScript, lint, formato y build web/PWA correctos. El build genera el worker con 70 recursos precargados.

Se corrigió una carrera en el E2E de relaciones: capturaba la URL inmediatamente después del clic y podía guardar todavía `/inbox`. Ahora espera la ruta de la tarea antes de guardarla y continuar. Las cuatro pruebas registradas como fallidas al retomar el trabajo ya pasan; no fue necesario modificar el código de la aplicación durante esta verificación.

La documentación de [calendario](calendar.md) y [relaciones](relations.md) refleja las funciones y sus límites. No se repitieron las suites específicas PWA, Android ni Supabase alojado; la emulación móvil de Playwright no acredita dispositivos nativos. El build queda local, sin publicar.

## Verificación original de las fases

Entorno de ejecución: Windows, Node 24.18.0, npm 11.16.0.

- TypeScript estricto: `npm run typecheck`.
- Oxlint: `npm run lint`.
- Vitest: **182 pruebas en 34 archivos, todas correctas**. Repositorios, rollback, persistencia, concurrencia, esquemas, fechas, conversión de persistencia, formularios, rutas protegidas, recurrencias y migraciones/RLS PostgreSQL con PGlite. Reminders cubre programación/cancelación mediante un doble del adaptador nativo, error parcial y reintento sin duplicados, permisos, límite de 60 avisos, preferencias, aislamiento, versiones obsoletas, migración Dexie, zona SQL y exclusión de IDs locales de los DTO remotos. Sync añade convergencia entre bases locales, aislamiento remoto, idempotencia, respuesta perdida, paginación, conflictos, tombstones, desfase de reloj, recuperación de rechazos, abortos, reintentos y recurrencias simultáneas sin duplicados. Dashboard añade selección y orden temporal, zonas/DST, eventos solapados, próxima ocurrencia por recordatorio, aislamiento sin escrituras, carga/error/reintento/vacío y actualización al cruzar medianoche o recuperar foco. Fase 8 añade conversiones a los cuatro destinos, rechazo de destinos desconocidos sin consumir la captura, rollback y reintentos concurrentes, gestión/restauración de etiquetas, búsqueda por contenido/acentos/tipo/archivo/etiqueta, fallo con reintento y renderizado de texto sin interpretar HTML. Una prueba SQL comprueba convergencia de conversiones y restauración de asociaciones entre dos instalaciones. Fase 9 añade ciclo del worker, descarga fallida, reintento, instalación confirmada, exclusión del runtime nativo y validación/canje/deduplicación de callbacks PKCE.
- Playwright: **86 pruebas, todas correctas**; cinco escenarios de Foundation, cinco de tareas, ocho de notas, ocho de calendario, cuatro de recordatorios, tres de sincronización, cuatro de Dashboard y seis de Inbox/búsqueda/etiquetas, cada uno en Chromium desktop y Chromium con viewport/emulación móvil. Sync comprueba dos contextos de navegador con IndexedDB independiente, cambios offline, reconexión, borrado remoto, respuesta perdida después de confirmar SQL, fallo de servidor con cola conservada y restauración de una versión en conflicto. Dashboard comprueba captura/finalización offline, persistencia, datos combinados, enlaces a editores, medianoche, zona, tema oscuro, 320 px y cambio de cuenta. Fase 8 comprueba captura y conversión offline a los cuatro destinos, persistencia, búsqueda agrupada y teclado, etiquetas compartidas y filtros, conflictos entre pestañas y aislamiento de cuentas. No equivalen a pruebas en Safari/iOS nativo.
- PWA sobre producción: **10 pruebas adicionales**, cinco escenarios en Chromium desktop y móvil. Dos builds reales comprueban manifest/iconos e instalabilidad mediante CDP, caché pública, arranque en una ventana nueva sin red, módulos no visitados, persistencia, actualización en espera con dos ventanas y borrador, logout y 320 px en oscuro. Artefactos separados de la suite de desarrollo. No son pruebas de instalación en Safari/iOS.
- Revisión visual local: escritorio 1440 px, móvil 320 px y tema oscuro; listas y editores de tareas/notas/recordatorios, calendario mensual, agenda, formulario de eventos, sincronización, conflictos y Hoy. En esta fase se revisaron Inbox con datos, el diálogo de conversión, etiquetas, búsqueda agrupada en diálogo y página; sin desplazamiento horizontal ni errores de ejecución en página. Fase 9 añade revisión de la sección de instalación en escritorio y móvil oscuro, e iconos.
- Build: Vite con rutas por demanda y paquetes separados para React, Supabase y Zod; manifest y worker generado, 69 recursos precargados (~1,63 MiB). `npm run native:sync` correcto para Android e iOS con App y Local Notifications.
- Android: `assembleDebug --no-daemon` correcto con Temurin JDK 21 y SDK 36. APK debug generado en `android/app/build/outputs/apk/debug/app-debug.apk`. No es un paquete release firmado para publicación.
- Android en ejecución: APK instalado en emulador Android 15/API 35 con copia de AVD de sólo lectura. Se comprobaron arranque público, plugins App/Local Notifications disponibles, cero workers registrados, navegación a Configuración, Atrás en historial y diálogo, tema persistido y recarga con Wi-Fi/datos desactivados. Sin errores JavaScript ni desbordamiento horizontal. Se revisaron capturas; el emulador se cerró después. No se probó una cuenta real ni entrega de alarmas.
- iOS: proyecto Xcode y Swift Package Manager generados y sincronizados; compilación y ejecución pendientes de macOS/Xcode. No se declara un IPA validado.
- Prettier: `npm run format:check`.

Las suites anteriores usan Auth simulado: el esquema Auth de PGlite y el servicio de los tests de componentes son dobles; las cuatro migraciones SQL y sus políticas se ejecutan realmente en PostgreSQL embebido. Los E2E de módulos privados usan el formulario y el cliente de autenticación, con respuestas HTTP interceptadas sólo en Playwright, y realizan operaciones reales sobre IndexedDB. Los E2E de Sync conectan las RPC interceptadas al PostgreSQL embebido y usan un doble de Realtime; los otros módulos mantienen el backend de sincronización sin configurar. Las suites locales descritas abajo verifican servicios reales. Quedan pendientes las pruebas contra un proyecto alojado y entre dispositivos físicos, además de alarmas en teléfonos físicos/iOS y Web Push.

Durante la regresión se corrigieron dos carreras de navegación en los helpers E2E: se sigue el enlace a Tareas después del login y no se inicia una segunda carga de Configuración inmediatamente después de recargarla. La última ejecución completa verificó 85 de 86 escenarios; el restante se volvió a comprobar junto con los seis casos de Sync tras ajustar ese helper. No se activaron reintentos automáticos ni se cambió el comportamiento del producto para satisfacer estas pruebas.

## Integración local real — 27 de septiembre de 2026

Supabase CLI 2.118.0 y Docker Desktop: las cuatro migraciones se aplicaron a PostgreSQL 17. Auth, PostgREST, Realtime y Mailpit están activos. Los scripts de arranque/configuración usan sólo la clave pública para `.env.local` y conservan los datos al detener el backend.

`npm run test:local`: **2 escenarios correctos** en Chromium, sin mocks HTTP ni bypass de Auth. Se verificaron registro, confirmación mediante correo local, cierre de sesión, recuperación y acceso con la nueva contraseña; dos contextos independientes sincronizando mediante RPC y mensajes `postgres_changes` de `sync_heads` por WebSocket; cambios offline y reconexión; una tercera cuenta sin acceso a la tarea ajena tanto en UI como mediante lectura REST autenticada con RLS. Los correos se capturan en Mailpit, sin entrega externa. El test espera a que se muestre el formulario de recuperación antes de rellenarlo, evitando escribir en el formulario anterior durante la navegación.

Comprobaciones de esta entrega: TypeScript, lint, **182 pruebas unitarias**, **16 E2E de regresión de Foundation/Sync**, formato, auditoría de dependencias de producción sin vulnerabilidades y build web/PWA. Los dos escenarios locales pasaron dos veces consecutivas (4 ejecuciones, sin reintentos automáticos); el helper navega mediante enlaces de la SPA y espera la convergencia tras reconectar. Los proyectos nativos y el APK conservan la compilación de fase 9; no se ha incorporado el backend loopback a una distribución móvil. Consulta [uso del backend local](local-backend.md).

## Android local integrado — 27 de septiembre de 2026

`assembleLocal --no-daemon`: correcto con JDK 21 y SDK 36. APK independiente `android/app/build/outputs/apk/local/app-local.apk`, paquete `com.dayflow.app.local`, 5.369.312 bytes. SHA-256: `AA99AC32A1BC7170F98F8F99B71F215A1D4F3A31E3B407FBA749A79485B6BC51`. `processReleaseMainManifest` también pasa; la configuración HTTP limitada a loopback y el identificador local sólo aparecen en el manifest de la variante local.

**`npm run test:android:local`: correcto de principio a fin**, sobre emulador Android 15/API 35, WebView 124 y Supabase real en Docker mediante ADB. Se comprobaron:

- Registro desde la app, correo en Mailpit, callback mediante intent y canje PKCE real.
- Tarea creada en Chromium y recibida en Android; completada en Android y recibida como completada en Chromium.
- Permisos de notificación y alarma exacta concedidos por ADB al paquete de prueba; recordatorio creado desde la UI y confirmado como programado por el plugin.
- Entrega con la app en segundo plano, comprobada en `dumpsys notification` y `getDeliveredNotifications`.
- Cierre de sesión con una segunda alarma futura: cero elementos `SCHEDULED` y cero notificaciones entregadas visibles. No se interpreta el historial de `getPending` como alarmas activas.
- Cero errores JavaScript; captura de la UI nativa revisada. Resultado en `test-results-android/result.json` y captura en `test-results-android/scheduled.png` (artefactos locales ignorados).

La prueba permitió corregir dos defectos: interpretación de esquemas propios en WebView 124 y retirada de avisos Android, cuyos metadatos se recuperan ahora por ID. Se añadieron regresiones para ambos y para preservar avisos ajenos. **184 pruebas unitarias en 34 archivos**, TypeScript, lint, formato y build web/PWA correctos con el código final. No se repitieron las 86 pruebas web ni las 10 PWA en esta continuación.

El primer arranque del emulador falló en la capa gráfica (`EGL_BAD_CONFIG`); se repitió desde un arranque completo, sin snapshot y con SwiftShader. La ejecución final pasó sin reintentos automáticos y el emulador se cerró al terminar. No equivale a validar teléfonos físicos, Doze prolongado, reinicio, diálogos/denegación de permisos ni iOS. Instrucciones en [Android local](android-local.md).

## Instalación y diagnóstico USB — 3 de octubre de 2026

Se añadió `npm run android:device -- devices|check|install|connect [SERIAL]`. El diagnóstico consulta ADB, autorización, API de Android, identidad/minSdk del APK mediante aapt2, servicios locales y conflictos de puertos. La instalación usa `-r` sin desinstalar ni conceder permisos; la reconexión reutiliza los túneles existentes. Los nuevos túneles usan `--no-rebind` y se retiran si falla la operación, conservando los anteriores.

**7 pruebas Node correctas** (`npm run test:android:device`): destinos ausentes/ambiguos/no autorizados, APK incorrecto, puertos ocupados, instalación sin borrado, limpieza tras fallo, conflicto concurrente y rechazo de arranque. Además se ejecutaron `devices` y el rechazo de `check` sin dispositivos; `check`, `install` y `connect` pasaron contra el emulador Android 15/API 35 con el APK real y Supabase activo. TypeScript, lint y formato correctos. La aplicación y el APK no cambiaron; su SHA-256 conserva el valor registrado arriba y no se repitieron sus suites ni builds.

El usuario confirmó que no dispone de un Android físico. Su prueba queda pendiente, con los casos a realizar documentados en [Android local](android-local.md). El instalador no ejecuta la suite de alarmas del emulador ni modifica permisos del teléfono.

## Supabase alojado — 3 de octubre de 2026

Se enlazó el proyecto Dayflow (`spfrfvpexfnnhwpfinrq`, `eu-central-1`) después de comprobar que no contenía tablas públicas ni usuarios. El dry-run mostró únicamente las cuatro migraciones de Dayflow; se aplicaron y se verificó la coincidencia del historial. Las 17 tablas públicas tienen RLS y Realtime publica `sync_heads`.

Se aplicó un perfil remoto mínimo de Auth desde `deployment/supabase/config.toml`: retornos web/nativos, Site URL local provisional, mínimo de contraseña de 12 caracteres y cambio seguro. La comparación posterior mostró cero propiedades declaradas pendientes; las propiedades remotas ajenas al perfil se conservaron. La API pública confirma email activo, registro habilitado y autoconfirmación desactivada.

Se conectó `.env.local` mediante clave publishable y se conservó una copia de Docker. Build web/PWA y TypeScript correctos. Una comprobación con Chromium y cuentas temporales verificó:

- Login real desde dos contextos independientes y creación de tarea mediante la RPC.
- Recepción de cambios por WebSocket Realtime y visualización en el segundo contexto.
- Completar una tarea sin red, guardar la operación local y converger al reconectar.
- RLS: una segunda cuenta autenticada no obtiene la tarea de la primera en una consulta REST.
- Cierre de sesión desde la interfaz.

La primera ejecución falló al recargar completamente la página tras el cambio optimista offline, antes de esperar su persistencia. Se ajustó la comprobación para usar navegación interna y verificar que IndexedDB contiene la operación antes de reconectar; la ejecución final pasó. Las cuentas temporales se eliminaron al finalizar cada ejecución. Se usó Admin API únicamente para preparar y limpiar esas cuentas; las operaciones de la aplicación utilizaron la clave pública y sesiones de usuario reales.

No se enviaron correos: las cuentas temporales se confirmaron administrativamente. Quedan pendientes confirmar entrega de email y recuperación, dominio web público y APK conectado al backend alojado. No se repitieron todas las suites unitarias/E2E ni se declara validación de dispositivos físicos. El comprobador y su resultado están en `.toolchains/hosted-verification.mjs` y `.toolchains/hosted-verification-result.json`, artefactos locales ignorados sin credenciales guardadas.

## Web Push — 4 de octubre de 2026

Implementados registro voluntario por navegador, baja y cancelación al cerrar sesión, worker con identidad persistida y avisos sin contenido privado, migración `202610040005_web_push.sql`, emisor con RRULE compartido y despliegue reproducible. El proyecto alojado tiene cinco migraciones, `push-dispatch` desplegada y `dayflow-web-push` activa cada minuto. El planificador sólo invoca la función cuando existen suscripciones.

Validación completada:

- **203 pruebas unitarias, 39 archivos**, incluyendo permisos SQL, aislamiento, límites, exclusión de versiones obsoletas, reservas/reintentos, consentimiento, baja offline, cambio de cuenta, tiempo límite del proveedor y descarte de respuestas tardías. También se verificaron cargas Push antiguas/ajenas/malformadas, contenido genérico y navegación local.
- **92 E2E funcionales** correctos, sin reintentos. Se ejecutaron antes de añadir exclusivamente el tiempo límite de suscripción; ese último cambio se comprobó en la suite unitaria completa y la suite PWA posterior.
- **14 E2E PWA** correctos con el código final, sobre Chromium completo en escritorio y viewport móvil. Suscripción y HTTP simulados; evento Push inyectado en el worker de producción. IndexedDB, comunicación página/worker, `showNotification`, retirada de avisos al cerrar sesión y caché son reales. El permiso denegado no confirma activación.
- TypeScript, lint, formato y build correctos; **72 entradas precache, 1691,38 KiB** sin comprimir. `deno check` también pasó para la función.
- Supabase real: Auth y registro autenticado, rechazo de destinos HTTP arbitrarios y RPC de emisor para usuarios, cifrado/firma VAPID y petición a FCM usando un endpoint deliberadamente inexistente. El emisor retiró la suscripción caducada y respondió 200, sin errores de envío. Se repitió por **Cron real**, con respuesta HTTP 200 y sin timeout. No se simuló el proveedor en esas comprobaciones.
- Limpieza confirmada: cero cuentas temporales `dayflow-push-*` y cero suscripciones de prueba. No se enviaron correos ni se alteraron cuentas del usuario.

Durante las pruebas se corrigió la importación UMD de `rrule` en Deno. El navegador reducido de Playwright no permitía mostrar notificaciones desde el worker; la suite PWA usa ahora Chromium completo. La instalación se verifica en un perfil temporal persistente, porque Chromium completo rechaza instalar en incógnito. No se suprimieron errores de instalabilidad para aprobar la prueba.

La tentativa de obtener una suscripción real al proveedor desde un perfil temporal de Chromium no respondió en 25 segundos. Por tanto, **la entrega completa a un navegador realmente suscrito sigue sin verificarse**. La UI devuelve ahora un error si el alta tarda más de 30 segundos y revoca respuestas tardías sin activar avisos silenciosamente. Tampoco se comprobaron Safari/Firefox, suspensión/reinicio del sistema ni dispositivos físicos. Los proyectos nativos no se recompilaron en esta entrega. Uso y límites en [Web Push](web-push.md).

## Publicación HTTPS y candidato Android alojado — 4 de octubre de 2026

Publicación de Sites finalizada con estado `succeeded`: <https://dayflow-productividad.gptgonzaleznavarrete.chatgpt.site>. El acceso al alojamiento es privado para el propietario; no se ha cambiado a acceso público general. Se exportaron 69 archivos desde el build de producción, con fallback SPA y encabezados para revalidar el worker/manifest y conservar assets con hash. El checkout de publicación está en `deployment/web`; sólo contiene la exportación web y sus metadatos, sin claves privadas ni datos de usuarios. Identificadores, commit y digest en [validación de publicación](release-validation.md).

Se actualizaron exclusivamente `auth.site_url` y `auth.additional_redirect_urls` del Supabase alojado para incluir la URL HTTPS y `/auth/update-password`, conservando localhost y los callbacks nativos. La comparación posterior mostró **cero cambios declarados pendientes**. No se configuró SMTP ni se desactivó la confirmación de correo. El usuario eligió comprobar los mensajes manualmente; recepción, confirmación y recuperación reales permanecen pendientes de su resultado. No se declara un envío ni recepción verificados.

`cap sync` copió los recursos actuales y actualizó ambos proyectos. `assembleDebug --no-daemon` pasó con JDK 21 y SDK Android; nuevo APK de 5.099.726 bytes, SHA-256 `4CDA054954749A3F013F70C5CB95EB80AB39B40ED5423564469561C517867C9A`. Está conectado al backend alojado, no a Docker. iOS sólo se sincronizó, sin compilar ni ejecutar. El listado ADB confirmó ausencia de Android conectado.

Build/TypeScript, lint y formato correctos. No se repitieron las suites de comportamiento porque no se modificó la lógica de la aplicación. La publicación se confirma mediante el resultado de Sites; **no se declara QA de Safari, hardware, batería o entrega con la aplicación cerrada**. El protocolo distingue todos esos casos y registra evidencias en [validación de publicación y dispositivos](release-validation.md).

## Acceso privado y confirmación real — 4 de octubre de 2026

Se añadió, con autorización explícita, el correo de prueba como visitante de Sites. La política conserva acceso privado, propietario y un visitante externo; la respuesta de Sites confirma el permiso guardado. El usuario indicó que funciona correctamente tras repetir el acceso y registro.

Una consulta de sólo lectura sobre la cuenta acordada confirmó: **una cuenta, una solicitud de confirmación, correo confirmado y primer inicio de sesión**. Este registro se completó por el usuario, sin confirmación administrativa. La recuperación sigue pendiente: aún no figura una solicitud. No se han recogido tiempos de entrega ni carpeta del buzón. El cambio de acceso no requirió modificar o volver a publicar la aplicación.

## Recuperación real — 4 de octubre de 2026

Después de recibir los pasos para solicitar recuperación, abrir el correo en el mismo navegador, cambiar la contraseña e iniciar sesión con ella, el usuario confirmó que funciona correctamente. Se registra como **prueba manual superada**. No se accedió al buzón ni se solicitaron contraseñas o enlaces. El rechazo de la contraseña anterior no se comunicó por separado.

La consulta posterior mantiene la cuenta confirmada y devuelve `recovery_sent_at = null`; no aporta un historial de la recuperación. [Supabase Auth limpia ese campo al actualizar la contraseña](https://github.com/supabase/auth/blob/master/internal/models/user.go), por lo que su ausencia no acredita que nunca se haya solicitado. La consulta de auditoría filtrada por la cuenta no devolvió eventos; la evidencia de esta prueba es la confirmación manual del usuario.

## Diagnóstico de la primera prueba Push en Chrome — 4 de octubre de 2026

El usuario informó de que no recibió el aviso. La consulta de sólo lectura mostró una suscripción registrada, un recordatorio sincronizado con avisos activados y ninguna entrega intentada. El recordatorio estaba programado a las **13:28 Europe/Madrid**, mientras que el servidor marcaba **12:30 Europe/Madrid**: todavía no había vencido. Las tres últimas ejecuciones del trabajo Cron figuraban como `succeeded`; esto no acredita entrega al navegador.

El editor propone por defecto una hora después del momento de creación. No se modificó el recordatorio del usuario; se indicó repetir la prueba revisando la hora completa. La entrega efectiva sigue pendiente de un recordatorio vencido y del resultado observado en Chrome.

## Recepción real de Web Push en Chrome — 4 de octubre de 2026

El usuario confirmó que funciona la notificación. La consulta de sólo lectura acredita una entrega, aceptada por el proveedor: vencimiento a las **12:32:00 Europe/Madrid** y aceptación a las **12:32:00.576**. La recepción visible se acredita por la comprobación manual del usuario; no se interpreta el tiempo de aceptación como latencia de visualización.

La prueba solicitada fue cerrar las pestañas de Dayflow manteniendo Chrome abierto. El usuario confirmó la recepción sin detallar por separado el estado de las ventanas. Se registra entrega real en Chrome como superada; cierre completo del navegador, suspensión, Safari, aplicaciones nativas y batería permanecen pendientes. No se modificó código ni se repitieron suites de aplicación para este registro de evidencia.

## Chrome sin ventanas en Windows — 4 de octubre de 2026

El usuario precisó que cierra todas las ventanas de Chrome en Windows y la notificación sólo aparece al reabrirlo. Se registra **fallo de entrega al vencimiento en ese estado**, conservando la recepción real ya observada. Supabase muestra aceptación por el proveedor para los avisos de las 12:40 y 12:42 Europe/Madrid, respectivamente a las 12:40:01.086 y 12:42:00.523, un intento por aviso. El retraso visible ocurre después del envío aceptado.

La [documentación de Google](https://web.dev/articles/push-notifications-faq) distingue recepción sin ventanas y navegador completamente detenido: Chrome de escritorio necesita seguir ejecutándose. Se propone revisar el [modo de segundo plano en Windows](https://chromeenterprise.google/policies/background-mode-enabled/). No se ha leído ni modificado la configuración del navegador del usuario, ni se ha confirmado la causa exacta mediante inspección de procesos. No se promete que activar esa opción resuelva todos los casos; queda pendiente repetir la prueba y confirmar que Chrome permanece en ejecución.

El usuario confirmó que la opción ya estaba activa. Una inspección de sólo lectura del equipo encontró Chrome 154.0.8037.93 con 15 procesos y una ventana visible; no se encontró una política explícita `BackgroundModeEnabled` en HKCU/HKLM. No se cambiaron ajustes ni se cerraron procesos. Se solicitó cerrar manualmente todas las ventanas y confirmar el equipo de prueba para comparar el estado: la captura con una ventana abierta no permite concluir qué ocurre después de cerrarla.

El usuario confirmó «cerrado». La segunda consulta de procesos devolvió **0 procesos Chrome y 0 ventanas**, frente a los 15 procesos anteriores. Se confirma cierre completo del navegador en este equipo; el estado no equivale a ejecución sin ventanas. La opción activa no mantiene Chrome ejecutándose en esta configuración. La recepción al vencimiento con Chrome detenido permanece no disponible; no se afirma haber corregido esta limitación. No se instalaron extensiones ni se modificaron políticas, inicio de Windows o preferencias del navegador.

## Mi espacio: menú y perfil con estadísticas — 4 de octubre de 2026

«Mi espacio» es ahora un desplegable con enlaces a Perfil y Configuración. Admite teclado, Escape con retorno del foco, cierre al pulsar fuera y navegación desde móvil o barra contraída. La parte inferior de la barra lateral permite desplazamiento en ventanas de poca altura para mantener accesibles sus controles.

La ruta privada `/profile` muestra nombre, correo, antigüedad de cuenta, tareas completadas y por hacer (incluidas vencidas/en curso), notas y archivadas, eventos, recordatorios e Inbox. El porcentaje excluye tareas canceladas y eliminadas. La gráfica reúne completadas durante los últimos siete días civiles, incluido hoy, en la zona del usuario; las tareas reabiertas o eliminadas dejan de contar. Los eventos recurrentes cuentan como una serie, no como ocurrencias expandidas. Los datos proceden de repositorios locales por cuenta y se actualizan con Dexie y sincronización; no se añadieron tablas ni permisos remotos. `/setup/profile` invita a iniciar sesión sin mostrar cifras ficticias.

Comprobaciones funcionales: **12 E2E de perfil y dashboard**, escritorio y viewport móvil, con recorrido de completar/reabrir tareas, teclado, menú contraído, tema oscuro y anchura de 320 px. **2 pruebas PWA** verifican apertura de `/profile` sin red desde una ventana nueva con datos locales y módulos precargados. Capturas de escritorio y móvil revisadas. Build/TypeScript y formato correctos; el build incluye 76 entradas precache. Se excluyó del lint la exportación generada de Sites para analizar el código fuente, no los paquetes minificados publicados.

**3 pruebas unitarias** correctas para aislamiento entre cuentas y borrados, ausencia de escrituras al consultar, siete días civiles con cambio de horario, tareas reabiertas/futuras y espacio vacío. La primera ejecución pasó; al repetir con el código final, los pools `forks` y `threads` agotaron el plazo al arrancar el worker antes de ejecutar pruebas. La ejecución final con `--pool=vmThreads --maxWorkers=1` pasó las tres pruebas. Lint final correcto, sin avisos de los assets generados. No se recompilaron APK ni iOS para esta actualización web.

Versión 2 publicada en la URL habitual con estado `succeeded`, despliegue `appgdep_6ac26afd517481919e5865b8c416d2bf`, commit de exportación `db5a1ca380973fffc1f5296c411fb9e53c9f67eb`. Se conservó la audiencia privada compartida existente. La actualización del service worker espera a que se cierren las ventanas de Dayflow; no fuerza recarga de borradores.

## Diagnóstico de actualización web — 4 de octubre de 2026

El usuario sigue viendo la versión anterior y el botón de actualización muestra el error genérico de conexión. Sites confirma la versión 2 activa. Una consulta HTTP de diagnóstico con la credencial de Sites ya existente comprobó que `/sw.js` y el módulo `ProfilePage-j2U5hT-6.js` responden 200 y coinciden byte por byte con el build publicado; no se generó ni rotó ninguna credencial. Sin autenticación, `/sw.js`, `/` y `/profile` responden 401. Esto hace posible que una sesión de alojamiento caducada bloquee una actualización mientras la app anterior sigue disponible en caché, pero no prueba el estado de la sesión del navegador del usuario.

Se indica abrir directamente `/profile`: el worker de la versión 1 no incluye esa ruta en su fallback de navegación, por lo que permite contactar de nuevo con el alojamiento y renovar el acceso si se solicita. No se borran IndexedDB, datos del sitio ni sesiones de Supabase. La comprobación en el navegador del usuario sigue pendiente; la conexión de control de navegador no está disponible en este entorno.

## Cerrar sesión desde Mi espacio — 4 de octubre de 2026

El desplegable incluye «Cerrar sesión» para cuentas autenticadas, separado de los enlaces de navegación. Reutiliza `authService.signOut`, incluida la retirada de avisos de este dispositivo, y muestra estado ocupado, protección contra pulsaciones repetidas y errores cuando procede. La desactivación del botón durante la petición no oculta el menú por pérdida de foco.

**4 E2E correctos** en escritorio y viewport móvil: espera con botón desactivado, respuesta normal y error 503 del servidor, retorno al acceso y rechazo de navegación posterior a `/profile` sin sesión. La prueba inicial esperaba conservar la sesión tras un 503; se corrigió esa expectativa al comprobar que el SDK instalado elimina la sesión local también en ese caso. El test detectó además el cierre prematuro por blur del botón desactivado, que se corrigió y verificó. Build/TypeScript, lint y formato correctos. El build mantiene un aviso no bloqueante del empaquetador sobre una importación dinámica de Capacitor que ya está importado estáticamente; no afecta al cierre de sesión. No se modificó el servicio de autenticación ni se cerró la sesión real del usuario durante las pruebas.

Versión 3 publicada con estado `succeeded`, despliegue `appgdep_6ac28b1d3cc48191be67d28d760ddaeb` y commit de exportación `b1b471dc26de879f0f927554941b4010e20802a2`. Se conserva el acceso privado compartido. La actualización de la copia guardada en el navegador del usuario sigue dependiendo del acceso válido al alojamiento y la activación del nuevo worker; no se declara resuelto el error de actualización comunicado anteriormente.
