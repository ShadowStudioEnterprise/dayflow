# Pruebas adversariales con dos cuentas — 10 de octubre de 2026

**Criterio de cierre cumplido:** accesos indebidos rechazados o sin filas accesibles por RLS, idempotencia verificada y resultados registrados. **460/460 comprobaciones correctas**, más **40/40 verificaciones de limpieza** en una nueva ejecución contra Supabase alojado.

- Proyecto: `spfrfvpexfnnhwpfinrq`.
- Ejecución: `0ef8e286-e79a-4f7b-a115-7de5ceba0742`.
- Horario: **12:04:51–12:05:32 Europe/Madrid** (10:04:51–10:05:32 UTC).
- Referencia local: `a061438fcdb8b47d2d4d0b05ce9188338f9a282c`, con el cambio del script para aceptar una ruta de resultados independiente. No se atribuye ese cambio al commit base.
- Entorno: Windows, Node 24.18.0, npm 11.16.0.
- Evidencia: [resultados completos en JSON](2026-10-10-supabase-adversarial.json), sin contraseñas, JWT ni identificadores de las cuentas.

## Escenarios y resultados

Se crearon dos cuentas temporales A/B mediante Admin API, confirmadas administrativamente, y se inició sesión con contraseña. Los JWT emitidos por Supabase se validaron contra el servidor. Las comprobaciones adversariales utilizaron esos JWT de cliente; el rol de servicio preparó reservas aisladas, contrastó la existencia de los datos y verificó la limpieza.

| Área                     | Resultado observado                                                                                                                                                                                                                                                                                        |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lecturas A→B y B→A       | Datos propios presentes y accesibles en las 17 tablas permitidas; consultas del otro propietario con cero filas. Acceso cliente a `sync_records` y `push_deliveries` denegado. Pull paginado siempre del propietario correcto.                                                                             |
| Escrituras cruzadas      | Creación, actualización y borrado RPC con propietario ajeno rechazados (`42501`); UUID ajeno con propietario falsificado rechazado (`23505`). INSERT/PATCH/DELETE directos de las 12 entidades y de metadatos rechazados. Perfiles y suscripciones ajenos protegidos.                                      |
| Relaciones entre cuentas | 14 intentos rechazados, siete por dirección: subtarea→tarea, recordatorio→tarea, tarea→sucesora, nota→etiqueta, asociación→tarea, asociación→evento y enlace→tarea. Errores `23503` o `P0001`.                                                                                                             |
| RPC restringidas         | Las 13 funciones internas probadas rechazaron llamadas de A, B y `anon` (`42501` o `PGRST202`, según permisos/exposición). Las tres RPC de cliente también rechazaron acceso anónimo.                                                                                                                      |
| Idempotencia             | Repetición exacta: mismo acuse, HTTP 200, en ambas cuentas. Mismo ID con carga alterada e ID de operación ajena: HTTP 400 / `22023`. El historial final contiene exactamente 14 cambios por cuenta: 12 creaciones, actualización y borrado lógico autorizados, sin cambios adicionales por los reintentos. |
| Controles positivos      | Creaciones propias en las 12 entidades, actualización y borrado lógico propios, edición de perfil, alta/baja de suscripción y RPC de servicio previstas correctos. La tarea propia conserva título y versión tras los ataques.                                                                             |
| Otros controles          | JWT manipulado rechazado con 401; entidades no permitidas, campos desconocidos, reloj futuro, cursores y límites inválidos rechazados. Lectura y escritura anónimas denegadas en las 19 tablas.                                                                                                            |

GraphQL devolvió que la extensión no está habilitada para los cuatro actores probados. Los perfiles HTTP se comprobaron usando los namespaces del catálogo histórico como candidatos; esta ejecución no vuelve a extraer el catálogo SQL.

## Limpieza y alcance

Las dos cuentas fueron eliminadas y se verificó su ausencia por Admin API. Las otras 38 comprobaciones confirmaron que no quedaban filas de esas cuentas o suscripciones en las 19 tablas. Los recordatorios estaban fechados en 2099; se ejercitaron reservas aisladas sin enviar notificaciones. No se enviaron correos ni se desplegaron migraciones o cambios de aplicación.

La prueba cubre los escenarios enumerados con peticiones secuenciales. No acredita carreras concurrentes, carga, recuperación por correo ni entrega de notificaciones. `PGRST202` acredita que la función no es invocable con esa firma a través de PostgREST; la revisión histórica de permisos SQL está en el [cierre anterior](2026-10-09-supabase-closure.md).

## Reproducción

Con sesión administrativa CLI y `.env.local` apuntando al proyecto enlazado autorizado:

```powershell
node scripts/audit-supabase-api.mjs after docs/audits/2026-10-10-supabase-adversarial.json
```

La ejecución terminó con código **0**. El tercer argumento permite conservar las evidencias anteriores y rechaza un destino explícito existente antes de crear cuentas; para repetir, usa un nombre de archivo nuevo en un directorio existente. El script crea y elimina únicamente sus cuentas y datos de ensayo.

Validación local adicional: `node --check scripts/audit-supabase-api.mjs`, `npm run docs:check`, `npm run test:docs` (3/3), formato de los archivos afectados y `git diff --check`, correctos. No se repitieron las suites de frontend al no cambiar la aplicación.
