# PWA instalada: Android y Safari/iOS

Fecha: 12 de octubre de 2026, Europe/Madrid. Rama: `validation/pwa-mobile`.
Estado: cobertura automatizada del 12 de octubre y resultados físicos de Chrome Android del 15 de noviembre. Safari/iOS sigue pendiente de validación física.

## Alcance vigente

Por decisión del usuario, la app nativa iOS queda descartada: compilación/firma/pruebas en iPhone o iPad y notificaciones locales nativas iOS se retiran del plan. No se eliminan los recursos históricos del repositorio. Se mantiene la PWA en Safari/iOS como parte de esta tarea; no necesita Xcode ni la app Capacitor.

Android nativo y sus alarmas mantienen sus protocolos independientes. Probarlos no valida la PWA, y probar Chromium con viewport iPhone tampoco valida Safari.

## Ejecución automatizada

- Referencia inicial: `76f58ef229b16e5904d6a8808c2884bac24c542c`, árbol limpio al comenzar.
- Entorno: Windows, Node `24.18.0`, npm `11.16.0`.
- `npm run test:pwa`: **20 pruebas correctas**, 44,6 segundos, sin reintentos.
- Configuración: `playwright.pwa.config.ts`, Chromium de Playwright, proyectos `pwa-desktop` y `pwa-mobile`. El segundo usa dimensiones/perfil de iPhone 13 con Chromium explícito, no Safari/WebKit ni un teléfono.
- Servidor: `http://127.0.0.1:4177`, dos builds de producción separados en `dist-pwa-test/a` y `b`; Auth/API de prueba interceptadas y clave VAPID de fixture, sin proveedor Push real.
- Cobertura observada: manifest/iconos/caché pública, nueva ventana offline con persistencia y rutas no visitadas, actualización A → B que conserva un borrador y espera al cierre de todas las ventanas, bloqueo de acceso privado tras cerrar sesión, permisos y diagnóstico Push, presentación a 320 px y tema oscuro.
- Se añade un caso específico de cuentas A → B → A con almacenamiento compartido, apertura de B en una nueva ventana offline, persistencia de los datos de A y ausencia de datos cruzados. `npm run test:pwa -- --grep "cambiar de cuenta"`: **2 pruebas correctas**, 14,6 segundos, sin reintentos, sobre el cambio de `e2e/pwa.spec.ts` de esta rama. La ejecución inicial de 20 y la dirigida de 2 son ejecuciones separadas; no se afirma haber repetido toda la suite de 22.

Estas pruebas no certifican instalación standalone, persistencia frente a políticas reales del navegador, backend alojado, Safari, recepción de correo ni Push móvil. Las comprobaciones de cierre de sesión y aislamiento no demuestran sincronización de la cola con un servidor real.

## Protocolo físico

