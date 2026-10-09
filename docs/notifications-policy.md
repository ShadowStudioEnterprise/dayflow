# Política de notificaciones

Dayflow 0.9.0 (Beta). Política incorporada el 9 de octubre de 2026; validación física pendiente.

Guardar un recordatorio, sincronizarlo, programar su aviso y mostrarlo son estados distintos. Dayflow ofrece notificaciones de mejor esfuerzo; no garantiza alarmas críticas ni entrega exacta en todas las plataformas.

## Web y PWA

Web Push depende del navegador, sistema operativo, conectividad y proveedor. El emisor Supabase comprueba ocurrencias cada minuto; la ventana documentada de recuperación y TTL es de cinco minutos. La aceptación por el proveedor no acredita presentación en pantalla. En el Windows probado históricamente, Chrome termina al cerrar todas sus ventanas y los avisos llegaron al reabrirlo. Dayflow no dispone de receptor nativo Windows.

Los mensajes web utilizan contenido genérico. Los cambios offline no llegan al emisor hasta sincronizar; un mensaje aceptado por el proveedor puede no revocarse inmediatamente. Consulta [Web Push](web-push.md).

## Android e iOS

Capacitor programa notificaciones locales con permisos del sistema. El planificador selecciona hasta 60 avisos próximos dentro de 366 días y reconcilia al reanudar la aplicación. La renovación requiere ejecución posterior. Batería, suspensión, permisos y restricciones del fabricante pueden afectar la entrega. Un identificador pendiente en el sistema no demuestra entrega puntual.

Las pruebas en emulador no acreditan teléfonos físicos. Quedan pendientes reinicio, Doze, revocación/restauración de permisos, cambios horarios y suspensión prolongada. Consulta [recordatorios](reminders.md), [PWA y nativo](pwa-native.md) y [validación de publicación](release-validation.md).

## Evidencia y evolución

- Guardado local: almacenamiento confirmado en el dispositivo.
- Sincronización remota: confirmación de datos en backend.
- Programación nativa: aviso reconocido como pendiente por el sistema.
- Aceptación Push: proveedor acepta el envío; no acredita visualización.

Los estados displayed, interacted y expired de observabilidad son propuestas de la [auditoría](audits/2026-10-09.md), no garantías implementadas. Para ampliar garantías deben registrarse retrasos, expiraciones y resultados físicos con modelo, sistema, permisos, conectividad y fechas prevista/real.
