# Política de notificaciones

Dayflow 0.9.0 (Beta). Política incorporada el 9 de octubre de 2026; validación física pendiente.

Guardar un recordatorio, sincronizarlo, programar su aviso y mostrarlo son estados distintos. Dayflow ofrece notificaciones de mejor esfuerzo; no garantiza alarmas críticas ni entrega exacta en todas las plataformas.

## Web y PWA

Web Push depende del navegador, sistema operativo, conectividad y proveedor. El emisor Supabase comprueba ocurrencias cada minuto; la ventana documentada de recuperación y TTL es de cinco minutos. La aceptación por el proveedor no acredita presentación en pantalla. En el Windows probado históricamente, Chrome termina al cerrar todas sus ventanas y los avisos llegaron al reabrirlo. Dayflow no dispone de receptor nativo Windows.

Los mensajes web utilizan contenido genérico. Los cambios offline no llegan al emisor hasta sincronizar; un mensaje aceptado por el proveedor puede no revocarse inmediatamente. Consulta [Web Push](web-push.md).

## Android e iOS

Capacitor programa notificaciones locales con permisos del sistema. El planificador selecciona hasta 60 avisos próximos dentro de 366 días y reconcilia al reanudar la aplicación. La renovación requiere ejecución posterior. Batería, suspensión, permisos y restricciones del fabricante pueden afectar la entrega. Un identificador pendiente en el sistema no demuestra entrega puntual.

Las pruebas en emulador no acreditan teléfonos físicos. Quedan pendientes reinicio, Doze, revocación/restauración de permisos, cambios horarios y suspensión prolongada. Consulta [recordatorios](reminders.md), [PWA y nativo](pwa-native.md) y [validación de publicación](release-validation.md).

## Diagnóstico en Configuración

La sección **Diagnóstico de notificaciones** consulta permisos, mecanismo activo,
avisos pendientes y renovación para la cuenta actual. No solicita permisos ni
activa suscripciones al abrirse. Se actualiza cada minuto, al recuperar el foco,
al cambiar conectividad y después de activar/desactivar avisos o actualizar la
programación. **Comprobar estado de avisos** permite repetir la lectura.

En web distingue permiso concedido de suscripción registrada para la cuenta,
comprueba caducidad si el proveedor comunica una fecha y muestra cambios de
recordatorios por sincronizar. Cuenta recordatorios locales con próximas fechas
dentro de 366 días, no mensajes en una cola del servidor ni alarmas del sistema.
Sin fecha de caducidad no inventa una fecha de renovación. Explica las restricciones
de navegador detenido, suspensión, ahorro de energía y PWA instalada en iOS.

En nativo muestra permisos de notificación y, en Android, alarmas exactas;
cruza los identificadores pendientes del sistema con los avisos futuros de la
cuenta en este dispositivo. Si faltan confirmaciones o la programación tiene
errores, pendientes o límites, recomienda actualizarla. Recuerda el límite de
60 avisos/366 días y la renovación al abrir o reanudar la app. Las consultas
fallidas se muestran como estado desconocido, sin afirmar que hay cero pendientes.

## Evidencia y evolución

- Guardado local: almacenamiento confirmado en el dispositivo.
- Sincronización remota: confirmación de datos en backend.
- Programación nativa: aviso reconocido como pendiente por el sistema.
- Aceptación Push: proveedor acepta el envío; no acredita visualización.

Los estados displayed, interacted y expired de observabilidad son propuestas de la [auditoría](audits/2026-10-09.md), no garantías implementadas. Para ampliar garantías deben registrarse retrasos, expiraciones y resultados físicos con modelo, sistema, permisos, conectividad y fechas prevista/real.
