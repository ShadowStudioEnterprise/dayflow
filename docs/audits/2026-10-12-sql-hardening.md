# Versiones autoritativas, invocación y endurecimiento SQL

Fecha cliente: **12 de octubre de 2026, Europe/Madrid**. Rama creada desde `dev`: `fix/authoritative-versions-sql-hardening`; base `b7b2a69c2cab8c8c630783a0c7b3585f0a9597d6`.

## Decisiones y cambios

| Hallazgo                     | Decisión                                                                                    | Aplicación                                                                                                                                                                                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SQL-01: versiones cliente    | Separar revisión autoritativa del servidor y versión del sello del autor.                   | Nueva entidad RPC: revisión 1. Actualización aceptada: revisión anterior + 1. El cliente no puede inflar ese contador con `2147483647`. El sello conserva la versión original; reintentos devuelven el acuse original.                                              |
| SQL-02: fechas cliente       | Mantener LWW para snapshots offline, con validación más estricta.                           | Instantes ISO con offset, precisión máxima de milisegundos y finitos; no se admiten `now`, fechas civiles ni infinitos como auditoría. Creación no posterior a actualización, inmutable al actualizar; tombstone igual a escritura; máximo futuro de cinco minutos. |
| SQL-03: error de suscripción | Evitar un mensaje específico que confirme un endpoint ajeno.                                | Endpoint inválido/nulo/ajeno y claves inválidas comparten `22023 / Invalid push subscription`. No se transfiere propiedad. El frontend ya muestra un mensaje genérico. El límite de dispositivos conserva un mensaje propio sobre la cuenta solicitante.            |
| SQL-04: PUBLIC               | Mantener la corrección anterior y eliminar defensa latente insuficiente.                    | Revocación DML de `PUBLIC`, `anon` y `authenticated` en doce entidades y acuses; retirada de sus 26 políticas INSERT/UPDATE. Defaults de tablas/secuencias sin PUBLIC en `public`; EXECUTE explícito en funciones reemplazadas.                                     |
| SQL-06: invocación           | Conservar límites funcionales; no introducir una cuota SQL que prometa protección de abuso. | No se añade rate limiting: una transacción rechazada revierte su contador, y una cuota arbitraria puede bloquear recuperación offline. La protección de peticiones debe aplicarse antes de ejecutar RPC, con identidad verificada y métricas.                       |

La migración aditiva es `202610120007_sync_hardening.sql`. No cambia las firmas RPC, borra datos ni reescribe sellos, acuses o historial. Las revisiones existentes se conservan y avanzan desde su valor actual. Un contador preexistente en el máximo de integer requiere reparación administrativa específica; no se oculta ni se reinicia automáticamente. El rol de servicio conserva las operaciones previstas y el perfil permite la edición directa propia.

Una revisión del servidor identifica escrituras aceptadas; no sustituye el sello LWW ni equivale a CAS. Se descarta cambiar ahora a orden por recepción del servidor: una edición antigua enviada tarde podría reemplazar una reciente, y exigiría versionar el protocolo, migrar réplicas y definir cómo reenviar colas antiguas. Fechas dentro de los cinco minutos aún pueden ganar prematuramente, y relojes atrasados pueden perder. Se mantienen copias de conflicto, aviso de desfase y reenvío explícito. Una versión extrema en el sello todavía puede ganar empates exactos de fecha dentro de la misma cuenta; no permite acceso a otra cuenta.

## Límites de invocación y decisión operativa

| Entrada       | Límite actual                                                                                      | Alcance                                                                                               |
| ------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Apply         | 2 MiB por operación, bloqueo por cuenta, ID idempotente                                            | No limita llamadas por minuto ni la retención acumulada.                                              |
| Pull          | 1–100 cambios por llamada                                                                          | No limita frecuencia ni bytes totales del historial.                                                  |
| Motor cliente | 200 envíos y 20 páginas por descarga; timeout HTTP 15 s; sondeo de respaldo 30 s                   | Un cliente modificado puede eludirlos.                                                                |
| Registro Push | Diez endpoints por cuenta, registro serializado e idempotente                                      | Repetir el registro del mismo endpoint no consume otro dispositivo y no está limitado por frecuencia. |
| Emisor        | POST y secreto de Cron obligatorio; páginas de 100; presupuesto blando 45 s; timeout proveedor 8 s | No es un límite duro de duración ni una cuota por usuario.                                            |
| Reserva Push  | Tres intentos, separación de 90 s, ventana de cinco minutos                                        | Reduce reenvíos de una ocurrencia; no limita llamadas RPC.                                            |

