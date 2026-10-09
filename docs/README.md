# Documentación de Dayflow

Las guías describen el comportamiento implementado; las auditorías conservan observaciones y propuestas fechadas. Los resultados históricos no certifican el commit actual.

## Guías

- [android-local](android-local.md)
- [architecture](architecture.md)
- [calendar](calendar.md)
- [dashboard](dashboard.md)
- [database](database.md)
- [hosted-backend](hosted-backend.md)
- [implementation-plan](implementation-plan.md)
- [inbox-search-tags](inbox-search-tags.md)
- [local-backend](local-backend.md)
- [notes](notes.md)
- [pwa-native](pwa-native.md)
- [relations](relations.md)
- [release-validation](release-validation.md)
- [reminders](reminders.md)
- [sync](sync.md)
- [tasks](tasks.md)
- [vercel](vercel.md)
- [verification](verification.md)
- [web-evaluation](web-evaluation.md)
- [web-push](web-push.md)

- [Auditorías](audits/README.md)

- [Política de notificaciones](notifications-policy.md)

## Mantenimiento

Al cambiar comportamiento, comandos, límites o migraciones, actualiza la guía correspondiente en el mismo PR. Documenta cada migración en database.md. Ejecuta `npm run docs:check` y `npm run test:docs`. CI comprueba rutas locales, anclas, índice y cobertura de migraciones; no verifica semántica técnica ni disponibilidad de enlaces externos.

Conserva los resultados fechados en verification.md: SHA, entorno, comandos, códigos de salida y artefactos. Las pruebas físicas y Supabase real requieren evidencia independiente.
