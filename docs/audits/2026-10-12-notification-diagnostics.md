# Verificación del diagnóstico de notificaciones

Fecha: 12 de octubre de 2026, Europe/Madrid. Rama: `validation/notification-diagnostics`.
Referencia inicial: `ccbf554`, sin cambios de producto durante esta revisión.
Estado: **criterio funcional completado** para la presentación del diagnóstico existente. Lecturas y recepción en hardware real permanecen fuera de esta certificación.

## Funcionalidad existente

La tarea «Mostrar diagnóstico de notificaciones» ya está implementada en **Configuración → Diagnóstico de notificaciones** mediante `NotificationDiagnostics.tsx` y `services/notifications/diagnostics.ts`. No se añade una segunda interfaz ni se cambia el planificador para esta verificación.

| Criterio solicitado     | Comportamiento implementado                                                                                                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mecanismo activo        | Distingue Web Push registrado para la cuenta, ausencia de suscripción y alarmas locales activas/inactivas.                                                                                      |
| Permisos                | Muestra notificaciones y, en Android, permiso de alarmas exactas. Permiso web concedido no equivale a suscripción activa.                                                                       |
| Avisos programados      | En nativo cruza IDs del sistema con trabajos futuros de la cuenta; excluye avisos vencidos e IDs ajenos. En web cuenta recordatorios próximos y aclara que no son alarmas del dispositivo.      |
| Renovación/intervención | Indica activar Push, permitir notificaciones/alarmas exactas, renovar suscripción caducada o actualizar programación pendiente/incompleta. No inventa caducidad si el proveedor no la comunica. |
| Límites                 | Explica hasta 60 avisos/366 días, renovación al abrir/reanudar, conectividad y restricciones de batería/navegador. No garantiza entrega por existir un ID pendiente.                            |
| Lectura fallida         | Muestra error sin afirmar que esté activo ni que haya cero pendientes.                                                                                                                          |

La lectura se actualiza cada minuto, con foco/conectividad, tras eventos de programación y con **Comprobar estado de avisos**. Las consultas locales se filtran por `userId` y el componente se remonta al cambiar de cuenta. El diagnóstico lee el estado; no pide permisos ni activa suscripciones por abrir Configuración.

## Validación

- `npm run test -- --pool=vmThreads --maxWorkers=1 src/services/notifications/diagnostics.test.ts`: **7/7 correctas**, 48,09 s.
- `npm run test:pwa -- --grep "diagnóstico|Web Push registra"`: **4/4 correctos**, cero reintentos, aproximadamente un minuto. Dos escenarios en los dos perfiles (`pwa-desktop` y `pwa-mobile`): suscripción por consentimiento/activación/revocación y diagnóstico con permiso concedido sin suscripción.
- Las comprobaciones de UI confirman mecanismo inactivo, explicación de que el permiso solo no activa Push, distinción entre recordatorios y alarmas del dispositivo y orientación para activar avisos. El otro escenario verifica el cambio a suscripción activa.
- Capturas locales generadas en `test-results-pwa/` y revisadas: escritorio legible; la captura de región móvil contiene una superposición del enlace «Saltar al contenido», por lo que no se utiliza para certificar un diseño móvil sin solapamientos. Los estados de diagnóstico sí están comprobados por los locators E2E. No se ha determinado si la superposición es propia de la captura de región o del layout real.

No se modificó el producto durante esta tarea: el diagnóstico ya existía. La revisión aporta resultados actuales y cierre documental del criterio de mostrar mecanismo, permisos, pendientes e intervención necesaria; no equivale a una auditoría visual completa ni a entrega de avisos físicos.

Las unitarias usan snapshots controlados y trabajos locales para comprobar mensajes y cálculos. Los E2E PWA usan Chromium de escritorio y emulación móvil, service worker real y Auth/API/Push de fixture. No prueban recepción por un proveedor real, Safari ni lecturas del sistema Android en hardware físico.

El criterio de presentar el diagnóstico queda separado de la validación de alarmas: la recepción, Doze, reinicio y permisos físicos permanecen en el [protocolo Android](2026-10-12-android-alarms.md). iOS nativo está descartado por decisión del usuario; las ramas iOS existentes del adaptador se conservan como código histórico.

Referencias: [política de notificaciones](../notifications-policy.md), [recordatorios](../reminders.md) y [PWA móvil](2026-10-12-pwa-mobile.md).