Antes de añadir protección de abuso, medir peticiones por RPC y sujeto, tasas de 4xx/5xx, latencia, espera de bloqueo y crecimiento de historial/acuses. No registrar JWT, endpoints, claves o contenido. La decisión es usar una capa de entrada con cuota por sujeto autenticado y límite agregado/IP, contar también rechazos, responder 429 con espera de reintento y comprobar clientes offline acumulados e idempotencia. Los umbrales se deben fijar con tráfico observado y pruebas de ráfagas/concurrencia; no hay evidencia para declarar un número seguro hoy. Esa infraestructura queda fuera de esta migración y **no se acredita protección de abuso ni capacidad de producción**.

El mensaje uniforme reduce el oráculo explícito; éxito, cuota propia y tiempos de respuesta no son indistinguibles. No se afirma resistencia a análisis temporal.

## Permisos PUBLIC y compatibilidad

`PUBLIC` abarca todos los roles. Revocar solo `anon` y `authenticated` no neutraliza un grant a PUBLIC. La migración 6 ya retira el default global de EXECUTE para futuras funciones de `postgres`; una revocación por esquema no puede retirar un permiso global. Los defaults dependen del rol creador y no reparan objetos existentes: nuevas migraciones deben declarar permisos, especialmente si cambia el propietario. Véanse [privilegios PostgreSQL](https://www.postgresql.org/docs/current/ddl-priv.html) y [ALTER DEFAULT PRIVILEGES](https://www.postgresql.org/docs/current/sql-alterdefaultprivileges.html).

La validación explícita evita los valores especiales aceptados por PostgreSQL que no forman parte del contrato ISO del cliente; véase [tipos de fecha y hora](https://www.postgresql.org/docs/current/datatype-datetime.html). No se aplica esta restricción a fechas de programación de recordatorios o eventos, que tienen contratos distintos.

## Validación y cierre

Se ejecutan las migraciones completas en PostgreSQL embebido PGlite con defaults que reproducen grants directos de Supabase y EXECUTE de PUBLIC. Se comprueban revisiones extremas, acuse repetido, avance de revisión, fechas rechazadas, permisos efectivos de un rol nuevo y denegación RLS tras un GRANT accidental. La integración Sync comprueba convergencia, tombstones, recurrencias, recuperación y paginación con la migración nueva; las pruebas Push verifican aislamiento, mensaje uniforme, claves, reservas y diez dispositivos.

Resultados de esta rama: **299/299 pruebas unitarias en 47 archivos**, incluidas **21/21 pruebas dirigidas de SQL, Sync y Push**. `npm run typecheck`, `npm run lint`, `npm run docs:check`, `npm run test:docs` (3/3), formato de archivos afectados y `git diff --check`, correctos. El script adversarial HTTP se actualiza para exigir el código y mensaje uniformes de la migración 7; `node --check scripts/audit-supabase-api.mjs` pasa, pero no se ejecuta contra el backend alojado.

Criterio de esta tarea: decisiones documentadas y cambios aplicados al repositorio. No se despliega la migración al proyecto alojado; las auditorías remotas históricas no prueban este cambio. No se certifican carreras reales, rate limiting, carga en producción ni entrega física de avisos. Para desplegar, aplicar las migraciones pendientes en orden y repetir las pruebas con JWT reales y la suite local Docker.

## Estado del despliegue

**Pendiente de aplicar en Supabase alojado:** `202610120007_sync_hardening.sql`. La integración de esta rama en `dev` incorpora código y documentación al repositorio; no ejecuta la migración ni acredita que el backend remoto tenga estas correcciones.

El cierre del despliegue requiere aplicar las migraciones pendientes en orden, verificar el historial y los permisos efectivos del backend, y repetir las pruebas adversariales con JWT reales y la suite local Docker. Hasta entonces, las 299 pruebas aprobadas corresponden a validación local, y los resultados remotos anteriores corresponden a las migraciones anteriores.
