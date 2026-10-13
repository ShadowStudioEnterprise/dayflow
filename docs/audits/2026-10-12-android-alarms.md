# Android físico: alarmas y recepción de notificaciones

Preparado el 12 de octubre de 2026, Europe/Madrid, en `validation/android-alarms`.
Estado: **pendiente de ejecución física**. El usuario no dispone ahora de teléfono; ADB sólo detecta el emulador `emulator-5554`. Ningún caso de la matriz siguiente se declara ejecutado.

Actualización del 13 de octubre: disponible Redmi 9A, Android 11/API 30 y WebView 97; instalación y pruebas manuales en el [registro del dispositivo](2026-10-12-redmi-9a.md). El usuario confirma notificaciones y alarmas exactas permitidas, mecanismo de alarmas locales de Android, ahorro desactivado y concordancia de fecha/hora con el ordenador. No se ha observado el recorrido de concesión ni medido la precisión del reloj. ALM-05 intento 1 solicitado, pendiente de recepción y medición; el estado inicial anterior se conserva como antecedente del protocolo.

Resultado posterior ALM-05 intento 1: recepción en segundo plano y apertura del recordatorio correcto confirmadas manualmente; pantalla encendida y USB/cargador conectado. El usuario informa llegada a la hora prevista, pero no aporta horas ni precisión: retraso no medido. Sin sonido ni vibración, ajustes de canal/modos/volumen pendientes de comprobar. Caso **parcial**, no cerrado: faltan medición y dos repeticiones. Los otros casos permanecen pendientes; la matriz preparada más abajo no se interpreta como resultados ejecutados.

El usuario confirmó después sonido de reproducción desactivado en la categoría consultada. Se conserva este valor inicial. ALM-05 intento 2 solicitado con sonido activado, vibración si está disponible, modos de silencio desactivados y volumen audible; tiempos y resultado pendientes. No se atribuye la ausencia de vibración al ajuste de sonido ni se declara corregido un defecto de código.

ALM-05 intento 2, resultado manual del 13 de octubre: previsto 16:58, recibido 16:58, precisión de minutos (Europe/Madrid); no se informa retraso exacto ni cero segundos. Sonó, no vibró y abrió el recordatorio correcto; pantalla encendida y USB/cargador conectado. Intento 3 solicitado manteniendo ajustes y carga; pendiente. La configuración sonora difiere del intento 1 y aún no hay tres repeticiones equivalentes ni medición en segundos. Ajuste de vibración pendiente de lectura.

## Referencia y comprobación estática

Usar los datos de dispositivo y la instalación descritos en el [protocolo de Android físico](2026-10-12-android-physical.md).

- SHA del código preparado: `f06a41a44546d805b8f22b6fafd488f4a4545f1b`.
- APK: `android/app/build/outputs/apk/debug/app-debug.apk`, paquete `com.dayflow.app`, versión `0.9.0`.
- SHA-256 APK comprobado: `45FF10922E0027A407DEA2B2A5C582D0DB04E0249F53325BF18D59A53BF6DD1B`.
- `capacitor-notification-service.ts` comprueba permiso de notificaciones y alarmas exactas antes de programar; utiliza `allowWhileIdle: true` y el canal `dayflow-reminders`.
- El manifiesto combinado debug incluye `RECEIVE_BOOT_COMPLETED` y `LocalNotificationRestoreReceiver`.
- El receptor del plugin instalado consulta `isUserUnlocked` y no restaura si el usuario sigue bloqueado. Omite avisos de una sola entrega ya disparados y reprograma fechas vencidas durante el apagado para aproximadamente 15 segundos después de la restauración. Es comportamiento leído en código, no evidencia física ni garantía de llegada.

Si se recompila o cambia el código, registrar el nuevo SHA y la nueva huella. Las alarmas probadas son locales de la app nativa; la recepción de Web Push de una PWA instalada no acredita estos casos.

## Preparación y medición

1. Completar modelo, fabricante, Android/API, compilación del SO, WebView, SHA y huella del APK. Usar una cuenta de prueba y recordatorios identificados por caso e intento.
2. Registrar zona del teléfono, fecha/hora automática, porcentaje de batería, conexión/carga, modo de ahorro, optimización de Dayflow, ajustes del fabricante, permiso de notificaciones, permiso de alarmas exactas, canal Recordatorios, bloqueo y No molestar. Conservar los valores iniciales para restaurarlos al terminar.
3. Preparar recordatorios únicos, sin repetición, con avisos activados. En los casos positivos conceder ambos permisos desde la interfaz y confirmar en **Configuración → Diagnóstico de notificaciones** que la programación está confirmada. No concederlos por ADB para sustituir el diálogo real.
4. Mantener menos de 60 avisos próximos. Crear los avisos de cada ensayo con margen para entrar en la condición antes del vencimiento (al menos cinco minutos en ensayos cortos). Al pasar a segundo plano usar Inicio; no utilizar `force-stop` como equivalente.
5. Usar un reloj externo sincronizado, o grabación externa con referencia horaria, para no despertar el teléfono al comprobar la hora. Registrar el instante previsto en ISO 8601 con offset, el primer instante de presentación observado y la precisión del método. El sonido, vibración y contenido visible dependen también del canal y privacidad; anotarlos por separado.
6. Calcular retraso en segundos: `instante de primera presentación - instante programado`. No usar el tiempo de una captura posterior ni el campo de publicación del sistema como si fueran la primera presentación. Si sólo se puede acotar, registrar el intervalo y la causa.
7. Repetir los ensayos cortos positivos tres veces por condición. Para suspensión natural prolongada realizar al menos una sesión de una hora y otra nocturna; registrar duración real y si hubo movimientos, carga o activaciones de pantalla.

