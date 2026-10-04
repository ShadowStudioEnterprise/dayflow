# Notificaciones Web Push

Implementación del 4 de octubre de 2026. El proyecto Supabase alojado tiene la migración, el emisor y la tarea periódica activos. La [web HTTPS](https://dayflow-productividad.gptgonzaleznavarrete.chatgpt.site) está publicada con acceso privado para su propietario y un visitante autorizado. El usuario confirmó la recepción de notificaciones programadas reales en Chrome y Supabase registra la aceptación del envío por el proveedor. En Windows, al cerrar todas las ventanas de Chrome, el usuario sólo recibe el aviso al reabrirlo: la entrega al vencimiento no está superada en ese caso. Consulta [validación de publicación y dispositivos](release-validation.md).

## Activación

1. Compila con `npm run build` y abre la PWA de producción mediante `npm run preview` o desde su alojamiento HTTPS. `npm run dev` no registra un service worker.
2. Inicia sesión y abre **Configuración → Notificaciones en este navegador → Activar avisos web**. El permiso sólo se solicita al pulsar el botón.
3. Crea un recordatorio futuro con avisos activados y comprueba que sus cambios estén sincronizados. El servidor sólo conoce los datos que ya llegaron a Supabase.

Cada navegador se activa por separado. **Desactivar avisos web** cancela su suscripción; cerrar sesión también la cancela y retira los avisos visibles. Si se deniega el permiso, hay que cambiarlo en los ajustes del sitio. Para renovar una suscripción perdida o caducada, vuelve a activarla desde Configuración. Si el proveedor no responde en 30 segundos, se muestra un error y se descarta cualquier alta tardía que no haya sido activada después. En iPhone/iPad, se requiere una aplicación web añadida a la pantalla de inicio; esa plataforma todavía no se ha verificado en este proyecto.

El aviso muestra un mensaje genérico, sin título ni descripción del recordatorio. Al pulsarlo abre el recordatorio en una ventana de Dayflow; conserva los borradores de las ventanas existentes. La identidad de la suscripción se guarda en una base IndexedDB separada y el worker descarta avisos de otra cuenta o de una cuenta que cerró sesión.

## Envío y límites

En el equipo Windows probado, Chrome 154 termina todos sus procesos al cerrar la última ventana, aunque el usuario tenga activada la opción de segundo plano. Se comprobó con una consulta de procesos tras el cierre. En esta configuración hay que mantener Chrome ejecutándose, por ejemplo con una ventana minimizada; la entrega con el navegador detenido no está disponible. Dayflow no incorpora actualmente una integración nativa de notificaciones para Windows.

- En Chrome de escritorio, cerrar la página de Dayflow y detener por completo el navegador son situaciones distintas: la recepción requiere que Chrome siga ejecutándose, aunque no tenga ventanas abiertas ([FAQ de Web Push de Google](https://web.dev/articles/push-notifications-faq)). En Windows se puede revisar `chrome://settings/system` y la opción de continuar ejecutando aplicaciones en segundo plano. El [modo de segundo plano](https://chromeenterprise.google/policies/background-mode-enabled/) permite mantener un proceso tras cerrar la última ventana; debe comprobarse en el equipo y repetir la prueba. Dayflow no puede habilitarlo desde la web ni garantizar entrega si Chrome termina o Windows se suspende.
- Supabase Cron comprueba cada minuto si existen suscripciones y, en ese caso, invoca `push-dispatch`. No depende de que la página permanezca abierta. El sistema y el navegador pueden limitar la ejecución en segundo plano; no se promete una alarma exacta.
- El emisor usa el mismo motor RRULE/Temporal que el calendario, conservando zona IANA, COUNT, UNTIL y cambios de horario. No se genera una copia de cada recordatorio.
- La ventana de recuperación es de cinco minutos. Se descartan ocurrencias anteriores al alta de la suscripción o a la última modificación del recordatorio, así como las que tienen una versión desactualizada, están borradas o desactivadas.
- Cada cuenta puede registrar hasta diez navegadores. Hay reservas exclusivas por suscripción, recordatorio e instante, con hasta tres intentos separados por al menos 90 segundos. Los registros de envío se conservan 14 días.
- Un proveedor que responde 404/410 provoca la retirada de la suscripción. La aceptación del proveedor no demuestra que el dispositivo mostrara el aviso. Una caída después del envío y antes de guardar la aceptación puede causar un reintento; el tag del aviso reduce duplicados visibles, sin prometer entrega exactamente una vez.
- Los mensajes tienen TTL de cinco minutos; el worker rechaza cargas con más de diez minutos. No se acumula un histórico de alarmas para entregar días después.
- El trabajo se pagina por 100 recordatorios y tiene un presupuesto de 45 segundos, además del tiempo de la operación en curso. No se ha probado carga masiva ni hay un panel de métricas o alertas operativas. Un retraso prolongado del servidor puede perder avisos fuera de la ventana de recuperación.
- Desactivar o borrar mientras no hay conexión no cambia inmediatamente el recordatorio del servidor. Un mensaje ya enviado tampoco puede retirarse de todos los proveedores. La baja local de la suscripción protege este navegador incluso si no puede borrarse su fila remota en ese momento.

## Despliegue y secretos

Con la CLI autenticada, el proyecto enlazado y `.env.local` configurado:

```sh
npm run push:deploy
npm run build
```

El script comprueba que el proyecto enlazado coincide con la URL, aplica migraciones pendientes, genera claves VAPID sólo si todavía no existen, configura secretos, despliega la función y comprueba su autenticación antes de activar Cron. Se puede repetir sin rotar las claves. No actualiza el plan de Supabase ni publica la web.

`VITE_WEB_PUSH_PUBLIC_KEY` contiene únicamente la clave pública. La privada y el token del planificador quedan en `.env.web-push.local` (ignorado), y en los secretos de Edge Functions. El token del planificador también se guarda en Vault. Conserva el archivo local de secretos de forma privada; cambiar la clave VAPID obliga a renovar las suscripciones existentes. Nunca copies esos secretos a variables `VITE_*`.

La función tiene desactivada la validación JWT del gateway porque usa un token privado propio obligatorio. No es un endpoint público de envío. Las RPC de lectura de candidatos y reserva sólo son ejecutables por `service_role`; el registro usa la identidad autenticada y una lista de proveedores HTTPS permitidos, sin aceptar destinos arbitrarios. Las tablas tienen RLS y no se incorporan a la sincronización de contenido.

Para detener sólo el planificador:

```sql
select cron.unschedule('dayflow-web-push');
```

Para inspeccionarlo sin mostrar secretos:

```sql
select jobname, schedule, active from cron.job where jobname = 'dayflow-web-push';
```

Los cambios del motor de recurrencias requieren volver a desplegar `push-dispatch`, además de compilar la web. El adaptador `rrule.ts` resuelve la entrada UMD de npm en Deno; Vite conserva la entrada ESM. La función puede comprobarse con `deno check --config supabase/functions/push-dispatch/deno.json supabase/functions/push-dispatch/index.ts`.

## Verificación

Se comprobaron las políticas SQL, límites, reservas y rechazo de versiones antiguas; consentimiento, revocación offline y cambios de cuenta; descarte de cargas malformadas, antiguas o ajenas y navegación local. Las pruebas PWA usan el worker de producción, IndexedDB y Notifications de Chromium, con suscripción/HTTP simulados y un evento Push inyectado.

En Supabase real se comprobaron registro autenticado, restricciones de acceso, cifrado/firma VAPID, petición al proveedor y retirada de un endpoint de prueba inexistente, tanto mediante invocación directa como por Cron. Las cuentas temporales se eliminaron. La suscripción real al proveedor desde un perfil temporal de Chromium no respondió en 25 segundos. Esto **no equivale a probar la entrega completa a una suscripción válida**, ni Safari/Firefox, suspensión del sistema o un móvil físico. Resultados finales en [verificación](verification.md).

## Referencias

- [Supabase: programación de Edge Functions con Cron, pg_net y Vault](https://supabase.com/docs/guides/functions/schedule-functions).
- [Web Push: cifrado, VAPID y generación de peticiones](https://github.com/web-push-libs/web-push).
- [MDN: mostrar notificaciones desde un service worker](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification).
