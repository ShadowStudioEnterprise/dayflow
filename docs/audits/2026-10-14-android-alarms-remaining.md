# Alarmas Android: casos restantes — 14 de octubre de 2026

Rama: `validation/android-alarms-remaining`. El usuario solicita completar Doze, inactividad prolongada, permisos, cancelación y variantes de reinicio.

## Referencia de la ronda

- Dispositivo previsto: Redmi 9A / M2006C3LG, Android 11/API 30, WebView 97. Identidad obtenida en la ronda anterior; comprobar de nuevo por ADB si se conecta.
- APK preparado: `.toolchains/redmi-9a/Dayflow-0.9.0-notification-setup.apk`; código `f8c0b66178fbf4cb59f36efc2d07f88af49133e6`, SHA-256 `5930A7158F3E0B0B49BD96298F183803409985C19F2D571F947DDBFE3BD3D8F6`. Huella local contrastada al iniciar esta ronda.
- El usuario informa que todavía no ha actualizado y que va a conectar el Redmi. Las dos consultas iniciales ADB no detectan dispositivos. Instalación del APK y asistente **pendientes de confirmación**; ningún ensayo de esta ronda ejecutado todavía.
- Resultados anteriores: tres recepciones con bloqueo, tres de avisos creados offline y tres con ahorro, con horas informadas a precisión de minutos. Una recepción después de reinicio bajo protocolo de Autoinicio activado, con campos incompletos; primer intento sin recepción y ventana no delimitada. No trasladar esos resultados al APK nuevo. [Registro anterior](2026-10-12-redmi-9a.md).
- La repetición adicional de ALM-12 fue omitida por decisión del usuario. La nueva solicitud incluye variantes pendientes de reinicio; no se presume que reautorice automáticamente esa repetición omitida.

## Matriz de esta ronda

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
