# Cierre de pruebas de RLS y RPC con JWT reales

**Resultado:** las comprobaciones pendientes de acceso por API, lectura/mutación cruzada y RPC restringidas se ejecutaron con dos cuentas reales de ensayo. **460 comprobaciones HTTP correctas** tras corregir los permisos. Los datos propios son accesibles, los ajenos quedan ocultos o las operaciones son rechazadas, y `service_role` conserva su acceso previsto. Los dos hallazgos de permisos se corrigieron en Supabase.

**Proyecto:** `spfrfvpexfnnhwpfinrq`. Fecha: 9 de octubre de 2026, Europe/Madrid. Referencia local de partida: `967442bd632cf19f159f28e5f184c9398e1c30ad`, con el árbol de trabajo de auditoría y la nueva migración; estos resultados no se atribuyen al commit base sin cambios.

**Ejecuciones conservadas:** 379 comprobaciones antes del endurecimiento, 21:13:03–21:13:29; batería final ampliada de 460 comprobaciones después, 21:19:51–21:20:21. La batería posterior añade escrituras anónimas en todas las tablas, perfiles/suscripciones, rechazo de GraphQL deshabilitado y comprobaciones de esquema HTTP. No son dos recuentos de una batería idéntica.

## Permisos y comportamiento observados

| Rol                            | Resultado por API                                                                                                                                                                                                                                                            |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `anon`                         | Lectura, INSERT, PATCH y DELETE rechazados en las 19 tablas. Rechazo de las RPC de cliente e internas probadas.                                                                                                                                                              |
| `authenticated`, cuentas A y B | Lecturas propias en las 17 tablas permitidas; cero filas al pedir las de la otra cuenta. Sin lectura de `sync_records` ni `push_deliveries`. Creación, actualización y borrado lógico propios mediante RPC; modificación de perfil y baja de suscripción propias permitidas. |
| `service_role`                 | Lectura de ambos propietarios, incluidas tablas internas y reservas. Candidatos y reservas Push ejecutables. Reserva válida creada para cada cuenta de ensayo.                                                                                                               |

Las cuentas se crearon y confirmaron por Admin API y accedieron con email/contraseña. Supabase emitió JWT reales; la identidad se comprobó mediante `getUser`. Los tokens que alteraban propietario y rol a `service_role` sin una nueva firma recibieron HTTP 401. La confirmación administrativa de email evita envíos de correo; este ensayo no certifica SMTP ni el recorrido de confirmación por email. Véase [Supabase: createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser).

Se crearon filas propias mediante RPC en las 12 entidades sincronizadas, además de suscripciones y reservas. El historial, cabeceras y acuses se generaron como parte de las operaciones normales. Las lecturas cruzadas fueron A→B y B→A con datos presentes en ambas cuentas, no solo consultas a tablas vacías.

Los intentos de mutación incluyeron:

- Crear, actualizar y borrar por RPC con propietario ajeno; usar un UUID de entidad ajena con propietario falsificado. El propietario real y sus datos permanecieron intactos.
- INSERT, PATCH con una modificación efectiva y DELETE directos de entidades y tablas de metadatos. Un PATCH vacío no se considera una prueba de escritura, porque no solicita ningún cambio.
- INSERT de perfil ajeno, cambio de propietario de perfil y modificación de perfil ajeno. El último caso devuelve cero filas por RLS; el cambio propio legítimo funciona.
- Referencias cruzadas en subtareas, recordatorios, sucesoras de tareas, asociaciones de etiquetas y enlaces polimórficos.
- Entidades no admitidas, campo desconocido, reloj futuro de diez minutos, reutilización de ID de operación ajena y repetición del mismo ID con otra carga.
- Registro y eliminación de suscripción ajena, endpoint Push no admitido y escritura directa en suscripciones.

La repetición exacta de una operación devolvió el mismo acuse sin cambios adicionales. Pull recorrió todas las páginas de cada cuenta con límite de tres elementos: 12 cambios al comienzo y 14 tras la actualización y tombstone propios, siempre del propietario correcto. Cursores negativos y límites fuera del rango se rechazaron.

Las RPC internas se probaron por HTTP con `anon` y con los JWT de ambas cuentas. Los rechazos fueron errores de privilegios o ausencia en la caché de funciones accesibles de PostgREST. Los permisos efectivos SQL se contrastaron además para distinguir falta de exposición y falta de EXECUTE.

## Corrección aplicada y verificada

