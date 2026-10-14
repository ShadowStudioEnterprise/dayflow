# Alarmas Android: casos restantes — 14 de octubre de 2026

Rama: `validation/android-alarms-remaining`. El usuario solicita completar Doze, inactividad prolongada, permisos, cancelación y variantes de reinicio.

## Referencia de la ronda

- Dispositivo previsto: Redmi 9A / M2006C3LG, Android 11/API 30, WebView 97. Identidad obtenida en la ronda anterior; comprobar de nuevo por ADB si se conecta.
- APK preparado: `.toolchains/redmi-9a/Dayflow-0.9.0-notification-setup.apk`; código `f8c0b66178fbf4cb59f36efc2d07f88af49133e6`, SHA-256 `5930A7158F3E0B0B49BD96298F183803409985C19F2D571F947DDBFE3BD3D8F6`. Huella local contrastada al iniciar esta ronda.
- El usuario informa que todavía no ha actualizado y que va a conectar el Redmi. Las dos consultas iniciales ADB no detectan dispositivos. Instalación del APK y asistente **pendientes de confirmación**; ningún ensayo de esta ronda ejecutado todavía.
- Resultados anteriores: tres recepciones con bloqueo, tres de avisos creados offline y tres con ahorro, con horas informadas a precisión de minutos. Una recepción después de reinicio bajo protocolo de Autoinicio activado, con campos incompletos; primer intento sin recepción y ventana no delimitada. No trasladar esos resultados al APK nuevo. [Registro anterior](2026-10-12-redmi-9a.md).
- La repetición adicional de ALM-12 fue omitida por decisión del usuario. La nueva solicitud incluye variantes pendientes de reinicio; no se presume que reautorice automáticamente esa repetición omitida.

## Matriz de esta ronda

Actualización de preparación: el usuario confirma APK actualizado, asistente completado, sonido y Autoinicio activados. ADB detecta el serial físico `DAXOGEL7HY7PX47D`, producto `dandelion_eea`, modelo `M2006C3LG`, API **30**. SHA-256 de `base.apk` instalado **coincide** con `5930A7158F3E0B0B49BD96298F183803409985C19F2D571F947DDBFE3BD3D8F6`. Lectura exclusiva de preferencias del asistente: `completed-v1=true`, `autostartConfirmed=true`; este último sigue siendo una confirmación del usuario, no lectura del permiso MIUI. Batería **100 %**, corriente y USB informados como conectados.

Control de reloj: referencia UTC `2026-10-14T15:58:40.677+00:00`, muestra ADB de 78 ms y resolución del reloj del dispositivo de un segundo; desfase aproximado **−20,6 segundos**. Se solicita revisar fecha/hora automática antes de medir recepción; no usar el retraso aparente frente al ordenador como latencia del planificador sin corregir/registrar este desfase. No se cambió la hora mediante ADB.

Lectura posterior: `auto_time=0`, `auto_time_zone=1`; hora automática desactivada. Estado de inactividad inicial `mForceIdle=false`, `mCharging=true`, `mState=ACTIVE`, `mLightState=ACTIVE`. No se ha forzado Doze ni simulado batería todavía. Activar hora automática antes de la prueba de recepción y comprobar otra vez el desfase.

ALM-01/15 notificaciones solicitado: crear aviso de prueba a más de diez minutos y confirmar programación, revocar únicamente notificaciones desde Ajustes, volver a Diagnóstico y comprobar Bloqueado, conservación del recordatorio y estado de programación coherente. **Pendiente de resultado**; restauración y recepción se ejecutarán después de registrar la revocación.

ALM-01/15, revocación: el usuario informa **«Bloqueado en el sistema, necesita permisos del sistema»**. Detección e indicación de intervención confirmadas manualmente; conservación del recordatorio y contadores no informados expresamente. Restauración solicitada desde Ajustes, edición del mismo recordatorio a una fecha futura y Actualizar programación, comprobando Permitido y aviso confirmado antes de observar recepción. **Pendiente de resultado**. USB conectado solicitado en esta variante; no equiparar al ensayo anterior sin carga. ADB sigue conectado y `auto_time=1` tras la petición de corrección; falta contrastar desfase antes de medir.

Control posterior con hora automática: muestra ADB de 101 ms, desfase aproximado **+0,8 segundos**, a resolución de un segundo. No se ha obtenido una hora de recepción con precisión de segundos del usuario.

ALM-03/15, restauración, respuesta manual: **14 de octubre, previsto 19:00 y recibido 19:00**, sonido **sí**, apertura **sí**, «estado si» en respuesta al protocolo de programación confirmada. Recepción positiva después de restauración bajo el procedimiento solicitado, con precisión de minutos; vibración y conservación del recordatorio no informadas expresamente. No se infiere recepción a cero segundos ni datos faltantes. La condición con USB difiere de la prueba sin carga anterior.

