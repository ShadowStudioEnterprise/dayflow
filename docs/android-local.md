# Android con el backend de este ordenador

La variante **Dayflow Local** (`com.dayflow.app.local`) conecta con Supabase local mediante `adb reverse`. Tiene datos y sesión separados de Dayflow (`com.dayflow.app`). No necesita un proyecto alojado. Requiere Docker, Node 24, JDK 21, Android SDK 36 y un emulador o teléfono con depuración USB autorizada.

## Compilar

Con Docker activo, desde la raíz:

```powershell
npm run backend:start
npm run typecheck
npm run native:android:local
$env:JAVA_HOME = 'RUTA-A-TU-JDK-21'
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
Set-Location android
.\gradlew.bat assembleLocal --no-daemon
```

En este equipo hay un JDK portable en `.toolchains/jdk-21.0.12.1+1`. El APK se genera en `android/app/build/outputs/apk/local/app-local.apk`. Es una compilación depurable con firma de desarrollo, no un paquete para publicar.

El script lee la clave pública del backend local activo y prepara recursos exclusivos en `android/app/src/local/assets/`, ignorados por Git. No modifica `.env.local`, `dist/`, los recursos nativos principales ni iOS. Hay que volver a preparar y compilar tras cambiar el código web. Las bibliotecas y plugins nativos usan la configuración Capacitor ya sincronizada del repositorio.

La variante utiliza el origen interno `http://localhost` y permite HTTP sólo para `localhost` y `127.0.0.1`, mediante un recurso de seguridad que existe únicamente en `src/local`. No hay servidor remoto de recursos web ni permiso general de tráfico HTTP. Las variantes `debug` y `release` conservan su configuración habitual.

## Instalar y conectar

El comando integrado detecta el SDK mediante `ANDROID_HOME`, `ANDROID_SDK_ROOT` o la ubicación habitual del sistema:

```sh
npm run android:device -- devices
npm run android:device -- check
npm run android:device -- install
```

`check` comprueba autorización USB, identidad y versión mínima del APK, backend, correo y puertos disponibles; no instala ni abre la app. `install` conserva los datos de una instalación compatible (`adb install -r`), crea los túneles que faltan y abre **Dayflow Local**. Si hay varios dispositivos, añade su SERIAL: `npm run android:device -- install SERIAL`.

Después de reconectar el cable, usa `npm run android:device -- connect SERIAL`: restaura la conexión y abre la app sin volver a instalar. El comando no concede permisos de notificaciones ni alarmas, no desinstala apps ni borra sus datos. Rechaza puertos que ya apuntan a otro servicio; si la operación falla, retira sólo los túneles que acaba de crear. Un conflicto de firma requiere revisar la instalación existente, sin desinstalar automáticamente.

También puedes ejecutar los pasos manualmente:

Desde la raíz del repositorio, sustituye `SERIAL` por el identificador mostrado en `adb devices`:

```powershell
$dayflowAdb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $dayflowAdb devices
& $dayflowAdb -s SERIAL install -r android/app/build/outputs/apk/local/app-local.apk
& $dayflowAdb -s SERIAL reverse tcp:54321 tcp:54321
& $dayflowAdb -s SERIAL reverse tcp:54324 tcp:54324
& $dayflowAdb -s SERIAL shell am start -n com.dayflow.app.local/com.dayflow.app.MainActivity
```

El puerto 54321 permite Auth y sincronización; el 54324 permite abrir Mailpit en el navegador del dispositivo. El túnel depende de la conexión ADB: vuelve a configurarlo después de reiniciar el dispositivo o reconectar si ha desaparecido. No requiere exponer Supabase a toda la red.

Puedes crear y confirmar la cuenta en la web del ordenador y después iniciar sesión en Android con esa cuenta. Si solicitas registro o recuperación **desde Android**, abre `http://127.0.0.1:54324` en el navegador de ese dispositivo y abre el correo allí, para que el enlace `dayflow://auth/callback` regrese a la instalación que conserva el verificador PKCE. Si aparecen dos variantes de Dayflow en el selector, elige **Dayflow Local**.

Para retirar sólo estos túneles:

```powershell
& $dayflowAdb -s SERIAL reverse --remove tcp:54321
& $dayflowAdb -s SERIAL reverse --remove tcp:54324
```

## Prueba automatizada

`npm run test:android:device` comprueba selección de dispositivo, autorización, rechazo de APK incorrecto, conservación de túneles y recuperación de fallos mediante dobles de ADB. No necesita un teléfono y no equivale a una prueba física.

`npm run test:android:local` requiere el APK instalado, Supabase activo, la web en `http://127.0.0.1:5173` y un emulador dedicado en `emulator-5560`. Puede seleccionarse otro mediante `DAYFLOW_ANDROID_SERIAL`; la suite rechaza teléfonos físicos. No borra datos de la aplicación.

La prueba crea una cuenta de desarrollo en Mailpit, entrega su callback mediante un intent Android, utiliza los formularios reales y comprueba la convergencia con Chromium. Otorga notificaciones y alarmas exactas por ADB **sólo al paquete local del emulador**, crea un recordatorio desde la UI, pone la app en segundo plano y consulta la entrega en el sistema y el plugin. Después verifica que cerrar sesión cancele pendientes y retire las notificaciones entregadas. Guarda capturas y un resultado sin credenciales en `test-results-android/`.

Los permisos concedidos por ADB no validan el diálogo interactivo del sistema. Una entrega en emulador no garantiza el comportamiento de fabricantes, Doze prolongado, reinicios o iOS. Los resultados ejecutados están en [verificación](verification.md).

Referencias: [variantes Android](https://developer.android.com/build/build-variants), [seguridad de red por dominio](https://developer.android.com/privacy-and-security/security-config) y [configuración Capacitor](https://capacitorjs.com/docs/config).

## Comprobación pendiente en teléfono físico

Cuando dispongas de un Android, instala la variante local y completa estas comprobaciones con una cuenta de prueba:

1. Confirma el acceso y la sincronización de una tarea con el navegador del ordenador.
2. Solicita notificaciones desde Configuración y concede alarmas exactas en la pantalla del sistema; comprueba también la experiencia al denegar permisos.
3. Crea un recordatorio futuro, pulsa Inicio y bloquea el teléfono. Comprueba la hora de entrega y la apertura del recordatorio al tocar el aviso.
4. Modifica o elimina una alarma futura y comprueba que el aviso original no llega. Cierra sesión y comprueba que desaparecen los avisos entregados y no llegan los pendientes.
5. Desconecta USB, crea un cambio local y vuelve a conectar con `connect`. Comprueba la convergencia y ausencia de duplicados.
6. Repite en suspensión prolongada y después de reiniciar Android, comprobando permisos y programación al reabrir la app.

Registra modelo, versión Android/WebView, fecha, caso y resultado. El 3 de octubre de 2026 no había un teléfono disponible; estos casos no se declaran superados en hardware físico. La depuración USB requiere aceptar la autorización en el dispositivo: [guía oficial de ADB](https://developer.android.com/tools/adb).
