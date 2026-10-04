# Evaluación de Dayflow sin dispositivo móvil

Fecha: 3 de octubre de 2026. Código actual, incluidas las vistas Semana/Día y las relaciones entre notas, tareas y eventos.

## Dictamen

El MVP web está funcional para pruebas y uso personal controlado. No se encontraron fallos bloqueantes en los recorridos ejecutados. La sincronización alojada también se verificó con sesiones reales en navegadores independientes. Esto no acredita todavía un lanzamiento público: faltan correo real verificado, publicación web y notificaciones web programadas.

La evaluación se realizó en Windows con Chromium de escritorio, emulación móvil de Playwright y pantallas de 320 px. No se conectó un teléfono ni se ejecutó un emulador Android. La emulación móvil usa Chromium, aunque el perfil se denomine iPhone; no representa Safari ni iOS nativo.

## Comprobaciones ejecutadas

| Comprobación                            | Resultado                                        | Alcance                                                                                              |
| --------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| TypeScript, lint y formato              | Correctos                                        | Código y documentación                                                                               |
| Unitarias                               | 192 correctas en 36 archivos                     | Persistencia, validaciones, fechas/DST, recurrencias, conflictos, SQL y relaciones                   |
| Navegador                               | 92 correctas, sin reintentos                     | Tareas, notas, calendario, recordatorios, Inbox, búsqueda, etiquetas, Hoy, sesiones y sincronización |
| PWA con builds de producción            | 10 correctas                                     | Instalabilidad, caché, arranque offline, módulos no visitados, actualizaciones, borradores y logout  |
| Supabase alojado                        | Correcto                                         | Auth con contraseña, RPC, WebSocket, reconexión, RLS y relaciones entre dos clientes                 |
| Auditoría de dependencias de producción | 0 vulnerabilidades conocidas notificadas por npm | No equivale a una auditoría integral de seguridad                                                    |
| Build web/PWA                           | Correcto                                         | 70 recursos precargados, aproximadamente 1,64 MiB sin comprimir                                      |

Las suites generales usan Auth interceptado y PostgreSQL embebido donde corresponde. La comprobación alojada complementaria usa Supabase real. Se crearon cuentas temporales confirmadas por Admin API para evitar enviar correos; después se eliminaron y se verificó que no quedaban cuentas de esa prueba. No se modificaron cuentas personales.

## Vistas y relaciones

Semana/Día conservan fecha y vista en la URL, respetan inicio de semana y formato horario, permiten crear/abrir eventos y comparten los filtros existentes. Se comprobaron cruces de año, días completos, eventos nocturnos y horas repetidas. El horario agrupa por hora de inicio: no representa duraciones con bloques proporcionales ni permite arrastrar eventos.

Las relaciones se guardan localmente y aparecen en ambos extremos. Se verificaron búsqueda/filtro, apertura de los tres editores, protección de borradores, autoguardado de notas y desvinculación sin borrar los documentos. En Supabase real, una relación nota–tarea apareció en el segundo navegador y su retirada offline se propagó al reconectar.

La revisión visual detectó que la semana exigía desplazamiento horizontal incluso a 1280 px. Se redujo el ancho mínimo de la tabla de 1060 a 840 px: los siete días caben ahora en la ventana comprobada. Tras ese ajuste pasaron las cuatro pruebas específicas de Semana/Día en escritorio y móvil emulado, la comprobación alojada y el build. La suite PWA completa se ejecutó antes de ese ajuste exclusivamente de CSS.

En 320 px no hay desbordamiento horizontal de la página; la semana se desplaza dentro de su contenedor y la vista Día ofrece una alternativa más cómoda. Los editores conservan sus controles, aunque llegar a las relaciones requiere desplazamiento vertical. Las capturas se revisaron visualmente:

- [Semana en escritorio](../.toolchains/web-evaluation/week-desktop.png).
- [Semana a 320 px](../.toolchains/web-evaluation/week-320.png).
- [Día a 320 px](../.toolchains/web-evaluation/day-320.png).
- [Relaciones en escritorio](../.toolchains/web-evaluation/relations-desktop.png).
- [Relaciones a 320 px](../.toolchains/web-evaluation/relations-320.png).

## Pendientes y límites

1. **Alta prioridad: correo y publicación.** Confirmación y recuperación por email externo no se comprobaron. La web sigue local; el backend está alojado. Falta disponer de dominio HTTPS y sus retornos de Auth para distribuir la web.
2. **Web Push: implementación posterior a esta evaluación.** El 4 de octubre se añadió suscripción, worker y emisor programado en Supabase. Sigue pendiente la entrega completa a una suscripción real y su comportamiento con el sistema suspendido. Consulta [Web Push](web-push.md).
3. **Límite de funcionamiento: app cerrada y sesión offline.** La sincronización necesita la aplicación activa. El acceso offline necesita caché y una sesión restaurable; si requiere renovar el token, necesita conexión.
4. **Mejoras de producto:** bloques de duración y arrastrar eventos, excepciones individuales de recurrencias y adjuntos siguen fuera de esta entrega. No impiden los recorridos actuales.
5. **Validación adicional:** no se midieron rendimiento en teléfonos lentos, grandes volúmenes de datos, accesibilidad con lector de pantalla, Safari/Firefox ni entrega de notificaciones con suspensión o reinicio del sistema.

El siguiente paso para uso fuera del entorno de desarrollo es comprobar correo real y publicar la web. Las verificaciones que dependen de un teléfono quedan claramente separadas de las que ya se han completado sin él.
