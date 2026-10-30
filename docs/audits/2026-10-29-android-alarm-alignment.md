# Investigación del retraso de alarmas — Redmi Note 11S

Registro fechado del APK debug experimental. La implementación prioritaria permanece local y no se incluye en esta publicación documental. Los apartados conservan el orden de las pruebas; los resultados posteriores actualizan los pendientes anteriores. [Guía del modo prioritario](../android-priority-alarms.md).

Fecha: 29 de octubre de 2026. Android 13, build `V816.0.11.0.TKEEUXM`, modelo `2201117SY`.

## Resultado

El retraso se reprodujo **sin Doze**, con la política de batería **Sin restricciones**, confirmada por el usuario. Por tanto, el resultado anterior no demuestra un fallo exclusivo de Doze ni justifica atribuirlo a una opción `allowWhileIdle` ausente.

En la fase inicial no se modificaron código ni APK sin demostrar una causa. La investigación posterior aisló la ruta de alineación del firmware y, por elección expresa del usuario, se preparó y verificó un modo prioritario opcional. Los detalles y el alcance de esa verificación se recogen al final de este informe.

## Evidencia de la prueba de control

Se creó desde el formulario y se sincronizó un recordatorio de diagnóstico para las **22:42:00 Europe/Madrid**. Doze se mantuvo desactivado durante la observación.

La lectura de las preferencias nativas, filtrada exclusivamente por el título de este aviso, confirmó el registro final **ID 25** y `schedule.allowWhileIdle=true`. Las propiedades de exactitud no estaban sobrescritas: el código del plugin usa exactitud por defecto y el sistema confirmó `window=0` y `exactAllowReason=permission`.

Desde antes del vencimiento, AlarmManager mostraba:

- Hora original: **22:42:00.000**.
- Tipo `RTC_WAKEUP`, `window=0`, `flags=0x5`.
- Hora monotónica efectiva: **19500000 ms** desde arranque.
- Conversión a RTC, usando `nowRTC` y `nowELAPSED` del mismo volcado: **22:44:30.662** aproximadamente.
- `device_idle=--`; el monitor confirmó `force=false`.

A las **22:42:03** y **22:43:45** el aviso seguía pendiente, con esa misma hora efectiva. Android publicó la notificación a las **22:44:30.731**: **150,731 segundos después** de la hora original y unos **69 ms después** de la hora efectiva calculada. El plugin confirmó exactamente una entrega.

La medida de reloj por ADB tardó 116 ms; la respuesta del dispositivo tenía resolución de un segundo y no mostraba un desfase de minutos. Hora automática y zona automática estaban activadas. No se modificó la hora del teléfono.

Estos datos sitúan el retraso después del registro nativo y reproducen un desplazamiento observable en AlarmManager fuera de Doze. Son compatibles con una política de ajuste/agrupación del sistema, pero no identifican por sí solos qué componente o regla la aplica. No se cambiaron políticas de batería, cuotas ni listas de exclusión para forzar un resultado positivo.

## Código y APK contrastados

- El adaptador `CapacitorNotificationService.schedule` envía fechas y `allowWhileIdle=true`.
- El plugin instalado es `@capacitor/local-notifications` **8.3.1** y conserva el JSON original en almacenamiento nativo.
- La inspección del bytecode del APK probado confirmó la ruta `LocalNotificationManager.setExactIfPossible` y su llamada a `setExactAndAllowWhileIdle` cuando están habilitadas exactitud y entrega durante reposo.
- El resumen de `getAll` omite el campo `allowWhileIdle`; esa omisión de la respuesta no equivale a pérdida del valor persistido, que se verificó directamente.
- Los permisos de notificaciones y alarmas exactas permanecieron concedidos. Las lecturas de AppOps no mostraron prohibición general de segundo plano. El usuario confirmó **Sin restricciones**; no se alteró ese ajuste.