Usar el dominio final [Dayflow en Vercel](https://dayflow-by-shadowstudio.vercel.app), dos cuentas de prueba confirmadas y elementos con un prefijo único por ejecución. Antes de probar, registrar modelo, versión del SO y navegador, fecha/hora, URL y SHA del despliegue vigente, tipo de instalación y estado de almacenamiento/red. Consultar el despliegue actual antes de atribuirle resultados; la referencia histórica de CI no acredita una publicación posterior.

En Android instalar desde Chrome mediante el menú de instalación del navegador o el botón de Dayflow cuando esté disponible. En iPhone/iPad abrir en Safari y usar Compartir → Añadir a la pantalla de inicio, con apertura como app web si se ofrece. Confirmar que el icono abre una ventana standalone, no sólo una pestaña. Referencias: [Google Chrome](https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid&hl=es) y [Apple](https://support.apple.com/es-es/guide/iphone/iphea86e5236/ios).

Crear registros independientes para **Chrome/Android instalado**, **Safari/iOS en pestaña** y **PWA/iOS instalada**. No asumir que comparten sesión o almacenamiento: iniciar sesión y verificar la preparación offline en cada contexto. Mantener las apps nativas fuera de la prueba.

| Caso                              | Procedimiento y aceptación                                                                                                                                                                                                                             | Chrome Android instalada     | Safari iOS pestaña    | PWA iOS instalada |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------- | --------------------- | ----------------- |
| PWA-01 Instalación                | Instalar y abrir desde el icono; verificar modo standalone, nombre e icono.                                                                                                                                                                            | Superado (AND-06)            | No aplicable: pestaña | Pendiente         |
| PWA-02 Preparación                | Iniciar sesión con A, crear una tarea/nota y esperar guardado, sincronización y «Lista para abrir sin conexión».                                                                                                                                       | Confirmación global          | Pendiente             | Pendiente         |
| PWA-03 Arranque offline           | Desactivar datos y Wi-Fi, cerrar el contexto probado y abrirlo de nuevo sin borrar almacenamiento; comprobar datos y rutas de notas/calendario/perfil.                                                                                                 | Confirmación global (AND-07) | Pendiente             | Pendiente         |
| PWA-04 Persistencia               | Crear/editar offline, esperar guardado y cerrar/abrir; repetir tras reiniciar el teléfono sin red. Comprobar conservación de cambios y sesión disponible.                                                                                              | Parcial (AND-07)             | Pendiente             | Pendiente         |
| PWA-05 Reconexión                 | Restaurar red y comprobar los cambios desde otro cliente de la misma cuenta, sin pérdida ni duplicados.                                                                                                                                                | Parcial (AND-07)             | Pendiente             | Pendiente         |
| PWA-06 Actualización con borrador | En un entorno de prueba preparar versiones A/B, mantener un borrador sin guardar y otra ventana controlada abierta; publicar B, comprobar actualización y ausencia de recarga/pérdida. Guardar y cerrar todos los clientes; abrir B y comprobar datos. | Pendiente                    | Pendiente             | Pendiente         |
| PWA-07 Cambio de cuenta           | Tras guardar y sincronizar, cerrar A, entrar en B; datos A ausentes. Crear datos B, abrir offline y comprobar aislamiento; volver con red a A y verificar conservación sin datos B.                                                                    | Pendiente                    | Pendiente             | Pendiente         |
| PWA-08 Salida y caché             | Cerrar sesión, pasar offline e intentar abrir una ruta privada; mostrar acceso sin datos de la cuenta anterior.                                                                                                                                        | Pendiente                    | Pendiente             | Pendiente         |
| PWA-09 Suspensión                 | Poner en segundo plano y bloquear al menos una hora; reabrir, comprobar datos, sesión y sincronización. Anotar si el SO descartó el proceso.                                                                                                           | Superado (AND-09)            | Pendiente             | Pendiente         |

Para PWA-06 utilizar un origen HTTPS de prueba estable durante A → B y registrar ambos SHA. No cambiar el dominio entre versiones ni borrar datos del sitio. No desplegar una actualización ficticia sobre producción para ejecutar el caso. El borrador sin guardar debe conservarse mientras su ventana siga abierta; guardarlo antes del cierre definitivo. No exigir recuperar un formulario descartado voluntariamente sin guardar. Si no hay dos ventanas controladas disponibles en un contexto, documentar esa limitación y probar el editor abierto con una única ventana.

La sesión guardada puede requerir renovación con red; registrar el resultado real y duración offline sin prometer acceso indefinido. Reiniciar el teléfono no equivale a borrar datos ni reinstalar la PWA. La eliminación de almacenamiento por el navegador es un riesgo distinto y no está simulada por estas pruebas.

## Evidencia y cierre

Cada fila/plataforma requiere esperado, observado, estado, hora y archivo de evidencia; guardar capturas recortadas, versiones A/B y datos de dispositivo sin contraseñas, tokens ni enlaces de acceso. Para persistencia, observar antes y después del cierre; para sincronización, ambos clientes; para actualización, demostrar la versión activa y el borrador antes/después de detectar B.

Estados: pendiente, superado, fallido o no aplicable con motivo. La tarea estará cerrada al completar esta matriz en los contextos reales y resolver/repetir los fallos que impidan sus criterios. Los resultados automatizados sólo cierran la parte automatizada. Autenticación por correo y recepción de Web Push móvil en el dominio final conservan su tarea posterior específica.

Referencias internas: [PWA y Capacitor](../pwa-native.md), [validación de publicación](../release-validation.md) y [CI y producción: registro histórico](2026-10-12-ci-deployment.md).

## Chrome Android en el Redmi Note 11S · 15 de noviembre de 2026

PWA instalada desde Chrome `154.0.8037.126` (código `803712604`) en el Redmi Note 11S (2201117SY), Android 13. Origen `https://dayflow-by-shadowstudio.vercel.app`, despliegue de producción `5e5107ff8a6d121b3f6919832bd161c68946e37a`. Resultados confirmados por el usuario.

- **AND-06.** Instalación desde Chrome y apertura desde el icono en ventana independiente confirmadas.
- **AND-07.** Confirmación global del guion de arranque sin conexión, persistencia y reconexión. Quedaron sin detalle el recuento de operaciones pendientes, la reapertura tras reiniciar y la comprobación en el segundo cliente.
- **AND-09.** PASS de 20:35 a 21:35 CET. Tras 60 minutos en segundo plano, la PWA se reanudó y conservó los cambios. Estado del proceso y modo de ahorro sin determinar.
- **AND-08.** Pendiente de observar en el mismo origen la detección y activación de una nueva versión de producción y comprobar que se conservan la sesión, los datos y el borrador.
