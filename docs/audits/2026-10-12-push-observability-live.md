# Instrumentación de Web Push y Cron: despliegue real

12 de octubre de 2026, Europe/Madrid. Rama `feat/web-push-observability`,
commit de código desplegado `e25c7b4`. Proyecto Supabase
`spfrfvpexfnnhwpfinrq`, destino contrastado con `.env.local`.

El usuario solicitó continuar tras la implementación. Se subió la rama y se
ejecutó `npm run push:deploy`: la previsualización mostraba únicamente la
migración `202610120007_push_observability.sql`. Se aplicó, se publicó el emisor
y se configuraron los trabajos `dayflow-web-push` y `dayflow-web-push-monitor`,
ambos activos cada minuto. No se fusionó la rama con `dev` ni se publicó una
web nueva en Vercel.

## Evidencia

- El emisor rechazó POST sin token con HTTP 401 y respondió HTTP 200 a la
  comprobación autenticada antes de configurar los trabajos.
- Primera ejecución persistida: 03:06:13 Europe/Madrid.
- Los dos trabajos registraron `succeeded` a las 03:07. Esto acredita ejecución
  SQL, no entrega ni aceptación del proveedor.
- El monitor recogió a las 03:08 la respuesta HTTP 200 del emisor invocado a
  las 03:07, guardada como tick `succeeded`. El tick más reciente puede figurar
  `queued` hasta el siguiente ciclo del monitor.
- `npm run push:metrics -- 1` devuelve el informe real con agregados horarios,
  umbrales, ticks y alertas. [Captura de la consulta](2026-10-12-push-observability-live.json).
- En esa ventana no hubo recordatorios candidatos ni intentos de envío; los
  ceros de envíos/aceptación describen esa ausencia, no una prueba de entrega.
  Visualización y expiración del mensaje por TTL permanecen `null`.
- No hay alertas activas en la consulta de referencia. Los casos de apertura,
  deduplicación y resolución se verificaron en SQL local, sin provocar fallos
  deliberados en producción.
- Comprobación remota de permisos: `anon` y `authenticated` no tienen SELECT
  sobre `push_attempt_metrics`; `authenticated` no tiene EXECUTE del monitor.

Se conservaron las claves VAPID. No se guardaron tokens, endpoints ni contenido
de recordatorios en esta evidencia. Las 23 pruebas locales, la comprobación de
tipos Deno y los checks de TypeScript/lint precedieron al despliegue. No se
realizó un envío físico nuevo durante esta validación.

## Resultado

El criterio **métricas consultables sin confundir aceptación con visualización**
queda cumplido en el proyecto alojado. La consulta y las alertas administrativas
están operativas; alcance y límites en [la guía](../push-observability.md).
