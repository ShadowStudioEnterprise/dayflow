# Estado de CI y producción — 12 de octubre de 2026

Estado documental: **cerrado**, con SHA, fecha, resultados y enlaces a evidencia.
Consulta de solo lectura de GitHub Actions y Vercel el 12 de octubre de 2026.
Las horas de este informe están en Europe/Madrid (UTC+02:00); los JSON conservan UTC.

## Versión vigente

- Rama publicada: `main`.
- SHA: [`b7b2a69c2cab8c8c630783a0c7b3585f0a9597d6`](https://github.com/ShadowStudioEnterprise/dayflow/commit/b7b2a69c2cab8c8c630783a0c7b3585f0a9597d6), merge del [PR #7](https://github.com/ShadowStudioEnterprise/dayflow/pull/7).
- CI: [Dayflow CI #17, intento 1](https://github.com/ShadowStudioEnterprise/dayflow/actions/runs/38194437521), evento `push`, `completed / success`.
- CI iniciada el 12/10/2026 a las **04:05:38**; última actualización **04:14:06**.
- Producción: `dpl_BBsU3TZUtcfzmt7ijJFC1fLreFTA`, **READY**, fuente Git, mismo SHA según metadatos de Vercel.
- Creación del despliegue: **04:05:41.188**; listo: **04:06:24.015**.
- URL estable: [Dayflow en Vercel](https://dayflow-by-shadowstudio.vercel.app).
- URL del despliegue: [dayflow-4rc1qhw07](https://dayflow-4rc1qhw07-shadow-studio3.vercel.app).
- Proyecto: `shadow-studio3/dayflow`, `prj_fpBaMferBZRyCQU5U8H67MF4IiKB`.
- [Detalle y logs de Vercel](https://vercel.com/shadow-studio3/dayflow/dpl_BBsU3TZUtcfzmt7ijJFC1fLreFTA).

El despliegue quedó listo antes de terminar CI. Ambos resultados corresponden
al mismo SHA, pero esta cronología no demuestra que CI bloqueara la publicación.
La rama local `dev` está en `0b015e8b03775c9b8e99f5d56b2f1f1c6d93d84e`:
la preparación SMTP y el endurecimiento SQL posteriores no quedan certificados
por este CI ni atribuidos a esta publicación.

## Resultados de CI

Entorno registrado en los logs: Ubuntu 24.04.5, Node **24.21.0**, npm **11.19.0**.
Chromium instalado en los jobs de navegador. Los tres jobs finalizaron `success`.

| Job             | Resultado                                                                                                                    | Fin (12/10/2026) | Evidencia                                                                                                 |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------- |
| `validate`      | Documentación, 3 pruebas documentales, portal, TypeScript, lint, formato, build y **296 unitarias en 47 archivos** correctos | 04:07:14         | [Job y logs](https://github.com/ShadowStudioEnterprise/dayflow/actions/runs/38194437521/job/114633904814) |
| `browser (pwa)` | **20 pruebas correctas**                                                                                                     | 04:07:16         | [Job y logs](https://github.com/ShadowStudioEnterprise/dayflow/actions/runs/38194437521/job/114633904950) |
| `browser (e2e)` | **106 pruebas correctas**                                                                                                    | 04:14:05         | [Job y logs](https://github.com/ShadowStudioEnterprise/dayflow/actions/runs/38194437521/job/114633904971) |

El workflow ejecutado no incluye `test:smtp`; ese paso pertenece a cambios
posteriores en `dev`. El intento 1 del workflow no equivale al número de
reintentos internos de Playwright. No se extrapolan estos jobs a dispositivos
físicos, entrega de correo, notificaciones reales ni al backend alojado.

Artefactos disponibles al consultar, con retención de siete días:

- [PWA, artefacto 11722653934](https://github.com/ShadowStudioEnterprise/dayflow/actions/runs/38194437521/artifacts/11722653934), 417853 bytes; caducidad 19/10/2026, 04:07:13.
- [E2E, artefacto 11722644781](https://github.com/ShadowStudioEnterprise/dayflow/actions/runs/38194437521/artifacts/11722644781), 423284 bytes; caducidad 19/10/2026, 04:14:02.

## Compilación y límites del despliegue

Los logs de Vercel muestran clonación de `main / b7b2a69`, `npm ci`,
`tsc -b && vite build`, build completado y **74 entradas de precaché**.
La instalación informa **5 vulnerabilidades (2 moderadas y 3 altas)**;
el resultado READY no acredita ausencia de vulnerabilidades. No se investigó
su distribución entre dependencias de desarrollo y producción en esta tarea.

Esta consulta acredita metadatos y compilación del despliegue. No se repitieron
recorridos de navegador, correos ni entrega física de Push sobre este SHA.
La [validación manual de Auth y Push](2026-10-12-vercel-auth-web-push.md)
corresponde al despliegue anterior a las correcciones de interfaz; conserva su
alcance y sus intentos fallidos.

## Evidencia conservada

- [Instantánea de GitHub Actions](2026-10-12-ci-deployment.json): run, jobs, pasos, resultados, fechas y artefactos; fuentes API y hora de consulta.
- [Instantánea de Vercel y extractos de logs CI](2026-10-12-deployment-evidence.json): SHA, aliases, estado, fechas, compilación y conteos de pruebas.

Son instantáneas seleccionadas de consultas remotas, no una nueva ejecución
local ni una copia íntegra de los artefactos de Playwright. Permanecen en Git
cuando caduquen los artefactos temporales. Los informes anteriores y las
entradas fechadas de [verificación](../verification.md) se conservan intactos.
