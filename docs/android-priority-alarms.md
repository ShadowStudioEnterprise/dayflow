# Avisos prioritarios en Android

Estado del 29 de octubre de 2026: esta guía describe el APK debug experimental instalado y probado en el Redmi Note 11S. La implementación y el parche permanecen en el entorno local de desarrollo y no forman parte de esta publicación documental; los pasos de compilación siguientes requieren esos cambios. El código publicado antes de incorporarlos no ofrece este ajuste.

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

## Verificación

- Pruebas de adaptador: modo Android explícito, exactitud obligatoria, comportamiento habitual por defecto, iOS sin extensión y rechazo sin permiso.
- Pruebas de servicio: preferencia local persistida, cambio reversible, avisos deshabilitados conservados y contenido/cola remota intactos.
- Prueba instrumentada `PriorityAlarmProbeTest`: ciclo de almacenamiento nativo y reconstrucción con `AlarmClockInfo`, hora efectiva sin desplazamiento y retirada exclusiva de sus registros sintéticos.
- La entrega real, la conservación de sesión y los datos se comprueban además en el teléfono; una prueba de registro no equivale por sí sola a certificar la entrega.
