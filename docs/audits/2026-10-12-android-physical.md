# Android físico: instalación, autenticación, offline y sesión

Fecha de preparación: 12 de octubre de 2026, Europe/Madrid.
Rama: `validation/android-physical`.
Estado: **pendiente**. El usuario no dispone ahora de un Android físico.
ADB sólo detectó `emulator-5554`, identificado como `Medium_Phone_API_35`.
La instalación y apertura en ese emulador no completan esta validación.

## Compilación preparada

- SHA del código compilado: `f06a41a44546d805b8f22b6fafd488f4a4545f1b` (árbol limpio antes de compilar).
- APK: `android/app/build/outputs/apk/debug/app-debug.apk`.
- SHA-256 APK: `45FF10922E0027A407DEA2B2A5C582D0DB04E0249F53325BF18D59A53BF6DD1B`.
- Paquete: `com.dayflow.app`; versión: `0.9.0`; compilación debug.
- Backend: Supabase alojado configurado en el proyecto. No requiere Docker ni túnel ADB.
- Preparación completada: `npm run native:sync` y `assembleDebug --no-daemon`, con JDK 21.
- Evidencia de emulador: instalación ADB `Success`, arranque `Status: ok` y pantalla de acceso revisada. No acredita autenticación ni sincronización físicas.

Si se recompila, volver a registrar SHA del código, estado del árbol y SHA-256 del APK. No atribuir resultados a la huella anterior.

## Datos de la ejecución física

Completar antes de empezar:

| Campo                                              | Valor     |
| -------------------------------------------------- | --------- |
| Fecha y hora con zona                              | Pendiente |
| Fabricante y modelo                                | Pendiente |
| Android y nivel API                                | Pendiente |
| Compilación del sistema                            | Pendiente |
| Versión de Android System WebView                  | Pendiente |
| SHA del código probado y SHA-256 del APK instalado | Pendiente |
| Instalación nueva o actualización; versión previa  | Pendiente |
| Red y ahorro de batería                            | Pendiente |
| Cuenta de prueba (alias, sin credenciales)         | Pendiente |

## Instalación

1. Conectar el teléfono por USB, activar depuración USB y aceptar su autorización.
2. Ejecutar `adb devices -l` y elegir explícitamente el serial físico; no utilizar `emulator-5554`.
3. Consultar y registrar `ro.product.manufacturer`, `ro.product.model`, `ro.build.version.release`, `ro.build.version.sdk` y `ro.build.display.id` con `adb -s SERIAL shell getprop PROPIEDAD`. Consultar WebView con `adb -s SERIAL shell dumpsys webviewupdate`.
4. Comprobar la huella del APK con `Get-FileHash android/app/build/outputs/apk/debug/app-debug.apk -Algorithm SHA256`.
5. Instalar conservando datos: `adb -s SERIAL install -r android/app/build/outputs/apk/debug/app-debug.apk`.
6. Abrir: `adb -s SERIAL shell am start -W -n com.dayflow.app/com.dayflow.app.MainActivity`.

Usar el ADB del SDK (`$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe`) si no está en PATH. El comando `npm run android:device` gestiona **Dayflow Local** y no corresponde a este APK alojado. Ante un conflicto de firma, registrar el error y revisar la instalación anterior antes de desinstalar o borrar datos.

## Matriz y orden de ejecución

Usar una cuenta de prueba y elementos con un prefijo único por ejecución. Abrir también la web de Dayflow con esa misma cuenta para contrastar la sincronización. Registrar hora de cada acción, resultado observado y referencia de evidencia; ante un fallo conservar el mensaje y los pasos de reproducción.

