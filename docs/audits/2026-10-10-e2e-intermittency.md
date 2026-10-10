# Intermitencia E2E de sincronización y calendario móvil

**Estado: investigación cerrada.** Este informe conserva el diagnóstico anterior a la [corrección posterior, validada con 70 E2E](2026-10-10-e2e-sync-fix.md). Se cumple el criterio solicitado: causa de Sync identificada con reproducción controlada y calendario móvil repetido con evidencia suficiente en el entorno descrito. Los resultados de este informe corresponden al producto previo a la corrección.

Base: `3d9568c1829ce044cc2238aecc6241fe3bf83515`, Windows, Node 24.18.0, npm 11.16.0, Playwright 1.63.0, Vite 8.3.0 y PGlite 0.5.8. Fecha: 10 de octubre de 2026. No se modificó código del producto ni los escenarios funcionales existentes. Se añadieron una sonda optativa, su configuración y un extractor de evidencia; TypeScript incluye la configuración nueva.

## Resultados por batería

Todos los ensayos tuvieron **cero reintentos**. Cada intento usa un contexto de navegador nuevo. Sync crea además su propia instancia PostgreSQL embebida; no comparte datos con otros tests.

| Batería                                       | Hora Europe/Madrid de inicio | Workers |                 Repeticiones | Resultado                          | Salida |
| --------------------------------------------- | ---------------------------- | ------: | ---------------------------: | ---------------------------------- | -----: |
| Sync escritorio y móvil + calendario móvil    | 15:05:19                     |       4 |             10 por escenario | 148 correctos, 12 fallidos de 160  |      1 |
| Calendario móvil, fuentes inmutables          | 15:13:23                     |       1 |              3 por escenario | 30/30 correctos                    |      0 |
| Sonda de arranque de Sync, fuentes inmutables | 15:16:21                     |       1 | 5 en escritorio y 5 en móvil | 10/10 reproducciones de la carrera |      0 |

Detalle de la primera batería: calendario móvil **100/100**; Sync escritorio **22/30** y Sync móvil **26/30**. Once fallos corresponden al escenario de respuesta perdida/fallo del servidor: siete en escritorio y cuatro en móvil. Las once trazas muestran la misma alerta de motor aún no registrado. Los restantes escenarios de Sync suman 39 intentos correctos y un intento invalidado en acceso, descrito abajo.

El resultado `flaky: 0` del reporter significa que ningún test pasó mediante un reintento. **No significa ausencia de intermitencia:** las repeticiones del mismo escenario de servidor dieron nueve aciertos y once fallos.

## Causa identificada en Sync

Recorrido: tarea local → IndexedDB/cola → carga completa de `/settings` → clic en «Sincronizar ahora» → motor → RPC/PGlite → checkpoint/UI.

