# Suite de Supabase local con Docker — 10 de octubre de 2026

**Criterio de cierre cumplido: 2/2 pruebas aprobadas sobre el SHA `a061438fcdb8b47d2d4d0b05ce9188338f9a282c`, con logs conservados.**

Ejecución en un worktree separado y limpio (`.toolchains/supabase-local-a061438`), sin incorporar los cambios pendientes del directorio principal. Inicio: 12:10:06 Europe/Madrid; duración: 25,636 segundos. Windows, Node 24.18.0, npm 11.16.0, Supabase CLI 2.118.0 y Docker Engine 26.1.1. Se reutilizó `node_modules` mediante una junction; no se reinstalaron dependencias. El hash del lockfile y el estado limpio se conservan en el manifiesto.

Comando: `npm run test:local -- --reporter=line,json`, con `CI=1`. Código de salida **0**, dos resultados esperados, cero fallos, cero omisiones y cero pruebas inestables. Configuración: `playwright.local.config.ts`, un worker y cero reintentos.

| Prueba | Resultado y alcance |
| --- | --- |
| Registro, confirmación, recuperación y cierre de sesión | Aprobada; Auth y correo local reales, cambio de contraseña, nuevo login y sincronización. |
| Dos instalaciones y otra cuenta | Aprobada; RPC y WebSocket reales, actualización de tareas, recuperación offline y aislamiento en UI y REST con sesión autenticada. |

Docker Desktop se arrancó y recuperó el stack local existente. Antes de ejecutar las pruebas se aplicaron exclusivamente a la base local las migraciones pendientes `202610040005_web_push.sql` y `202610090006_security_privileges.sql` mediante `supabase db push --local --yes`, con salida 0. Se verificaron las seis versiones en el historial y el estado de los contenedores. No se reinició desde una base vacía: las 23 cuentas preexistentes se conservaron. Las tres cuentas creadas durante la ejecución se eliminaron por prefijo y ventana temporal; el recuento volvió a 23.

El servidor de pruebas configura explícitamente `http://127.0.0.1:54321`; no se modificó `.env.local` del proyecto principal. El stack Docker queda encendido. Esta suite no verifica el emisor Edge de Web Push, almacenamiento, carga ni dispositivos físicos.

## Evidencia conservada

Directorio: [evidence/2026-10-10-supabase-local-a061438](evidence/2026-10-10-supabase-local-a061438/).

- [Manifiesto de ejecución](evidence/2026-10-10-supabase-local-a061438/execution.json): SHA, estado del checkout, versiones, comando, salida y resultados.
- [Informe Playwright](evidence/2026-10-10-supabase-local-a061438/playwright.json), [stdout](evidence/2026-10-10-supabase-local-a061438/playwright.stdout.txt), [stderr](evidence/2026-10-10-supabase-local-a061438/playwright.stderr.txt) y [código de salida](evidence/2026-10-10-supabase-local-a061438/playwright.exit.txt).
- [Plan de migraciones](evidence/2026-10-10-supabase-local-a061438/migrations-plan.txt), [aplicación](evidence/2026-10-10-supabase-local-a061438/migrations-apply.txt), [historial y recuento](evidence/2026-10-10-supabase-local-a061438/db-state-before.txt), [estado Docker](evidence/2026-10-10-supabase-local-a061438/docker-status.txt) y [limpieza](evidence/2026-10-10-supabase-local-a061438/cleanup.txt).
- [Hashes SHA-256](evidence/2026-10-10-supabase-local-a061438/checksums.json) de los archivos de evidencia anteriores.

Los avisos de color de Node aparecen en stderr y no afectaron a las pruebas. Los archivos TXT conservan la salida de PowerShell, incluidas sus envolturas de stderr. No se guardaron claves administrativas, contraseñas ni enlaces de correo.