Para avisos aislados en Doze separar vencimientos al menos diez minutos. Android documenta restricciones de frecuencia por aplicación incluso para alarmas permitidas durante inactividad; una ráfaga se registra como un escenario distinto, sin inferir pérdida por una ventana de observación demasiado corta. [Doze y App Standby](https://developer.android.com/training/monitoring-device-state/doze-standby).

## Matriz de pruebas

Todas las filas están **pendientes**. Registrar resultado por intento en el formato de evidencia posterior; no agrupar estados distintos como una única prueba superada.

| Caso                                           | Condición y acciones                                                                                                                                     | Qué comprobar                                                                                                                                                                   |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ALM-01 Permisos denegados                      | Denegar notificaciones desde la UI y guardar un recordatorio; mantener alarmas exactas permitidas.                                                       | Diagnóstico correcto y ausencia de afirmación de programación exitosa; recordatorio conservado.                                                                                 |
| ALM-02 Alarmas exactas denegadas               | Permitir notificaciones y denegar alarmas exactas desde Ajustes; intentar actualizar programación.                                                       | Diagnóstico identifica la intervención necesaria y no presenta el aviso como alarma exacta programada.                                                                          |
| ALM-03 Concesión real                          | Conceder ambos permisos desde la UI, volver a Dayflow y actualizar programación con una fecha futura.                                                    | Pendiente confirmado y recepción medida; conservar evidencia del diálogo y del ajuste de alarmas exactas.                                                                       |
| ALM-04 Primer plano                            | Pantalla encendida, app visible, ahorro desactivado.                                                                                                     | Recepción, retraso, sonido/vibración y apertura del recordatorio correcto.                                                                                                      |
| ALM-05 Segundo plano                           | Pulsar Inicio y mantener pantalla encendida sin volver a Dayflow.                                                                                        | Recepción y retraso sin reanudación previa de la app.                                                                                                                           |
| ALM-06 Pantalla bloqueada                      | Programar, pulsar Inicio y bloquear hasta después del vencimiento, sin cargar.                                                                           | Recepción y retraso, visibilidad conforme a privacidad, apertura tras desbloquear.                                                                                              |
| ALM-07 Sin red                                 | Programar previamente, activar modo avión y desactivar Wi-Fi; bloquear.                                                                                  | Recepción local sin conectividad y retraso. No confundir con un cambio aún no descargado del servidor.                                                                          |
| ALM-08 Doze controlado                         | Entrar en IDLE por ADB después de programar; pantalla apagada, sin volver a abrir la app.                                                                | Estado IDLE comprobado antes del vencimiento, recepción y retraso; recuperación al salir.                                                                                       |
| ALM-09 Inactividad natural                     | Sin carga, inmóvil y bloqueado durante una hora y durante la noche; programar avisos dentro de cada sesión.                                              | Recepción y retrasos; registrar por separado si existe evidencia de Doze. Bloqueo prolongado por sí solo no demuestra IDLE.                                                     |
| ALM-10 Ahorro de batería                       | Activar ahorro desde Ajustes, usar optimización habitual de Dayflow, bloquear sin carga.                                                                 | Recepción y retraso frente al ensayo de control; registrar modo del fabricante.                                                                                                 |
| ALM-11 Restricción de fabricante               | Si existe, configurar la restricción de batería más fuerte para Dayflow, anotar su nombre y repetir bloqueo. Después restaurar la configuración inicial. | Medir entrega o falta de entrega y efecto de reabrir; documentar limitación del modelo. Si no existe, no aplicable con motivo.                                                  |
| ALM-12 Reinicio antes del vencimiento          | Programar con margen suficiente, reiniciar físicamente, desbloquear una vez sin abrir Dayflow y volver a bloquear.                                       | Recepción del aviso futuro sin abrir la app, retraso y ausencia de duplicados. Registrar apagado, arranque y primer desbloqueo.                                                 |
| ALM-13 Vencimiento antes del primer desbloqueo | Programar, reiniciar y dejar vencer sin desbloquear. Después desbloquear sin abrir Dayflow.                                                              | Anotar ausencia o recepción antes del desbloqueo, recepción posterior y retraso total. La limitación esperada por lectura del plugin no se marca como entrega puntual superada. |
| ALM-14 Vencimiento con teléfono apagado        | Apagar antes de la fecha, mantener apagado hasta después del vencimiento, encender y desbloquear sin abrir Dayflow.                                      | No se espera recepción estando apagado; medir recuperación posterior, retraso total y desde el desbloqueo, y posibles duplicados.                                               |
| ALM-15 Revocación y restauración               | Con un aviso programado revocar alarmas exactas; regresar a la app. Restaurar el permiso y actualizar con una fecha futura. Repetir para notificaciones. | Diagnóstico coherente, error o pendiente recuperable y recepción de la nueva programación. Anotar cada permiso por separado.                                                    |
| ALM-16 Cancelación                             | Editar fecha, eliminar otro aviso y, en otro ensayo, cerrar sesión antes del vencimiento.                                                                | Sólo llega el aviso vigente; no llegan los cancelados. Los entregados propios se retiran al cerrar sesión.                                                                      |

La revocación de alarmas exactas puede cancelar las alarmas futuras del sistema; volver a conceder el permiso requiere comprobar la reprogramación. Un reinicio también requiere restauración: la declaración del receptor no acredita su ejecución. [Alarmas de Android](https://developer.android.com/develop/background-work/services/alarms).

## Doze controlado y restauración

Ejecutar sólo cuando haya un teléfono físico seleccionado explícitamente mediante `SERIAL`. Estos comandos quedan preparados; no se han ejecutado sobre el emulador ni sobre un teléfono en esta tarea.

```powershell
$dayflowAdb = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
# Tras programar y poner Dayflow en segundo plano, apagar la pantalla manualmente.
& $dayflowAdb -s SERIAL shell dumpsys battery unplug
& $dayflowAdb -s SERIAL shell dumpsys deviceidle force-idle
& $dayflowAdb -s SERIAL shell dumpsys deviceidle
# Comprobar mState=IDLE. Si no entra, registrar el motivo; no dar el caso por ejecutado.
# Esperar y observar externamente hasta terminar el ensayo.
# Restaurar siempre, también cuando la prueba falle o se interrumpa:
& $dayflowAdb -s SERIAL shell dumpsys deviceidle unforce
& $dayflowAdb -s SERIAL shell dumpsys battery reset
& $dayflowAdb -s SERIAL shell dumpsys deviceidle
& $dayflowAdb -s SERIAL shell dumpsys battery
```

El estado simulado de batería no demuestra descarga real. Para inactividad natural, desconectar el cable. Los comandos de entrada/salida se basan en la [guía oficial de pruebas de Doze](https://developer.android.com/training/monitoring-device-state/doze-standby).

## Ficha de evidencia por intento

| Campo                                                           | Valor a completar |
| --------------------------------------------------------------- | ----------------- |
| Caso e intento                                                  | Pendiente         |
| Modelo, Android/API, WebView, SHA, huella APK                   | Pendiente         |
| Fecha/zona, permisos y canal                                    | Pendiente         |
| Batería, carga, ahorro, optimización, red y estado app/pantalla | Pendiente         |
| Estado Doze confirmado y hora de entrada, si aplica             | Pendiente         |
| Identificador del recordatorio y aviso, si disponible           | Pendiente         |
| Hora programada, primera recepción y precisión                  | Pendiente         |
| Retraso o intervalo de retraso, en segundos                     | Pendiente         |
| Hora límite de observación si no se recibe                      | Pendiente         |
| Recepción al despertar, desbloquear o reabrir                   | Pendiente         |
| Duplicados, sonido/vibración y apertura                         | Pendiente         |
| Esperado, observado, resultado y archivo de evidencia           | Pendiente         |
| Configuración restaurada al terminar                            | Pendiente         |

Capturas y grabaciones deben evitar correos y datos personales. No guardar tokens ni contraseñas. Consultar `dumpsys alarm` filtrado por `com.dayflow.app` puede apoyar la evidencia de programación, pero no acredita presentación. Evitar volcar notificaciones de otras aplicaciones.

## Criterio de cierre

Completar la matriz en hardware real y registrar recepción y retraso por condición, incluyendo los fallos y los límites observados. Para los casos positivos, sólo marcar **superado** si hay recepción sin una intervención distinta de la prevista y con retraso medido; no afirmar puntualidad sólo por recepción posterior. No hay un SLA numérico definido en la política de Dayflow: comunicar medidas individuales y mínimo/máximo por condición, sin inventar una tolerancia.

Si no llega, mantener observación al menos 30 minutos después del vencimiento en ensayos cortos y comprobar también tras salir de la condición. Registrar **fallido en esa ventana**, sin afirmar que nunca llegará. En sesiones prolongadas observar hasta terminar la sesión y anotar la recepción posterior. Estados: pendiente, superado, fallido o no aplicable con motivo. Un resultado fallido documentado completa la investigación de ese caso, pero no certifica compatibilidad ni corrige el fallo.

El cupo de 60, cambios de hora/zona y fallos parciales se validarán en la tarea específica de recuperación del planificador. Referencias internas: [política de notificaciones](../notifications-policy.md), [recordatorios](../reminders.md) y [capacidad y recuperación](../notification-capacity.md).