1. [`AppProviders.tsx`](https://github.com/ShadowStudioEnterprise/dayflow/blob/3d9568c1829ce044cc2238aecc6241fe3bf83515/src/app/providers/AppProviders.tsx) carga `SyncRuntime` con `lazy` dentro de un `Suspense` independiente, con fallback nulo. La pantalla de Configuración puede estar operativa antes de que ese módulo termine de cargar.
2. [`SyncSettings.tsx`](https://github.com/ShadowStudioEnterprise/dayflow/blob/3d9568c1829ce044cc2238aecc6241fe3bf83515/src/features/sync/SyncSettings.tsx) habilita el botón según `busy` y conectividad, sin comprobar si el motor está registrado.
3. [`sync-control.ts`](https://github.com/ShadowStudioEnterprise/dayflow/blob/3d9568c1829ce044cc2238aecc6241fe3bf83515/src/services/sync/sync-control.ts) rechaza el clic anterior al registro con **«La sincronización todavía se está iniciando. Vuelve a intentarlo.»**
4. Después de cargar el módulo, [`SyncRuntime.tsx`](https://github.com/ShadowStudioEnterprise/dayflow/blob/3d9568c1829ce044cc2238aecc6241fe3bf83515/src/services/sync/SyncRuntime.tsx) registra y arranca el motor. La comprobación automática recibe el 503 y escribe el error esperado en el checkpoint.
5. El E2E espera ese error en un elemento `role=alert`, pero el clic había producido la alerta de arranque. El fallo automático posterior aparece como `role=status`. Por eso el locator esperado agota sus cinco segundos aunque el error del servidor sí se muestra y la operación sigue pendiente.

Hay además un límite del helper `sync()` existente: comprobar «Sin pendientes», cola vacía y presencia de un `<time>` no acredita que **ese clic** haya completado una sincronización nueva. Tras recargar, puede observar un checkpoint histórico mientras el clic falla por arranque. Esto facilita que el recorrido avance hasta el fallo posterior.

### Reproducción controlada

La sonda descrita aquí verificaba el defecto. Tras la corrección se actualizaron sus expectativas para comprobar el botón deshabilitado durante el arranque; los diez resultados originales enlazados abajo se conservan intactos.

[`sync-startup.probe.ts`](https://github.com/ShadowStudioEnterprise/dayflow/blob/14b8df1/e2e/sync-startup.probe.ts) intercepta únicamente la carga HTTP del módulo `SyncRuntime.tsx` y la retiene mediante una barrera explícita, sin una espera temporal arbitraria. Auth se intercepta en Playwright y las RPC conservan la fixture SQL existente.

En cada uno de los diez ensayos:

- Se guarda una tarea y se fuerza la indisponibilidad del backend.
- Se carga Configuración reteniendo `SyncRuntime`; el botón está habilitado y el clic produce la alerta de arranque.
- Se libera la barrera y se espera una respuesta real de la fixture HTTP con estado 503.
- Otro clic produce la alerta «No se pudo contactar con Supabase» y la exportación de pendientes permanece habilitada.

La sonda pasa cuando **reproduce el defecto**, no cuando demuestra su corrección. Adjunta el estado antes/después y conserva una traza de todos sus intentos. Una futura corrección deberá actualizar sus expectativas.

Corrección recomendada: exponer de forma reactiva la disponibilidad del motor y deshabilitar la acción hasta su registro, o hacer que la acción espere ese registro con cancelación al cambiar de sesión. El helper E2E debe esperar disponibilidad y una confirmación correspondiente a la acción actual. Mantener el caso de recarga: sustituirlo exclusivamente por navegación SPA ocultaría la carrera. No se implementó esa corrección en esta investigación.

## Calendario móvil

**130/130 ejecuciones correctas**, trece por cada uno de sus diez escenarios: diez con cuatro workers y tres con uno. La segunda batería se ejecutó sin editar archivos. Se cubrieron creación/edición/recarga, días completos y navegación, tareas y filtros, recurrencia/borrado, offline y 320 px, horario inexistente/descarte, conflicto entre pestañas, aislamiento de cuentas y vistas semana/día con preferencias y cambio de año.

No se reprodujo un fallo de calendario ni se identificó una causa propia. Se cierra esta parte por las repeticiones controladas y registradas, no por un único acierto. La conclusión se limita a Chromium con emulación iPhone 13 y los escenarios existentes; no demuestra ausencia absoluta de intermitencia ni valida WebKit/iOS/Android físicos, CI u otros perfiles de carga.

## Intento invalidado y límites

Durante la primera batería se añadió la configuración de la sonda a `tsconfig.node.json`. Su escritura, a las **15:07:25**, coincide con una recarga de Vite en la traza del intento 8 del conflicto offline de escritorio: documento `/auth/login` solicitado nuevamente a las **13:07:25.184 UTC**, reconexión de Vite y formulario vacío. El fallo ocurre antes de enviar una solicitud de Auth. Se conserva como **ensayo contaminado por la edición del investigador**, excluido de conclusiones sobre el producto. Los fallos de arranque de Sync ya se habían reproducido antes de esa edición. Las dos baterías posteriores mantuvieron las fuentes inmutables.

Auth y Realtime están simulados. IndexedDB, los servicios de la aplicación y las RPC de Sync en PostgreSQL embebido son reales. Las RPC usan las cuatro migraciones de la fixture existente; estos ensayos no sustituyen validación contra Supabase alojado, RLS con JWT reales o dispositivos físicos.

## Evidencia y reproducción

- [Entorno, comandos, salidas y hashes de fuentes](evidence/2026-10-10-e2e-intermittency/environment.json).
- [Todos los intentos de la batería inicial](evidence/2026-10-10-e2e-intermittency/baseline-evidence.json).
- [Calendario en serie](evidence/2026-10-10-e2e-intermittency/calendar-serial-evidence.json).
- [Reproducciones controladas y estados antes/después](evidence/2026-10-10-e2e-intermittency/startup-probe-evidence.json).
- [Extractos temporales de las doce trazas fallidas](evidence/2026-10-10-e2e-intermittency/trace-findings.json).

Los JSON compactos conservan cada intento, ID de escenario, resultado, duración, worker, errores y hashes de artefactos. `attemptNumber` indica el orden del intento para ese escenario en el reporter; los nombres de artefactos fallidos conservan el índice original de `repeat-each`. Los reportes originales y ZIP completos se conservan localmente en `.toolchains/e2e-investigation/`, ignorado por Git. Las trazas de la primera batería se copiaron a `baseline-artifacts/`, conservando los subdirectorios originales de `test-results/`; sus hashes permiten comprobar la correspondencia.

Para repetir, mantener los archivos sin cambios durante cada comando y usar directorios de salida separados:

```powershell
$env:PLAYWRIGHT_JSON_OUTPUT_NAME='.toolchains/e2e-investigation/repeated-baseline.json'
npx playwright test --project sync-desktop --project sync-mobile --project calendar-mobile --repeat-each 10 --retries 0 --output .toolchains/e2e-investigation/repeated-baseline-artifacts --reporter json

$env:PLAYWRIGHT_JSON_OUTPUT_NAME='.toolchains/e2e-investigation/repeated-calendar.json'
npx playwright test --project calendar-mobile --repeat-each 3 --workers 1 --retries 0 --output .toolchains/e2e-investigation/repeated-calendar-artifacts --reporter json

$env:PLAYWRIGHT_JSON_OUTPUT_NAME='.toolchains/e2e-investigation/repeated-probe.json'
npx playwright test --config playwright.investigation.config.ts --repeat-each 5 --retries 0 --output .toolchains/e2e-investigation/repeated-probe-artifacts --reporter json

node scripts/summarize-e2e-investigation.mjs .toolchains/e2e-investigation/repeated-probe.json .toolchains/e2e-investigation/repeated-probe-evidence.json
```

La configuración de investigación es optativa y no incorpora la sonda a la suite funcional ordinaria. Los servidores 4173/4175 deben estar disponibles según `playwright.config.ts`. No se desplegó ni se modificó un backend externo.

Comprobaciones finales: `npm run typecheck`, lint de los tres archivos de código nuevos, formato de los archivos modificados y `npm run docs:check`, correctos. Se comprobó también que los JSON contienen los 200 intentos, todos con `retry: 0`, y que sus conteos coinciden con los reportes originales. No se ejecutó una regresión completa ajena a estos escenarios.
