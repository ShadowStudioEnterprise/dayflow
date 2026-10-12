# Capacidad y recuperación de notificaciones

Ensayo del 12 de octubre de 2026, rama `test/notification-capacity-recovery`,
creada desde `dev` (`9172b5d`). Se midieron el emisor de esa base y el emisor
instrumentado de `b4ff64e`, desplegado previamente en Supabase. La rama de
instrumentación aún no estaba incorporada a `dev`; no se mezclaron los resultados
ni se modificó producción durante esta prueba.

[Datos completos del ensayo](audits/2026-10-12-notification-capacity.json).
26 pruebas de capacidad/recuperación superadas, más 78 escenarios del emisor
(13 perfiles, tres muestras, dos versiones) y 18 series de recuperación de seis
ciclos. El criterio de comportamiento medido y límites justificados se cumple
para estos entornos controlados; no certifica capacidad del Supabase alojado,
rendimiento del proveedor ni entrega física en teléfonos.

## Método y reproducción

```sh
npm run test:notification-capacity
npm run benchmark:notifications
```

El benchmark usa Deno 2.9.6, invoca el handler registrado por el entry point real
y captura `Deno.serve` sin abrir un puerto. No tiene permiso de red. RRULE y el
bucle del emisor son reales; RPC, cifrado/firma y transporte son dobles de prueba.
La latencia se inyecta en un reloj virtual, separado del tiempo real de CPU.
Por ello los números modelados no son una medición del servicio desplegado.
Las respuestas 201 simuladas son aceptación del proveedor simulado, no avisos
visualizados. La versión instrumentada conserva `visualized = null`.

El script crea y retira un worktree temporal del commit instrumentado fijado,
sin mezclarlo en la rama. Ese objeto Git debe estar disponible; si falta:

```sh
git fetch origin feat/web-push-observability
```

El informe temporal se guarda en `.toolchains/notifications-capacity-emitter.json`.
Para emitir los resultados SQL/nativos también, en PowerShell:

```powershell
$env:NOTIFICATION_CAPACITY_REPORT = '.toolchains/notifications-capacity-native.json'
$env:NOTIFICATION_RECOVERY_REPORT = '.toolchains/notifications-capacity-sql.json'
npm run test:notification-capacity
```

SQL ejecuta las migraciones reales en PGlite. La cola nativa usa el planificador
real e IndexedDB con un adaptador de sistema simulado. Los datos y claves son
ficticios. No se envió carga a FCM/Supabase ni se solicitaron permisos reales.

## Carga del emisor

| Perfil                                                 | Resultado de `dev`                                          | Resultado instrumentado           |
| ------------------------------------------------------ | ----------------------------------------------------------- | --------------------------------- |
| 99 / 100 / 101 candidatos, latencia cero               | 99 / 100 / 101 aceptados; 1 / 2 / 2 lecturas de página      | Mismos resultados                 |
| 1.000 y 10.000 avisos únicos, latencia cero            | Todos aceptados en el modelo                                | Todos aceptados en el modelo      |
| 1.000 recurrencias diarias                             | Todas aceptadas en el modelo                                | Todas aceptadas en el modelo      |
| 1.000 avisos, HTTP 100 ms y operaciones DB 2 ms        | 433 aceptados; 45,042 s modelados; HTTP 500 por presupuesto | 425 aceptados; 45,064 s; HTTP 500 |
| 100 recordatorios × 10 suscripciones, mismas latencias | 433 aceptados; 45,034 s                                     | 425 aceptados; 45,056 s           |
| 1.000 avisos, HTTP 1 s y DB 2 ms                       | 45 aceptados; 45,182 s                                      | 45 aceptados; 45,276 s            |
| Transporte fallido a los 8 s                           | 6 fallos; 48,014 s                                          | 6 fallos; 48,030 s                |
| 100 respuestas mixtas 201/503/410/error de transporte  | 25 aceptados, 25 endpoints expirados, 50 fallos; HTTP 207   | Mismos contadores; HTTP 207       |

