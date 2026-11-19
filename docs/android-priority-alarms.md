# Avisos prioritarios en Android

El PR #11 integró en `main` la implementación de avisos prioritarios y el parche reproducible de Capacitor (`b023b1f`, merge `086ed94`). El 14 y 15 de noviembre de 2026 se probó la versión integrada en el Redmi Note 11S con la APK debug 0.9.0 (código 1) de `dd4ac54`. Se confirmó la recepción tras reiniciar y desbloquear. En el ensayo de Doze profundo, Android volvió a salir de `IDLE` antes de emitir el aviso. Sigue pendiente verificar la entrega durante `IDLE` profundo y acreditar que Dayflow permaneció cerrada tras el reinicio. [Resultados físicos de la APK integrada](audits/2026-10-29-redmi-note11s.md#apk-integrada-del-14-y-15-de-noviembre-de-2026).

En **Configuración → Notificaciones en este dispositivo**, activa **Avisos prioritarios en este dispositivo** cuando necesites que Android trate los avisos como alarmas de reloj. La opción está desactivada por defecto.

Este modo puede mostrar el icono de próxima alarma, abrir Dayflow desde ese acceso y sacar el teléfono del reposo para entregar un aviso. Puede consumir más batería. Sigue necesitando los permisos de notificaciones y alarmas exactas.

La preferencia se guarda para la cuenta en este dispositivo. No cambia fechas ni contenido de recordatorios y no se envía a Supabase. No se aplica a web ni iOS. Al desactivarla se vuelve a la programación habitual; si los avisos estaban desactivados, cambiar la prioridad no los reactiva.

## Motivo del modo opcional

En un Redmi Note 11S con Android 13 y build `V816.0.11.0.TKEEUXM`, se reprodujo una alineación de alarmas al programarlas con la pantalla apagada, incluso con `allowWhileIdle=true`, permiso de exactitud y batería en «Sin restricciones». Una misma fecha registrada sin desplazamiento con la pantalla encendida quedó desplazada al renovarla con la pantalla apagada.

La implementación del firmware inspeccionada contiene `AlarmManagerServiceStubImpl.alignAlarmLocked`, con periodo predeterminado de 300.000 ms y una excepción para `AlarmClockInfo`. El modo prioritario utiliza esa categoría pública de Android. Esto explica la decisión de ofrecerlo como elección explícita: no se oculta el impacto de una alarma de reloj ni se modifica la política global del teléfono.