| Caso                                | Procedimiento                                                                                                                          | Criterio de aceptación                                                                                                               | Estado    | Evidencia |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------- | --------- |
| AND-01 Instalación                  | Instalar el APK verificado y abrirlo.                                                                                                  | Android confirma instalación, la app abre sin cierre inesperado y muestra acceso o sesión previa válida.                             | Pendiente | —         |
| AND-02 Acceso                       | Iniciar sesión con una cuenta de prueba confirmada.                                                                                    | Se accede a los datos de esa cuenta sin errores.                                                                                     | Pendiente | —         |
| AND-03 Registro y PKCE              | Solicitar registro desde la app; recibir y abrir el correo en el teléfono, eligiendo esta variante de Dayflow si aparece un selector.  | El enlace devuelve a la app y completa el acceso de la cuenta nueva.                                                                 | Pendiente | —         |
| AND-04 Recuperación                 | Solicitar recuperación desde la app, abrir el correo en el teléfono y cambiar la contraseña. Cerrar sesión y probar ambas contraseñas. | Retorno a la app, cambio correcto, nueva contraseña aceptada y anterior rechazada en un acceso nuevo.                                | Pendiente | —         |
| AND-05 Sincronización bidireccional | Crear una tarea en Android y comprobarla en la web; modificarla en la web y comprobar Android.                                         | Ambos clientes convergen, sin duplicados; registrar tiempos observados y estado de sincronización.                                   | Pendiente | —         |
| AND-06 Edición offline              | Esperar sincronización completa. Activar modo avión y desactivar también Wi-Fi; crear una tarea y editar una nota.                     | Cambios guardados localmente y visibles sin red, sin exigir un nuevo acceso.                                                         | Pendiente | —         |
| AND-07 Arranque offline             | Con los cambios anteriores guardados y sin red, detener sólo el proceso de Dayflow y volver a abrirla, sin borrar almacenamiento.      | Restaura la sesión disponible y los cambios locales. Registrar si la sesión requiere renovación, en vez de dar por superado el caso. | Pendiente | —         |
| AND-08 Reconexión                   | Restaurar la red y comprobar los cambios offline en la web; repetir la apertura de Android.                                            | Cola sincronizada, ausencia de pérdida o duplicados y mismos datos en ambos clientes.                                                | Pendiente | —         |
| AND-09 Recuperación de sesión       | Con red, detener y abrir la app; después reiniciar el teléfono y abrir de nuevo.                                                       | Conserva acceso a la cuenta correcta y recupera sincronización. Registrar cada escenario por separado.                               | Pendiente | —         |
| AND-10 Renovación de sesión         | Dejar vencer el token de acceso según el TTL configurado, conservando la sesión; abrir con red y comprobar una nueva sincronización.   | Renovación correcta y acceso a la cuenta original. Registrar TTL y duración de espera, sin guardar tokens.                           | Pendiente | —         |
| AND-11 Aislamiento de cuentas       | Sin cambios pendientes, cerrar sesión e iniciar con otra cuenta de prueba.                                                             | No aparecen datos de la primera cuenta ni se envían sus cambios como propios de la segunda.                                          | Pendiente | —         |

Detener el proceso puede hacerse con `adb -s SERIAL shell am force-stop com.dayflow.app`. Este paso prueba recuperación de la app; no representa una prueba de alarmas con la app detenida. Las alarmas, Doze y ahorro de batería corresponden a la siguiente tarea.

## Evidencia y cierre

Por cada caso registrar fecha/hora Europe/Madrid, estado de red, pasos, esperado, observado y evidencia (captura recortada o salida ADB pertinente). Ocultar correo y datos personales; no guardar contraseñas, tokens ni enlaces completos de acceso. Para sincronización, conservar observaciones de ambos clientes; una pantalla local guardada no demuestra recepción remota.

Estados admitidos: **pendiente**, **superado**, **fallido**, **no aplicable con motivo**. Completar modelo, Android, WebView, SHA del código y huella del APK antes de cerrar. Esta tarea sólo estará completada al ejecutar la matriz en hardware real y registrar resultados; los fallos que impidan cumplir los criterios deberán resolverse y repetirse. El emulador y las pruebas automáticas no sustituyen esa evidencia.

Referencias internas: [validación de publicación](../release-validation.md), [backend alojado](../hosted-backend.md) y [variante Android local](../android-local.md).