Preparación ALM-08: ADB vuelve a detectar el mismo Redmi; estado inicial ACTIVE, force-idle desactivado y carga activa. La consulta de whitelist no contiene `com.dayflow.app`. Solicitado aviso a ocho minutos o más, programación confirmada, Inicio y bloqueo manteniendo USB, ahorro desactivado y Autoinicio; **pendiente de hora prevista y confirmación de bloqueo** antes de forzar Doze. No se ha cambiado batería ni inactividad todavía.

| Caso                             | Ensayo                                                                                                                                                    | Estado                                                              |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Preparación                      | Actualizar sin borrar datos, completar asistente, leer permisos/sonido/Autoinicio, fecha/hora, batería y optimización                                     | Pendiente                                                           |
| ALM-01 / 03 / 15, notificaciones | Revocar desde Ajustes con aviso futuro; comprobar diagnóstico y conservación del recordatorio. Restaurar, renovar fecha/programación y observar recepción | Pendiente                                                           |
| ALM-02 / 15, alarmas exactas     | Revocar/restaurar permiso especial                                                                                                                        | No aplicable en Redmi Android 11; pendiente en hardware Android 12+ |
| ALM-08                           | Programar, entrar en IDLE por ADB, comprobar estado y recepción; restaurar simulación de batería/inactividad                                              | Pendiente de conexión ADB                                           |
| ALM-09, una hora                 | Inmóvil, bloqueado y sin carga durante al menos una hora, con aviso dentro de la sesión y observación externa                                             | Pendiente                                                           |
| ALM-09, nocturna                 | Mismas condiciones durante la noche, registrar inicio/fin, movimientos y despertares                                                                      | Pendiente                                                           |
| ALM-11                           | Leer restricción de batería de Dayflow; ensayar la más fuerte si existe y restaurar su valor inicial                                                      | Pendiente                                                           |
| ALM-13                           | Reiniciar y dejar vencer antes del primer desbloqueo; observar antes/después de desbloquear sin abrir Dayflow                                             | Pendiente                                                           |
| ALM-14                           | Mantener apagado durante el vencimiento; encender/desbloquear sin abrir Dayflow y observar recuperación                                                   | Pendiente                                                           |
| ALM-16, edición                  | Cambiar fecha futura; comprobar que no llega en la antigua y sí en la nueva                                                                               | Pendiente                                                           |
| ALM-16, eliminación              | Eliminar un recordatorio de prueba futuro; confirmar retirada de programación y ausencia en su ventana                                                    | Pendiente                                                           |
| ALM-16, salida                   | Cerrar sesión con cero pendientes antes del vencimiento; confirmar limpieza de avisos pendientes/entregados y ausencia posterior                          | Pendiente                                                           |

El permiso especial `SCHEDULE_EXACT_ALARM` se incorporó en Android 12. El plugin instalado devuelve `granted` en API inferiores a 31 y no abre un selector de revocación: el diagnóstico «Permitido» en Android 11 no demuestra concesión interactiva de ese permiso. [Android 12](https://developer.android.com/about/versions/12/behavior-changes-12).

## Ejecución y evidencia

Seguir el [protocolo completo](2026-10-12-android-alarms.md). Hacer cada cambio de ajuste por separado y anotar su valor inicial para restaurarlo. Mantener Autoinicio activado para las pruebas posteriores de reinicio, si el usuario completa el asistente; no cambiar simultáneamente optimización, permisos y red.

Registrar por intento fecha y zona Europe/Madrid, SHA/APK, hora prevista y primera recepción, precisión del reloj, app/pantalla/red/carga, permisos/sonido, ahorro/optimización y Autoinicio, diagnóstico de programación, sonido/vibración, visibilidad, apertura y duplicados. No anotar tokens, contraseñas ni enlaces de acceso. Las horas a precisión de minutos no equivalen a cero segundos de latencia.

Para ausencia de recepción, observar treinta minutos después del vencimiento antes de reabrir, y anotar recepción diferida al desbloquear/abrir. No interpretar ausencia como eliminación del recordatorio. En cancelación, usar sólo recordatorios de prueba creados para este ensayo.

Para Doze seleccionar exclusivamente el serial físico; registrar IDLE antes del vencimiento. Restaurar `deviceidle unforce` y `battery reset` al terminar o ante error. Las pruebas sin carga/inmovilidad no certifican Doze sin lectura del sistema; dejar constancia de esa limitación. [Pruebas oficiales de Doze](https://developer.android.com/training/monitoring-device-state/doze-standby).

La ronda sigue abierta hasta tener resultados o límites explícitos por caso. Preparar el protocolo no constituye ejecución en hardware.
