# Catálogo real de Supabase: RLS y permisos RPC

> Registro anterior al endurecimiento. El [seguimiento con JWT reales](2026-10-09-supabase-closure.md) completa las pruebas pendientes y documenta la corrección de ambos hallazgos de permisos.

**Resultado:** RLS y la separación de permisos de las RPC de Dayflow son coherentes con el contrato actual. Se confirman permisos sobrantes en cinco funciones trigger y privilegios por defecto amplios para futuros objetos. No se ha demostrado una escalada de privilegios. Esta revisión no cierra las pruebas con JWT de dos cuentas reales.

**Proyecto:** `spfrfvpexfnnhwpfinrq`, contrastado entre `.env.local` y el proyecto enlazado de la CLI. PostgreSQL 17.11. Referencia local: `967442bd632cf19f159f28e5f184c9398e1c30ad`; árbol inicialmente limpio.

**Fecha:** 9 de octubre de 2026. Catálogo: 20:47:09 Europe/Madrid (18:47:09 UTC). Pruebas finales: 20:48:36 Europe/Madrid (18:48:36 UTC).

**Método:** consultas al proyecto alojado mediante `supabase db query --linked`, transacciones `REPEATABLE READ READ ONLY` terminadas en `ROLLBACK`. Consulta de `pg_class`, `pg_policies`, `pg_proc`, ACL, membresías y privilegios efectivos de esquema, tabla, columnas y funciones. Pruebas mediante cambio local de rol y claims SQL. No se crearon cuentas, no se modificaron datos, políticas ni permisos, y no se invocó el emisor de notificaciones.

## Evidencia y reproducción

