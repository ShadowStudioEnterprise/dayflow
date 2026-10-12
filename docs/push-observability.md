# Métricas y alertas de Web Push y Cron

Implementación en la rama `feat/web-push-observability`, creada desde `dev` el
12 de octubre de 2026. La migración, el emisor y el monitor se desplegaron ese
mismo día en el proyecto alojado; consulta la [verificación real](audits/2026-10-12-push-observability-live.md).
No modifica las suscripciones existentes ni rota claves VAPID.

## Consultar

Después de desplegar, con la CLI de Supabase autenticada y el proyecto enlazado:

```sh
npm run push:metrics
npm run push:metrics -- 6
```

La consulta usa administración de Supabase, verifica el destino contra
`.env.local` y devuelve JSON con cobertura, agregados horarios, alertas activas
y resueltas, los últimos 20 ticks de Cron y umbrales. Acepta ventanas de 1 a 336
horas. Los buckets son horarios completos: el primer bucket puede empezar
antes del límite exacto solicitado. Los timestamps usan UTC.

También puede consultarse desde SQL Editor:

```sql
select * from public.dayflow_push_metrics_hourly order by hour desc;
select * from public.push_operational_alerts order by active desc, code;
select tick_at, state, http_status, observed_at
from public.push_cron_ticks order by tick_at desc limit 20;
select jobname, active, schedule from cron.job
where jobname in ('dayflow-web-push', 'dayflow-web-push-monitor');
```

Las tablas tienen RLS y acceso administrativo exclusivo. `anon` y
`authenticated` no pueden leerlas, escribirlas ni ejecutar el monitor. No se
guardan correos, títulos, contenidos, endpoints, claves ni tokens. Los UUID de
las métricas identifican la ejecución y el intento, no una cuenta.

## Qué significa cada métrica

| Métrica                                                | Significado                                                                                           |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `attempts`                                             | Resultados persistidos de preparación/transporte, incluidos errores de generación                     |
| `sends`                                                | Peticiones HTTP iniciadas; un error de transporte no acredita que el proveedor las recibiera          |
| `provider_accepted`                                    | Respuestas HTTP 2xx observadas del proveedor; **no visualización en pantalla**                        |
| `send_failures`                                        | Rechazos HTTP, errores de transporte y errores de generación; 404/410 se contabilizan aparte          |
| `expired_endpoints`                                    | Respuestas 404/410: suscripción retirada; no significa que caducara un mensaje por TTL                |
| `dispatch_window_expired`                              | Ocurrencias elegibles vistas dentro del lote que superan los cinco minutos antes de reservar el envío |
| `avg_dispatch_delay_ms`, `max_dispatch_delay_ms`       | Desde la hora de ocurrencia hasta iniciar la petición al proveedor, no hasta recibir el aviso         |
| `avg_provider_duration_ms`                             | Duración del transporte y liberación del cuerpo HTTP, no llegada al dispositivo                       |
| `recurrence_failures`                                  | Recordatorios cuya recurrencia no pudo calcularse                                                     |
| `unfinished_runs`, `failed_runs`, `metrics_error_runs` | Ejecuciones sin finalizar, fallidas y con fallo conocido de persistencia de métricas                  |
| `visualized`                                           | `null`: no instrumentado; nunca se representa como cero ni como aceptación                            |
| `provider_message_ttl_expired`                         | `null`: el proveedor no informa aquí de expiración del mensaje por TTL                                |

Los contadores son de **intentos**, incluidos reintentos; no representan avisos
únicos ni entrega exactamente una vez. Los resultados aceptados sobreviven a
la retirada de la suscripción, ya que las métricas no dependen de su fila.

El emisor guarda una ejecución antes de enviar y un registro por intento antes
de actualizar el marcador de entrega. Si falla este último, se conserva la
aceptación y la ejecución queda fallida. Si el proceso termina antes de guardar
el intento, ese envío puede faltar en las métricas: un run sin finalizar o un
error de métricas identifica cobertura incompleta. No se completan huecos con
ceros inventados. Los logs JSON solo incluyen contadores, identificador del run
y códigos cerrados de error.