No constituye una promesa de entrega bajo cualquier circunstancia. Teléfono apagado, permisos revocados y otras restricciones del sistema siguen requiriendo comprobación real. [Documentación oficial de alarmas Android](https://developer.android.com/develop/background-work/services/alarms).

## Compilación reproducible

El soporte nativo se conserva mediante `patch-package`, fijado en las dependencias de desarrollo, y `patches/@capacitor+local-notifications+8.3.1.patch`. `npm ci` ejecuta el parche mediante `postinstall`; un fallo de aplicación devuelve error. Después se usan los pasos habituales de build, `cap sync android` y Gradle.

El campo nativo `schedule.dayflowAlarmClock` es una extensión local de Dayflow. El JSON original queda persistido por el plugin y el receptor de arranque lo lee al reconstruir las alarmas futuras. Los avisos prioritarios no se degradan silenciosamente a alarmas inexactas si falta el permiso especial. El cambio no añade permisos Android ni cambia los receptores de entrega, las acciones al tocar un aviso o la identidad de la aplicación.

Al actualizar `@capacitor/local-notifications`, hay que revisar y regenerar el parche, compilar y repetir las pruebas nativas. No se debe eliminar el error de `postinstall` para ocultar una incompatibilidad.

## Resultados físicos del 29 de octubre

El aviso de las 23:25 se publicó una vez a las 23:25:00.070. En la observación prolongada, el de las 23:51 se publicó una vez a las 23:51:00.132; el usuario confirmó recepción con pantalla apagada y sonido o vibración. Android rechazó entrar en Doze profundo y sólo se observó reposo ligero: no se certifica un intervalo de 15 minutos en IDLE profundo. Se restauraron la prioridad inicial desactivada y los ajustes temporales; sesión y datos intactos y cola vacía.

Consulta los informes de [validación completa](audits/2026-10-29-redmi-note11s.md), [investigación de alineación](audits/2026-10-29-android-alarm-alignment.md) y [observación prolongada](audits/2026-10-29-priority-prolonged.md).

## Resultados físicos de la APK integrada — 14 y 15 de noviembre

QA-07 incorpora los resultados de AND-03 y AND-04 ya registrados en la [auditoría del Redmi](audits/2026-10-29-redmi-note11s.md#apk-integrada-del-14-y-15-de-noviembre-de-2026). Entorno: Redmi Note 11S (2201117SY), Android 13, APK debug estándar `com.dayflow.app` 0.9.0 (código 1), base `dd4ac54`, SHA-256 `DC5DE54601DDFF1599D9C49B66A0F25D704F350EC5E801D6C06ADDDEE96953FF`. Autoinicio desactivado (`MIUIOP(10008): ignore`) y Ahorro de batería recomendado. Horas en CET (Europe/Madrid).

| Caso           | Configurado y programado                                   | Emitido y recibido                                                                                                    | Límite de la evidencia                                                                                                                                                                                                    |
| -------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AND-03 · 14/11 | Prioridad activada; alarma de reloj para las 22:53.        | Android emitió el aviso tras reiniciar y desbloquear por primera vez; recepción con sonido y notificación confirmada. | No se acreditó de forma independiente que Dayflow permaneciera cerrada tras reiniciar. No acredita entrega antes del primer desbloqueo.                                                                                   |
| AND-04 · 14/11 | Prioridad activada; alarma de reloj exacta para las 23:26. | Publicador nativo y notificación activa a las 23:26:12, con estado `ACTIVE`; sonido y notificación confirmados.       | `force-idle` solo alcanzó `INACTIVE`; no acredita entrada ni entrega en Doze profundo.                                                                                                                                    |
| AND-04 · 15/11 | Prioridad activada; alarma de reloj exacta para las 19:30. | Publicador nativo alrededor de las 19:30 y notificación activa; sonido y notificación confirmados.                    | Entró en `IDLE` a las 18:40:10 y salió a las 19:25:46 con motivo `alarm`, 4 min 14 s antes del vencimiento. El registro no identifica qué alarma causó la salida. La recepción ocurrió después de salir de Doze profundo. |

En los ensayos de Doze se restauraron el reposo y la lectura real de batería mediante `dumpsys deviceidle unforce` y `dumpsys battery reset`; se comprobaron `ACTIVE`, `mForceIdle=false` y carga AC real. Son comandos de los ensayos históricos, no una nueva prueba ejecutada al actualizar QA-07.

**Pendiente:** recepción mientras el teléfono permanece en `IDLE` profundo y reinicio con Dayflow acreditadamente cerrada. Estos resultados corresponden a la APK debug identificada; no validan automáticamente la candidata release de [QA-06](release-validation.md#resultado-de-qa-06), otros dispositivos ni versiones posteriores. QA-07 completa la actualización documental y conserva esos límites físicos.

## Verificación

- Pruebas de adaptador: modo Android explícito, exactitud obligatoria, comportamiento habitual por defecto, iOS sin extensión y rechazo sin permiso.
- Pruebas de servicio: preferencia local persistida, cambio reversible, avisos deshabilitados conservados y contenido/cola remota intactos.
- Prueba instrumentada `PriorityAlarmProbeTest`: ciclo de almacenamiento nativo y reconstrucción con `AlarmClockInfo`, hora efectiva sin desplazamiento y retirada exclusiva de sus registros sintéticos.
- La entrega real, la conservación de sesión y los datos se comprueban además en el teléfono; una prueba de registro no equivale por sí sola a certificar la entrega.