Se desplegó únicamente [202610090006_security_privileges.sql](https://github.com/ShadowStudioEnterprise/dayflow/blob/main/supabase/migrations/202610090006_security_privileges.sql), tras comprobar con `db push --dry-run` que era la única migración pendiente. Su versión consta en el historial remoto.

- Retira EXECUTE de `PUBLIC`, `anon` y `authenticated` en las cinco funciones trigger de alta, auditoría y validación.
- Para futuros objetos de `postgres` en `public`, elimina permisos automáticos de cliente sobre tablas y secuencias y EXECUTE de `anon`/`authenticated` en funciones.
- Retira globalmente el default base de EXECUTE de `PUBLIC` para futuras funciones de `postgres`. Las futuras funciones de ese propietario, incluso en otros esquemas, necesitan los GRANT requeridos por sus consumidores.

El catálogo posterior confirma que los clientes solo conservan EXECUTE sobre las tres RPC de Dayflow previstas y que `service_role` puede ejecutar las 16 funciones de la aplicación. Las ACL de tablas, las políticas RLS y las definiciones de las 16 funciones existentes no cambiaron. Las altas de cuenta, los triggers de actualización, las RPC y las suscripciones legítimas siguieron funcionando después de revocar EXECUTE de los triggers.

La [prueba real de defaults](https://github.com/ShadowStudioEnterprise/dayflow/blob/main/scripts/probe-supabase-defaults.sql) creó una tabla vacía, una secuencia y una función dentro de una transacción y revirtió todo el DDL. Los tres roles obtuvieron los permisos esperados: ningún acceso automático para los dos clientes y acceso para el rol de servicio. No quedaron objetos de prueba.

## Esquemas HTTP y GraphQL

Entre los once namespaces inspeccionados, los perfiles HTTP aceptados fueron `public` y `graphql_public`; los otros nueve y un esquema inexistente recibieron `PGRST106`. Se comprobó con una tabla de nombre aleatorio inexistente, sin consultar filas privadas.

**GraphQL está deshabilitado:** el endpoint `/graphql/v1` devolvió `pg_graphql extension is not enabled.` para `anon`, los JWT A/B y `service_role`. La función envolvente de `graphql_public` sigue presente en el catálogo, pero no hay una ruta GraphQL activa para leer datos. No se activó la extensión. Si se activa en el futuro, habrá que comprobar sus lecturas y mutaciones; estos resultados no certifican ese estado futuro.

## Evidencias y limpieza

- [HTTP antes](2026-10-09-supabase-api-before.json): 379/379 correctas.
- [HTTP final después](2026-10-09-supabase-api-after.json): 460/460 correctas; cuatro resultados de GraphQL deshabilitado, perfiles HTTP y 40 verificaciones de limpieza.
- [Catálogo después](2026-10-09-supabase-catalog-after.json): roles, ACL, políticas, defaults e historial.
- [Pruebas SQL después](2026-10-09-supabase-probes-after.json): 69/69 correctas, con dos sujetos existentes y uno sintético durante la ejecución de las cuentas de ensayo. No se exportaron sus UUID.
- [Defaults después](2026-10-09-supabase-defaults-after.json): tres comprobaciones correctas.
- [Comprobaciones de cierre](2026-10-09-supabase-closure-checks.json): 13 verificaciones correctas de permisos, continuidad, evidencia y limpieza remota.
- [Script HTTP reproducible](../../scripts/audit-supabase-api.mjs) y [pruebas locales del endurecimiento](../../src/test/security-privileges.test.ts).

Las cuentas de ensayo se eliminaron al terminar cada ejecución, incluidas las ejecuciones de ajuste de la batería. La limpieza comprobó las 19 tablas por propietario o suscripción. La consulta administrativa final, a las **21:22:01 Europe/Madrid**, confirmó **cero cuentas con la marca de ensayo, cero relaciones de prueba y cero funciones de prueba**. Las credenciales administrativas, contraseñas y JWT se mantuvieron en memoria; no están en los artefactos. Los secretos existentes no se rotaron.

Los recordatorios de ensayo estaban fechados en 2099. Las reservas se ejercitaron mediante la RPC de servicio sin enviar Push. `dayflow_invoke_push` solo se invocó con los roles cliente, donde fue rechazado; no se invocó con el rol de servicio.

Validación local: **25 pruebas SQL/de sincronización correctas** (tres del endurecimiento y 22 de Foundation, Sync y Push), TypeScript, lint, documentación, sus tres pruebas y formato. No se cambió ni desplegó el frontend.

Para repetir la batería HTTP en un proyecto autorizado, con sesión administrativa CLI y `.env.local` apuntando al mismo proyecto enlazado:

```powershell
node scripts/audit-supabase-api.mjs after
```

El script crea y elimina cuentas y datos temporales y sobrescribe su archivo de resultados con un nuevo timestamp. La comprobación de perfiles usa los namespaces del catálogo conservado como candidatos.

## Alcance del cierre

SQL-04 queda corregido y verificado. SQL-05 queda completado para catálogo real y las pruebas de dos cuentas con JWT por la API. Se conserva la [auditoría inicial](2026-10-09-supabase-rls-rpc.md) como evidencia anterior al cambio.

Este resultado acredita los escenarios enumerados. No constituye una certificación general: quedan fuera las carreras entre escrituras simultáneas, pruebas de carga/rate limiting, recuperación por correo y canales de distribución de notificaciones. Las políticas antiguas de escritura que carecen de GRANT siguen siendo una observación preventiva; no conceden acceso actual.