La ventana vencida es una medición parcial: no cuenta todas las ocurrencias
perdidas durante una caída prolongada ni las descartadas por el worker. Tampoco
se deducen visualización, interacción ni TTL del hecho de no recibir un aviso.

## Alertas operativas

`dayflow-web-push-monitor` ejecuta el monitor cada minuto, independientemente
del emisor. Cada condición tiene una fila: se abre, actualiza sin duplicarse y
se resuelve cuando deja de cumplirse. Conserva la última apertura/resolución,
no un historial completo de incidentes. No envía correos ni webhooks.

| Código                 | Condición predeterminada                                                                        |
| ---------------------- | ----------------------------------------------------------------------------------------------- |
| `cron_stale`           | Sin tick del invocador durante más de 180 segundos, incluso si no hay suscripciones             |
| `dispatch_stale`       | Hay suscripciones pero no se inició un run en más de 180 segundos                               |
| `cron_http_failure`    | Respuesta HTTP fallida/timeout o falta de respuesta tras dos minutos, en los últimos 15 minutos |
| `dispatch_failure`     | Run fallido/error de recurrencia reciente, o run sin terminar durante más de dos minutos        |
| `send_failures`        | Al menos tres fallos de envío en 15 minutos                                                     |
| `send_delay`           | Algún envío supera 90 segundos de retraso en los últimos 15 minutos                             |
| `endpoint_expirations` | Al menos tres endpoints retirados en 15 minutos                                                 |
| `window_expirations`   | Al menos tres ocurrencias observadas fuera de ventana en 15 minutos                             |

Los umbrales editables están en `push_monitor_settings`. Para condiciones sin
actividad previa, `observed_value` es `null`: no se inventa una duración.

Cada invocación SQL guarda su tick y el ID de petición de `pg_net`; sin
suscripciones guarda `idle` sin despertar la función. El monitor copia solo
estado HTTP, timeout/error y hora, antes de que el historial efímero de
`pg_net` desaparezca. Una respuesta tardía puede actualizar un estado `missing`.
El éxito del trabajo SQL de Cron no acredita éxito HTTP ni aceptación del
proveedor. Un HTTP 207 de la función puede coexistir con alertas de envío.

Comprobar ambos trabajos en el dashboard de Cron. Si se detienen también el
monitor, la base o todo Supabase, el registro no puede avisar fuera de esa
infraestructura; una supervisión externa sería necesaria para ese caso. La
consulta muestra si el monitor está activo; el historial de Cron permite revisar
sus fallos. No se limpian automáticamente los logs compartidos de Cron.

## Desplegar y verificar

```sh
npm run push:deploy
npm run push:metrics
```

El despliegue aplica la migración `202610120007_push_observability.sql`, publica
el emisor y registra los dos trabajos tras comprobar su autenticación. Es
necesario ejecutar el script: aplicar solo la migración no cambia la función
invocadora existente ni registra el trabajo monitor. Una respuesta de prueba
207 impide activar Cron hasta revisar sus fallos.

La retención de ejecuciones, intentos y ticks es de 14 días; el monitor la
aplica. Las alertas resueltas se conservan. El historial previo al despliegue no
se reconstruye como si estas métricas ya existieran.

Validación local: SQL real en PGlite con roles y respuestas HTTP de prueba;
emisor Deno con transporte/backend simulados para 201, 429, 410, errores de
transporte/generación y errores de persistencia. No se enviaron avisos reales
ni se modificó el proyecto alojado durante esas pruebas locales. El despliegue
y la consulta posteriores están documentados por separado en la verificación real.

## Referencias

- [Supabase: respuestas y retención de pg_net](https://supabase.com/docs/guides/database/extensions/pg_net).
- [Supabase Cron: configuración e historial](https://supabase.com/docs/guides/cron/quickstart).
