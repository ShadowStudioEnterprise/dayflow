# PWA y Capacitor — Fase 9

## Instalación web

`npm run build` genera `dist/` con manifest, iconos y service worker de Workbox mediante `vite-plugin-pwa`. `npm run preview` permite comprobarlo en localhost. En un servidor público se necesita HTTPS y fallback de las rutas SPA a `index.html`.

En **Configuración → Instalación y actualizaciones** se muestra el estado real del arranque offline. Cuando Chromium ofrece instalación, aparece **Instalar Dayflow**. La aceptación del diálogo no se anuncia como éxito hasta recibir `appinstalled` o detectar modo standalone. Otros navegadores muestran instrucciones; en Safari de iPhone/iPad se usa Compartir → Añadir a la pantalla de inicio. No se simula un diálogo nativo de instalación.

El manifest usa nombre Dayflow, idioma español, modo standalone, ámbito y URL inicial `/`, color `#7562b4` e iconos PNG 192/512, maskable y Apple Touch. `npm run icons` regenera los PNG y recursos nativos desde el vector existente `public/favicon.svg`. No depende de un servicio de imágenes. El viewport y el CSS contemplan las áreas seguras del dispositivo.

## Arranque offline y actualizaciones

Se precargan HTML, CSS, todos los módulos JavaScript —también las rutas cargadas por demanda— e iconos. **La caché del worker contiene sólo recursos públicos de la aplicación**, nunca respuestas Auth, RPC, Realtime ni registros personales. Los datos siguen en IndexedDB y los repositorios mantienen su aislamiento por cuenta. Las navegaciones conocidas usan el HTML precargado; otras peticiones van a la red.

Después de completar la primera descarga, la app puede abrirse en una nueva ventana sin red. El acceso privado requiere una sesión previamente guardada que Supabase pueda restaurar. Si la sesión caducó y necesita renovación, hay que recuperar conexión; esta fase no introduce un segundo sistema de autenticación offline. Borrar datos del sitio o la eliminación de almacenamiento por el navegador puede retirar tanto la caché como los datos locales. Cerrar sesión conserva pendientes de sincronización, pero bloquea las rutas privadas.

La actualización se descarga en segundo plano y queda **en espera hasta cerrar todas las ventanas controladas por la versión anterior**. Configuración permite comprobarla y muestra cómo activarla. No se envía `SKIP_WAITING` ni se recargan ventanas automáticamente: un formulario abierto conserva su código y sus archivos hasta que el usuario lo cierre. Workbox limpia las entradas obsoletas al activar la siguiente versión; no toca IndexedDB. Registro, descarga y comprobación fallidos muestran error y permiten reintentar.

En desarrollo no se registra un worker. Tampoco se registra dentro de Capacitor: el contenedor carga los recursos locales incluidos en cada paquete y se actualiza distribuyendo otra versión nativa. No hay actualización remota de código nativo.