- [Catálogo completo](2026-10-09-supabase-catalog.json): roles, membresías, esquemas, 19 tablas, 46 políticas, 17 funciones, ACL por defecto y migraciones.
- [Resultados de las pruebas](2026-10-09-supabase-probes.json): 51 comprobaciones correctas; sin UUID de usuarios ni contenido de sus registros.
- [Comparación de cuerpos de funciones](2026-10-09-supabase-function-comparison.json): las 16 funciones de `public` coinciden con el código local, normalizando CRLF a LF y comparando MD5 de `prosrc`. Es una comparación de contenido, no una firma de seguridad ni una comparación completa de DDL.
- [Consulta del catálogo](https://github.com/ShadowStudioEnterprise/dayflow/blob/main/scripts/audit-supabase-security.sql) y [pruebas SQL](https://github.com/ShadowStudioEnterprise/dayflow/blob/main/scripts/probe-supabase-security.sql).

Desde la raíz del repositorio, con sesión administrativa de Supabase ya configurada y tras comprobar el proyecto enlazado:

```powershell
npx --no-install supabase db query --linked --file scripts/audit-supabase-security.sql -o json
npx --no-install supabase db query --linked --file scripts/probe-supabase-security.sql -o json
```

La comparación usa la última definición de cada función en las cinco migraciones ordenadas. Para `dayflow_invoke_push`, usa `scripts/deploy-web-push.mjs` sustituyendo la URL del emisor por la del proyecto. Las cinco versiones de migración constan en el historial remoto. Su presencia no demuestra por sí sola igualdad de todo el esquema; la comparación de cuerpos es evidencia adicional.

## Roles y tablas

`anon` y `authenticated` no son superusuarios, no tienen `BYPASSRLS` y no reciben membresías de otros roles. `service_role` tiene `BYPASSRLS`, sin ser superusuario. Los tres tienen `USAGE`, pero no `CREATE`, sobre `public` y `graphql_public`.

Las **19 tablas de `public` tienen RLS activado**, propietario `postgres` y `FORCE ROW LEVEL SECURITY` desactivado. No hay vistas ni tablas adicionales en los dos esquemas inspeccionados. Todas las políticas son permisivas y se aplican únicamente a `authenticated`: 17 SELECT, 14 INSERT, 14 UPDATE y una DELETE. Sus expresiones exigen `auth.uid() = user_id`; UPDATE comprueba tanto la fila existente como el nuevo propietario. `push_deliveries` y `sync_records` no tienen políticas de cliente ni permisos de cliente.

| Tablas                                                                      | `anon`  | `authenticated`                | `service_role`                            |
| --------------------------------------------------------------------------- | ------- | ------------------------------ | ----------------------------------------- |
| 12 entidades sincronizadas, `sync_operations`, `sync_heads`, `sync_changes` | Ninguno | SELECT con RLS                 | Todos los privilegios de tabla; omite RLS |
| `profiles`                                                                  | Ninguno | SELECT, INSERT, UPDATE con RLS | Todos; omite RLS                          |
| `push_subscriptions`                                                        | Ninguno | SELECT, DELETE con RLS         | Todos; omite RLS                          |
| `push_deliveries`, `sync_records`                                           | Ninguno | Ninguno                        | Todos; omite RLS                          |

Las 12 entidades son `devices`, `entity_links`, `event_tags`, `events`, `inbox`, `note_tags`, `notes`, `reminders`, `subtasks`, `tags`, `task_tags` y `tasks`.

No hay ACL adicionales por columna. Se comprobaron también TRUNCATE, REFERENCES, TRIGGER y MAINTAIN: ninguno está disponible para los dos roles cliente. Las escrituras directas de perfiles y el borrado de suscripciones son excepciones deliberadas al uso de RPC. Las antiguas políticas INSERT/UPDATE de las entidades y de `sync_operations` siguen existiendo, pero no conceden acceso sin el privilegio de tabla correspondiente.

## Matriz efectiva de funciones

`Sí` significa que `has_function_privilege(role, oid, 'EXECUTE')` devuelve verdadero; incluye concesiones directas y las de `PUBLIC`. Los esquemas permiten `USAGE`. Esto no equivale a poder completar la operación: también intervienen el tipo de función y las validaciones internas.

| Función y tipos de argumentos                          | DEFINER | `PUBLIC` | `anon` | `authenticated` | `service_role` |
| ------------------------------------------------------ | ------- | -------- | ------ | --------------- | -------------- |
| `dayflow_apply_operation(jsonb)`                       | Sí      | No       | No     | Sí              | Sí             |
| `dayflow_pull(text, integer)`                          | Sí      | No       | No     | Sí              | Sí             |
| `dayflow_register_push(text, text, text)`              | Sí      | No       | No     | Sí              | Sí             |
| `dayflow_push_candidates(uuid)`                        | Sí      | No       | No     | No              | Sí             |
| `dayflow_claim_push(uuid, uuid, integer, timestamptz)` | Sí      | No       | No     | No              | Sí             |
| `dayflow_invoke_push()`                                | Sí      | No       | No     | No              | Sí             |
| `dayflow_append(text, jsonb, jsonb)`                   | Sí      | No       | No     | No              | Sí             |
| `dayflow_capture()` — trigger                          | Sí      | No       | No     | No              | Sí             |
| `dayflow_table(text)`                                  | No      | No       | No     | No              | Sí             |
| `dayflow_wins(jsonb, jsonb)`                           | No      | No       | No     | No              | Sí             |
| `dayflow_push_endpoint(text)`                          | No      | No       | No     | No              | Sí             |
| `handle_new_user()` — trigger                          | Sí      | No       | **Sí** | **Sí**          | Sí             |
| `audit_entity_update()` — trigger                      | No      | **Sí**   | **Sí** | **Sí**          | Sí             |
| `validate_entity_link()` — trigger                     | No      | **Sí**   | **Sí** | **Sí**          | Sí             |
| `validate_event_timezone()` — trigger                  | No      | **Sí**   | **Sí** | **Sí**          | Sí             |
| `validate_task_timezone()` — trigger                   | No      | **Sí**   | **Sí** | **Sí**          | Sí             |
| `graphql_public.graphql(text, text, jsonb, jsonb)`     | No      | Sí       | Sí     | Sí              | Sí             |

Las primeras 16 funciones pertenecen a `public`. La última es la entrada GraphQL de la plataforma, con propietario `supabase_admin`, y ejecuta como invocador; el catálogo no la marca como miembro directo de una extensión. No se clasifica como helper interno de Dayflow. Las nueve funciones DEFINER tienen propietario `postgres` con `BYPASSRLS` y `search_path = ''`. Las 16 funciones de Dayflow fijan ese mismo `search_path`.

Las RPC de cliente validan identidad en su cuerpo; `dayflow_pull` filtra por propietario y `dayflow_apply_operation` comprueba el propietario de la carga. Las RPC de candidatos y reservas Push operan entre cuentas por diseño y quedan restringidas al rol de servicio entre los tres roles revisados. `dayflow_invoke_push` existe realmente, aunque se instala desde el script de despliegue y no desde una migración.

## Hallazgos y acciones propuestas

**RLS-RPC-01 — Baja: concesiones sobrantes en funciones trigger.** `handle_new_user()` revoca a `PUBLIC`, pero conserva concesiones directas a `anon` y `authenticated`. Las cuatro funciones de validación/auditoría conservan tanto `PUBLIC` como concesiones directas. La documentación de [Supabase sobre privilegios heredados y por defecto](https://supabase.com/docs/guides/troubleshooting/custom-role-inherits-privileges-that-were-not-explicitly-granted-ddaa1c) explica por qué revocar únicamente `PUBLIC` no elimina concesiones separadas.

La invocación SQL directa de `handle_new_user()` bajo ambos roles produjo `0A000`, propio del rechazo de una función trigger fuera de su contexto. Los clientes tampoco tienen CREATE en estos esquemas ni TRIGGER sobre las tablas de la aplicación. No se ha demostrado acceso a datos ajenos ni creación arbitraria de perfiles mediante ese permiso.

Corrección puntual propuesta, **no aplicada**, para una futura migración:

```sql
revoke execute on function
  public.handle_new_user(),
  public.audit_entity_update(),
  public.validate_entity_link(),
  public.validate_event_timezone(),
  public.validate_task_timezone()
from public, anon, authenticated;
```

**RLS-RPC-02 — Media, preventiva: futuros objetos nacen con permisos amplios.** Las ACL por defecto de `postgres` en `public` conceden EXECUTE en funciones y todos los permisos de tablas/secuencias a los tres roles. Las funciones además reciben el permiso base de ejecución de `PUBLIC` si no se revoca. Los objetos existentes inspeccionados están restringidos mediante revocaciones explícitas, salvo los triggers indicados; el riesgo afecta especialmente a nuevas migraciones que olviden hacerlo.

Conviene definir permisos explícitos para cada nuevo objeto y endurecer los defaults en una migración separada. La revocación del permiso base de `PUBLIC` en futuras funciones debe considerar el ámbito global de `ALTER DEFAULT PRIVILEGES`; una revocación limitada al esquema no neutraliza un permiso global. Los cambios de defaults tampoco modifican los objetos existentes. Véase [PostgreSQL 17: ALTER DEFAULT PRIVILEGES](https://www.postgresql.org/docs/17/sql-alterdefaultprivileges.html).

**Observación:** las 13 tablas con políticas antiguas de escritura y permisos de escritura ya revocados mantienen una política latente. No permiten escritura actual; retirar esas políticas reduciría el impacto de un GRANT accidental futuro si no se necesitan.

## Pruebas realizadas y límites

Las 51 comprobaciones se reparten en 14 pruebas de errores esperados, 34 lecturas RLS de tablas, dos llamadas de lectura a `dayflow_pull` y una comprobación de omisión de RLS para `service_role`.

- `anon` recibe `42501` al intentar pull, apply, registro Push, candidatos y lectura de tareas.
- `authenticated` recibe `42501` al intentar candidatos, reservas, el helper `dayflow_table` y lectura de `sync_records`/`push_deliveries`. Pull y apply sin sujeto también reciben `42501`.
- Una cuenta existente conserva todas sus filas propias en las 17 tablas legibles. Había filas propias en siete de ellas y cambios en la primera página de pull. Las otras diez estaban vacías para ese sujeto.
- Una identidad sintética ausente de `auth.users` no ve filas de esa cuenta en ninguna de esas 17 tablas y obtiene un pull vacío.
- La invocación directa del trigger de alta se rechaza y `row_security_active` resulta falso bajo `service_role` en las 19 tablas.

Solo había un perfil existente. La segunda identidad es sintética y se estableció dentro de la transacción: **no equivale a una segunda cuenta autenticada ni a un JWT válido**. No se comprobaron firmas JWT, la pasarela HTTP/PostgREST/GraphQL, escrituras adversariales, paginación completa del historial ni carreras. Los permisos de escritura se verificaron en el catálogo, sin ejecutar DML. La función del emisor solo se inspeccionó mediante catálogo y comparación de cuerpo.

El alcance de tablas y funciones es `public` y `graphql_public`; se incluyeron permisos de esquema de otros namespaces para contexto. No se certifican las políticas internas de Auth/Storage ni la lista completa de esquemas expuestos por la configuración HTTP remota: no apareció `pgrst.db_schemas` en los ajustes de rol consultados.

Respecto a la [auditoría estática original](2026-10-09.md), SQL-04 pasa de sospecha a permisos sobrantes confirmados, pendientes de corrección. SQL-05 queda comprobado en su parte de catálogo real; las pruebas con JWT de dos cuentas de ensayo siguen pendientes. El registro original se conserva sin reescribir.
