# Compatibilidad con WebView 97 en Redmi 9A

Fecha: 12 de octubre de 2026, Europe/Madrid. Rama: `fix/android-webview97-compat`.
Estado: corrección verificada automáticamente y repetición física de creación/sincronización superada por comprobación manual del usuario en el Redmi 9A.

## Problema y corrección

Durante AND-05 el usuario informó de que, al crear la tarea, aparecía «Intl.supportedValuesOF is not a function». El Redmi tiene Android 11/API 30 y WebView `97.0.4692.98`. Las cuatro llamadas a `Intl.supportedValuesOf('timeZone')` en tareas, eventos, recordatorios y Configuración no disponían de alternativa.

Ahora esos selectores usan una función común: conserva la enumeración nativa cuando existe y, si falta, utiliza una lista IANA generada con Node 24.18.0, filtrada por las zonas que admite `Intl.DateTimeFormat` del dispositivo. Incluye UTC y calcula/cachea la lista una sola vez. Los formularios conservan también su zona seleccionada. No cambia fechas guardadas ni migra IndexedDB.

La revisión encontró además llamadas incondicionales a `signal.throwIfAborted()`, `AbortSignal.any()` y `AbortSignal.timeout()` en Sync. Se sustituyen por comprobación de `aborted` y un controlador por petición que escucha cancelación de sesión, limita la RPC a 15 segundos y libera timer/listener al terminar. No se elimina cancelación ni timeout. El uso independiente de `AbortSignal.timeout` en Web Push queda fuera de este cambio, que corrige los recorridos nativos observados y Sync.

La API reportada explica el fallo de creación; la incompatibilidad de AbortSignal se acredita por revisión y pruebas, no por un mensaje capturado del teléfono. No se presenta como causa física confirmada de un error distinto de sincronización.

## Verificación

- TypeScript y lint correctos.
- 30 unitarias correctas en `abort.test.ts`, `supabase-transport.test.ts` y `sync-engine.test.ts`, con `--pool=vmThreads --maxWorkers=1`. Cubren cancelación previa/sin razón, cancelación durante petición, timeout y limpieza, además de los escenarios existentes del motor.
- 6 E2E existentes de Sync correctos, tres escenarios en escritorio/móvil, cero reintentos: convergencia/offline/borrados, respuesta perdida/servidor fallido y conflicto offline.
- Nueva regresión E2E: elimina `Intl.supportedValuesOf`, `AbortSignal.any`, `AbortSignal.timeout` y `throwIfAborted` antes de cargar la app; abre Configuración, crea una tarea, abre eventos/recordatorios y comprueba envío y recepción con otro cliente contra PostgreSQL PGlite. **2/2 correctos** (escritorio/móvil), cero reintentos, 22,6 s.
- La primera ejecución de esa regresión falló en ambos perfiles por un locator exacto que no coincidía con el nombre accesible de la zona de eventos. Se corrigió el selector de prueba y se fijó explícitamente Europe/Madrid; no se cambió el producto para ocultar ese fallo.
- Revisión de React: llamadas compartidas sin hooks condicionales, caché de zonas fuera del render y etiquetas/valores de formularios conservados.

La emulación de APIs ausentes en Chromium moderno no sustituye WebView 97 real. Auth/Realtime están simulados en E2E; las RPC SQL y almacenamiento local son reales. El resultado físico posterior de AND-05 se registra abajo; recepción de alarmas pendiente.

## Repetición física

APK nuevo compilado correctamente con `npm run build`, `npx cap sync android` y `assembleDebug --no-daemon` (Gradle: 52 s). Código compilado: `beeca6a54ccdda0048c84498713b2aafbfe57f30`. APK: 5.100.912 bytes, SHA-256 `0FF52D83F174B4163E9C26D7513AF2DA07C250AF76019918490239A1D7E4181B`. Copia local identificable: `.toolchains/redmi-9a/Dayflow-0.9.0-WebView97.apk`. ADB sigue offline: no se ha copiado ni instalado este APK corregido en el Redmi.

Compilar desde esta rama, registrar el SHA del código y SHA-256 del APK nuevo, actualizar Dayflow conservando datos y repetir creación de la tarea y sincronización bidireccional. La instalación del APK anterior no valida esta corrección. Consultar el [registro Redmi](2026-10-12-redmi-9a.md).

Resultado posterior: el usuario copió e instaló el APK nuevo como actualización y confirmó creación sin error, llegada a la web y retorno de un cambio de título sin duplicados. La corrección queda **validada manualmente en el recorrido reportado**. No hay captura ni contraste ADB de la huella instalada, y no se extrapola a las demás pruebas físicas pendientes.

Referencia de compatibilidad: [Intl.supportedValuesOf](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/supportedValuesOf), [AbortSignal.throwIfAborted](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/throwIfAborted) y [AbortSignal.any](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/any_static).