Para desplegar, publica todo `dist/` de forma atómica. Sirve `index.html`, `sw.js`, `workbox-*.js` y el manifest con revalidación; los assets con hash pueden usar caché larga e `immutable`. Conserva los assets de la versión anterior durante el despliegue. No conviertas las respuestas API ni los JavaScript inexistentes en HTML. El 4 de octubre se publicó la [web HTTPS](https://dayflow-productividad.gptgonzaleznavarrete.chatgpt.site) mediante Sites, con acceso privado. Detalles de publicación, nuevo APK y pruebas físicas pendientes en [validación de publicación](release-validation.md).

## Proyectos nativos

Además de las compilaciones habituales, existe **Dayflow Local** para desarrollar con Supabase en este ordenador. Consulta [Android local](android-local.md): recursos separados, paquete `com.dayflow.app.local` y túnel ADB. Sus excepciones HTTP para loopback sólo se incluyen en esa variante.

`capacitor.config.ts` define `com.dayflow.app`, Dayflow y `webDir: dist`; no fija un servidor remoto ni permite tráfico HTTP inseguro. `android/` y `ios/` son proyectos reales generados por Capacitor 8.5.2. Ambos enlazan App y Local Notifications. iOS utiliza Swift Package Manager; no requiere CocoaPods para estos plugins.

```sh
npm ci
npm run icons
npm run native:sync
npm run native:android
# En macOS:
npm run native:ios
```

`native:sync` compila el frontend y ejecuta `cap sync` para copiar recursos y actualizar plugins de ambos proyectos. Si se parte de un checkout sin las carpetas nativas, la configuración también admite `npx cap add android` y `npx cap add ios`. No se deben repetir estos comandos sobre proyectos que ya existen.

Android requiere JDK 21, SDK Platform 36 y las herramientas que Gradle solicite. En PowerShell, configura `JAVA_HOME` apuntando al JDK 21 y `ANDROID_HOME` al SDK; después:

```powershell
cd android
.\gradlew.bat assembleDebug --no-daemon
```

El APK debug se genera en `android/app/build/outputs/apk/debug/app-debug.apk`. Es un paquete de desarrollo. La firma release, identificadores de publicación y distribución en tiendas quedan fuera de esta entrega. La compilación toma las variables públicas de Supabase existentes en el momento de `native:sync`; sin ellas abre la preparación pública.

La verificación local utiliza una copia portable de Temurin 21 en `.toolchains/`, ignorada por Git, descargada desde Adoptium y comprobada con SHA-256. No modifica el Java global. Esta carpeta no es un requisito del repositorio: cualquier JDK 21 compatible sirve.

iOS necesita macOS y Xcode 26 o posterior. Abre `ios/App/App.xcodeproj`, resuelve sus paquetes y configura equipo/firma para un dispositivo. El proyecto tiene icono, splash, nombre y esquema de retorno propios. No se puede compilar ni ejecutar iOS desde este entorno Windows.

Android declara notificaciones y alarmas exactas mediante `SCHEDULE_EXACT_ALARM`, sin `USE_EXACT_ALARM`. La UI ya solicita permisos y abre la configuración de alarmas; la programación exige permisos antes de invocar el plugin. La copia de seguridad automática Android está desactivada para no restaurar accidentalmente tokens y colas en otra instalación. Las alarmas reales siguen requiriendo pruebas en dispositivo, incluyendo suspensión, reinicio y revocación de permisos. La web incorpora [Web Push con emisor en Supabase](web-push.md), activación voluntaria y cancelación al cerrar sesión; la entrega completa a una suscripción real sigue pendiente de verificación.

## Retorno de autenticación y navegación

La web conserva sus redirects HTTPS. La app nativa solicita confirmación/recuperación con `dayflow://auth/callback` y `dayflow://auth/callback?next=recovery`. Añade ambos destinos a la allowlist del proyecto Supabase. PKCE exige solicitar y abrir el correo en la misma instalación que conserva el verificador.

Android e iOS registran el esquema. El runtime procesa enlaces al iniciar y con la app abierta, sólo admite el host/path propios y canjea el código mediante Supabase; deduplica la recepción doble. Rechaza tokens en fragmentos y destinos arbitrarios. Los errores visibles no muestran códigos ni respuestas externas. Esto no equivale a tener Universal Links/App Links verificados por dominio; requiere configurar un dominio real si se desea esa modalidad.

Se corrigió la lectura del callback en WebView 124, donde `URL` no separa la autoridad de un esquema propio. El lector exige primero el prefijo literal `dayflow://auth/callback` y después utiliza un esquema estándar únicamente para analizar parámetros; conserva la validación de código, fragmentos y destino de recuperación.

El botón Atrás de Android cierra primero el diálogo respetando su confirmación de descarte; después usa la navegación con sus bloqueos, o minimiza la aplicación si no hay historial interno.

## Pruebas y límites

`npm run test:pwa` construye dos versiones reales en `dist-pwa-test/` y las sirve desde un servidor exclusivo de pruebas. Comprueba manifest e instalabilidad Chromium, caché sin datos privados, apertura offline en una ventana nueva, rutas aún no visitadas, persistencia, bloqueo tras logout y actualización con dos ventanas. Incluye escritorio, 320 px, oscuro y capturas visuales. Los endpoints de cambio de versión existen sólo en ese servidor de pruebas, nunca en el producto. Sus artefactos se guardan en `test-results-pwa/`, separados de la suite habitual.

Las pruebas unitarias cubren errores y ciclo de registro, disponibilidad offline, instalación confirmada, ausencia de worker nativo y validación/canje/deduplicación de enlaces PKCE. El APK debug de fase 9 se abrió en un emulador Android 15/API 35: plugins disponibles, navegación, botón Atrás, persistencia de tema y recarga sin Wi-Fi/datos, sin errores JavaScript. La continuación con **Dayflow Local** verificó además registro/PKCE real, sincronización bidireccional con la web, entrega de una alarma en segundo plano y limpieza de avisos al cerrar sesión. Se usó el AVD en modo de sólo lectura y se cerró al terminar. Los resultados y límites están en [verificación](verification.md).

Las dependencias quedan fijadas en el lockfile. El override `xcode → uuid ^11.1.1` actualiza la dependencia de la CLI con API CommonJS `v4` compatible; `cap sync ios` comprueba el flujo que la utiliza. No se ha aplicado una actualización masiva de dependencias.

Referencias oficiales: [Vite PWA: registro manual](https://vite-pwa-org.netlify.app/guide/register-service-worker), [actualizaciones](https://vite-pwa-org.netlify.app/guide/prompt-for-update), [entorno Capacitor](https://capacitorjs.com/docs/getting-started/environment-setup), [Swift Package Manager](https://capacitorjs.com/docs/ios/spm), [Local Notifications](https://capacitorjs.com/docs/apis/local-notifications) y [distribución portable de Adoptium](https://adoptium.net/installation/archives/).