La página de 100 **no es un cupo de envíos**: el emisor pagina hasta vaciar
candidatos o agotar su presupuesto. En SQL real, 1.001 candidatos se recorrieron
en 11 páginas, sin pérdidas ni duplicados. La lectura paginada tardó 103,769 ms
en PGlite; sembrar esos datos con triggers llevó 17,759 s y se midió aparte.
Esto no mide latencia de red ni capacidad concurrente de PostgreSQL alojado.

Los tiempos reales de ejecución local, muestras y versiones de Deno/V8 figuran
en el JSON. Incluyen los dobles de prueba y excluyen criptografía real; no deben
usarse como una cifra de envíos por segundo en producción. Las tres muestras
no constituyen una estimación estadística de p95/p99 del servicio.

### Presupuesto de 45 segundos y operaciones lentas

El presupuesto se revisa **entre operaciones**. Deja margen nominal respecto
al ciclo de Cron de 60 s; no cancela operaciones ya iniciadas. El timeout del
proveedor es de 8 s, pero las RPC de Supabase y la persistencia no tienen aquí
un deadline común. Por tanto **45 s no es un máximo absoluto**, ni se puede
afirmar que todo finaliza antes de 53 s.

El perfil con DB 20 s por operación y HTTP 100 ms produjo un envío aceptado:
`dev` terminó con HTTP 500 a los 60,1 s modelados; la versión instrumentada a
los 120,1 s, incluida la escritura final. Es un límite medido del diseño actual.
La sobrecarga debe tratarse como fallo/alerta, no como «todos enviados». Los
registros de aceptación ya escritos no se deshacen por devolver HTTP 500.

Antes de ofrecer un SLA de volumen o tiempo harían falta deadlines por RPC,
un presupuesto global que abarque persistencia, medición de cifrado y pruebas
en un entorno de carga separado. Esta tarea documenta el límite y no cambia
la concurrencia ni esos tiempos de producción.

## Recuperación dentro de cinco minutos

SQL real comprueba las fronteras en el reloj del servidor:

| Edad de la ocurrencia al reservar | Resultado |
| --------------------------------- | --------- |
| 4:59,999                          | Elegible  |
| 5:00,000 exactos                  | Elegible  |
| 5:00,001                          | Rechazada |
| Un milisegundo en el futuro       | Rechazada |

Una caída de seis minutos deja el aviso único fuera del escaneo. Cambiar la
suscripción después del vencimiento, modificar el recordatorio o usar una
versión anterior impide recuperar una ocurrencia vieja. El backoff es **más de
90 segundos**: a 90,000 s no hay nueva reserva, a 90,001 s sí; máximo tres
intentos por suscripción/recordatorio/instante. Aceptación registrada impide
reintentos. Veinte solicitudes simultáneas en una única conexión PGlite dieron
una sola reserva; no es una prueba de concurrencia entre servidores.

Se modeló una ráfaga de 1.000 avisos vencidos un segundo antes del primer ciclo,
con un ciclo por minuto, DB 2 ms y respuestas 201:

| Latencia HTTP                    | Recuperación observada                                  | Sin aceptar al terminar la ventana |
| -------------------------------- | ------------------------------------------------------- | ---------------------------------- |
| 100 ms                           | `dev`: 433 + 425 + 142; instrumentado: 425 + 417 + 158  | 0                                  |
| 1 s                              | 45 por ciclo útil, cinco ciclos; 225 en ambas versiones | 775                                |
| 7,999 s, justo antes del timeout | 6 por ciclo útil; 30 en ambas versiones                 | 970                                |

Al sexto ciclo (minuto cinco), esa ráfaga tiene más de cinco minutos de edad:
ya no se recupera. Estos son modelos de recuperación de **avisos únicos con
respuesta exitosa**, no una certificación de transporte ni un modelo de los
reintentos fallidos; estos últimos se comprobaron por separado en SQL.