Android documenta `setExactAndAllowWhileIdle` para alarmas que deben funcionar durante Doze y conserva límites de frecuencia por aplicación. Capacitor expone ese comportamiento mediante `allowWhileIdle`. Estas APIs no constituyen una prueba de entrega puntual en un firmware concreto: la medida de este teléfono sigue siendo la referencia de esta incidencia. [Guía oficial de Doze](https://developer.android.com/training/monitoring-device-state/doze-standby), [documentación de Local Notifications](https://next.capacitorjs.com/docs/apis/local-notifications).

## Evidencias

- `note11s-diagnostic-notification.json`: recordatorio, programación, sincronización y entrega única.
- `note11s-diagnostic-options.json`: opciones originales persistidas, filtradas al aviso de prueba.
- `note11s-alarm-policy-observation.json`: consultas sucesivas y hora real de creación de la notificación.
- `note11s-clock-probe.json`: referencia de reloj con duración de la consulta.
- `note11s-alarm-environment.json`: versión del sistema y política confirmada.

El recordatorio de diagnóstico y su aviso se conservaron. No se ejecutaron desinstalaciones ni borrados de datos. Las observaciones de esta primera fase motivaron las pruebas nativas adicionales y el modo opcional descritos a continuación.

## Causa aislada y modo prioritario opcional

Se inspeccionó, sin modificar, la biblioteca pública del firmware `miui-services.jar`. `com.android.server.alarm.AlarmManagerServiceStubImpl.alignAlarmLocked` comprueba pantalla apagada, aplica una política de alineación con periodo predeterminado de **300.000 ms** y excluye las alarmas que contienen `AlarmClockInfo`. La regla no se limita a Doze y `allowWhileIdle` no es esa excepción.

La comparación real mantuvo la misma fecha de **23:05** sin desplazamiento al registrarla con pantalla encendida. Pasar la app a segundo plano y apagar la pantalla no cambió por sí solo el objetivo existente. Al renovar su programación con la pantalla apagada, pasó a **23:09:30.662** y se publicó a **23:09:30.735**. Esto distingue el registro o la reprogramación durante pantalla apagada del simple paso a segundo plano.

Una prueba instrumentada adicional, con la identidad de Dayflow y pantalla apagada, comparó cuatro APIs. Las variantes exactas RTC, exacta RTC permitida en reposo y exacta por tiempo transcurrido quedaron desplazadas **154.218 ms**; la de reloj conservó el objetivo sin desplazamiento. La prueba terminó retirando únicamente sus cuatro operaciones sintéticas.

El usuario eligió preparar **Avisos prioritarios en este dispositivo**. Se implementó como preferencia local por cuenta y dispositivo, exclusiva de Android y **desactivada por defecto**. El ajuste usa `setAlarmClock` mediante un parche versionado del plugin, con persistencia nativa para reconstruir alarmas futuras. Se explican en la UI el icono de próxima alarma, la salida del reposo y el posible consumo adicional. No se cambian fechas, contenido remoto, permisos ni políticas globales de batería.

La actualización debug se instaló conservando datos y comprobando la misma firma. Pasaron 35 regresiones, TypeScript, lint, formato, comprobaciones documentales y dos pruebas instrumentadas. La opción persistió al recargar. La entrega real, con pantalla apagada, fue **23:25:00.070** para una fecha de **23:25:00.000**, con un solo aviso y confirmación del usuario de sonido o vibración. Se devolvió el ajuste al estado inicial desactivado y se confirmó integridad de tareas/notas, sesión y cola vacía.

Nuevo APK: SHA-256 `1D855897907DF101A9D2FF994CAEE41D6DEDF0422E29F37D566320A143B4BA2E`. Evidencias adicionales: `priority-native-tests-output.txt`, `priority-native-roundtrip.json`, `native-alarm-comparison-screenoff.json`, `note11s-priority-ui.json`, `note11s-priority-notification.json`, `note11s-priority-observation.json`, `note11s-priority-summary.json` y `note11s-priority-final-integrity.json`.

La mejora está verificada para la prueba de pantalla apagada y el ciclo nativo de almacenamiento/reconstrucción. El ensayo de 15 minutos y el reinicio físico **no se han repetido aún con el modo nuevo**; los resultados anteriores de esos casos pertenecen al modo habitual. No se presenta una garantía universal de entrega.

## Aviso prioritario prolongado — 29 de octubre de 2026

Se activó temporalmente el modo prioritario desde Configuración y se programó un aviso para las **23:51:00,000 Europe/Madrid**. La observación con pantalla apagada duró **955 segundos** hasta detectar la entrega, con **32 muestras** y sin interrupciones de ADB. Android publicó el aviso a las **23:51:00,132**, **132 ms** después del objetivo. El sistema y el plugin confirmaron **una única entrega**.

**Pasa la entrega puntual prolongada con pantalla apagada. No se certifica Doze profundo durante 15 minutos.** La orden de entrada devolvió `Unable to go deep idle; stopped at INACTIVE`; ninguna muestra acreditó IDLE profundo. Se observó reposo ligero (`mLightState=IDLE`) mientras el estado profundo seguía en INACTIVE. Se retiró enseguida la solicitud forzada al no confirmar la entrada y se continuó únicamente la observación de entrega.

El dispositivo declara `min_time_to_alarm=+30m0s0ms`. El [código público de Android](https://android.googlesource.com/platform/prebuilts/fullsdk/sources/android-30/+/refs/heads/main/com/android/server/DeviceIdleController.java) comprueba la proximidad de la siguiente alarma de despertar antes de avanzar a reposo profundo. Esto es compatible con el rechazo observado; no se ha demostrado que la implementación de este firmware coincida en todos sus detalles. No se alteraron constantes globales de Doze ni la política «Sin restricciones» para forzar un resultado positivo.

La confirmación perceptiva del usuario es: **Sí, con la pantalla apagada y sonido o vibración**. La hora anterior corresponde a la publicación medida por Android, no a una medición acústica.

Se restauró la preferencia prioritaria inicial **desactivada**, se retiró Doze forzado y se restableció la lectura normal de batería. La misma cuenta sigue autenticada; las dos tareas originales y la huella de las tres notas se mantienen; la cola está vacía. No se desinstaló ni borró información. Los recordatorios de prueba se conservan. El reinicio físico con el modo prioritario no se ha repetido.

Evidencia: `note11s-priority-prolonged-{doze,notification,observation,screen,ui,summary,final-integrity}.json`. El APK es el mismo debug ya instalado, SHA-256 `1D855897907DF101A9D2FF994CAEE41D6DEDF0422E29F37D566320A143B4BA2E`; no se cambió código de aplicación en esta continuación.
