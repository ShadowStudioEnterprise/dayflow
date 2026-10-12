# Repetición controlada del calendario móvil

Fecha: 12 de octubre de 2026, Europe/Madrid. Rama: `investigation/calendar-mobile`.
Estado: **investigación cerrada por evidencia de repeticiones controladas**. El fallo no se reprodujo; no se declara identificada ni corregida una causa propia del calendario.

## Procedimiento y resultados

Base: `d3910ab5d4fd8095b7ae9052c4bba8da62615def`, árbol limpio al empezar. Windows, Node 24.18.0 y Playwright 1.63.0. Se ejecutaron los diez escenarios de `e2e/calendar.spec.ts` con el proyecto `calendar-mobile`: Chromium con emulación iPhone 13, contexto nuevo por intento y cero reintentos.

| Batería  | Inicio Europe/Madrid | Workers | Repeticiones por escenario | Resultado             | Duración | Salida |
| -------- | -------------------- | ------: | -------------------------: | --------------------- | -------: | -----: |
| Paralela | 05:47:27             |       4 |                         10 | **100/100 correctos** |  190,2 s |      0 |
| En serie | 05:50:38             |       1 |                          3 | **30/30 correctos**   |  145,0 s |      0 |

Total: **130/130 correctos**, trece intentos por escenario, sin omitidos ni reintentos. Se verificó programáticamente que los reportes contienen diez escenarios y el número previsto de intentos, todos con `status: passed` y `retry: 0`.

Los hashes SHA-256 de `src/`, `e2e/`, configuración Playwright/Vite y lockfile coinciden antes y después de ambas baterías. No se modificaron fuentes ni esperas durante los ensayos. La documentación se escribió al terminar. No hay trazas de fallo porque no hubo fallos; la configuración las conserva si un intento falla.

Cobertura: creación/edición/recarga, días completos y preferencias, tareas/filtros, recurrencia y borrado, offline y 320 px, borrador y hora inexistente por DST, conflicto entre pestañas, aislamiento de cuentas, semana/día y cambio de año, domingo y formato de 12 horas.

## Recorrido y conclusión

UI del calendario → editor y validación → repositorio por cuenta → IndexedDB y cola local → agenda → recarga/reconexión. IndexedDB y los servicios del producto son reales. Auth y Realtime están interceptados por la fixture; la API de sincronización devuelve la respuesta de backend no configurado prevista por `auth-fixture.ts`. La reconexión de estos casos no certifica convergencia con Supabase alojado.

La [investigación del 10 de octubre](2026-10-10-e2e-intermittency.md) conservaba otras 130 ejecuciones correctas del calendario, incluidas repeticiones junto a Sync. El fallo reproducible de aquella batería pertenecía al arranque de Sync y tiene una [corrección independiente](2026-10-10-e2e-sync-fix.md). Esta revisión no atribuye un fallo del calendario a esa causa sin evidencia.

Se cumple el criterio de reunir evidencia suficiente mediante repeticiones controladas. La conclusión es **fallo no reproducido en este entorno**, no ausencia absoluta de intermitencia. No se certifican Safari, hardware, PWA instalada, CI ni carga simultánea con otros archivos. Si reaparece, conservar SHA, escenario, perfil, workers, traza, errores y solicitudes, sin editar fuentes durante la ejecución.

## Evidencia y reproducción

- [Entorno, comandos, salidas y hashes antes/después](evidence/2026-10-12-calendar-mobile/environment.json).
- [Cien intentos paralelos](evidence/2026-10-12-calendar-mobile/parallel-evidence.json).
- [Treinta intentos en serie](evidence/2026-10-12-calendar-mobile/serial-evidence.json).

Los JSON contienen cada intento, tiempos y hash del reporte original. Reportes completos, logs y harness permanecen en `.toolchains/calendar-2026-10-12/`, ignorado por Git. Los JSON usan UTC y la tabla Europe/Madrid.

```powershell
npx playwright test --project calendar-mobile --repeat-each 10 --workers 4 --retries 0 --reporter json
npx playwright test --project calendar-mobile --repeat-each 3 --workers 1 --retries 0 --reporter json
```

Mantener los puertos 4173/4175 disponibles. Para conservar reportes, usar un `PLAYWRIGHT_JSON_OUTPUT_NAME` distinto por batería o capturar stdout sin mezclar stderr. `scripts/summarize-e2e-investigation.mjs` genera la evidencia compacta. No se modificó código del producto ni backend externo.