Los cinco minutos limitan alarmas obsoletas y trabajo acumulado, pero aceptan
pérdida tras una caída o una cola lenta. No son una garantía de recuperación
total. El TTL 300 s empieza en el proveedor y es una ventana distinta; no amplía
la elegibilidad SQL. El worker rechaza mensajes con más de diez minutos de edad.
Debe dejarse margen para red, RPC y el siguiente tick: esperar al límite exacto
de cinco minutos no garantiza que la reserva llegue a tiempo.

## Cupo nativo de 60 avisos y renovación

| Próximos avisos solicitados | Programados | Estado pendiente por cupo |
| --------------------------- | ----------- | ------------------------- |
| 0                           | 0           | 0                         |
| 59                          | 59          | 0                         |
| 60                          | 60          | 0                         |
| 61                          | 60          | 1                         |
| 120                         | 60          | 60                        |
| 1.000                       | 60          | 940                       |

Siempre se seleccionaron los 60 instantes más próximos **de la cuenta**, no 60
por recordatorio, sin IDs duplicados. El ensayo de 1.000 avisos únicos tardó
aproximadamente 1,19 s de reconciliación local; incluye IndexedDB y no llamada
real al sistema. El cálculo previo puede crecer con el total de recordatorios
y ocurrencias: el cupo no convierte todo el procesamiento en memoria constante.

60 es una política conservadora de Dayflow para acotar IDs durables y solicitudes
al sistema; **no es un máximo universal de Android/iOS verificado en hardware**.
Se mantiene un cupo común y una ventana de 366 días. Se comprobó una fecha
dentro de esa ventana y el descarte de otra posterior. No se justifica subir
el cupo sin probar el sistema, permisos y recuperación en dispositivos reales.

Una serie diaria pasó de 60 programados a 57 pendientes tras consumir tres;
al reanudar se renovó a 60 con nuevas fechas e IDs, sin duplicados. Sesenta
ocurrencias son 60 días para una serie diaria, pero solo unos seis días para
diez series diarias, o aproximadamente un día si se solicitan 60 avisos/día.
La cobertura depende de la mezcla de fechas; **necesita ejecución posterior
de la app para renovarse**.

## Cambios horarios y fallos parciales

- A las 09:00 de Madrid, la serie conserva hora civil: el UTC cambia de 08:00 a
  07:00 en marzo y de 07:00 a 08:00 en octubre.
- En RRULE, la hora inexistente de marzo se omite sin consumir COUNT; la hora
  repetida de octubre elige la primera ocurrencia. En el editor manual se
  rechazan tanto la hora inexistente como la repetida, solicitando otra hora.
- Programación parcial de 30/60, con excepción y con confirmación silenciosamente
  incompleta: se conservan los 60 IDs, se marca error y un reintento deja
  exactamente 60 avisos, sin duplicados.
- Cancelación parcial de 30/60: se conservan los IDs durables y el siguiente
  intento cancela lo restante y vuelve a programar 60.
- Si el proveedor simulado acepta pero falla el marcador de entrega, `dev`
  reporta fallo aunque hubo HTTP 201. El emisor instrumentado conserva la
  aceptación observada y falla la ejecución. No se promete exactamente una
  vez: sin ese marcador puede haber un reintento; el tag del worker limita
  duplicados visibles, sin acreditar visualización.

## Resultado y límites de la evidencia

El comportamiento y los límites están medidos para las condiciones anteriores.
No se hizo carga en producción ni se cambió el emisor alojado. No acredita
Doze, suspensión, reinicio, batería, IPC real ni entrega física en iOS/Android.
Las restricciones del sistema siguen vigentes; por ejemplo, Capacitor documenta
limitaciones en Doze para `allowWhileIdle`. Ver [API de notificaciones locales](https://capacitorjs.com/docs/apis/local-notifications).
Web Push necesita que el navegador pueda ejecutarse; ver [FAQ de Web Push](https://web.dev/articles/push-notifications-faq).

La política conserva 60 avisos y cinco minutos por sus ventajas de acotación,
con pérdida y necesidad de renovación explícitas. Queda descartada cualquier
afirmación de capacidad garantizada de producción basada en este modelo.
