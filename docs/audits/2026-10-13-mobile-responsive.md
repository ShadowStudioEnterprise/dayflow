# Ajustes responsive de móvil — 13 de octubre de 2026

Rama: `fix/mobile-responsive`. Cambios de interfaz antes de retomar la validación física de Android. No se cambió el almacenamiento ni se declara resuelta la incidencia anterior de notas.

## Cambios

- Diálogos limitados al área visible con `VisualViewport`, incluyendo altura y desplazamiento del teclado. Alternativa `vh` para WebView 97; no dependen de `dvh` para poder desplazarse. La altura de cabecera/padding se mide para colocar los elementos fijos sin superponerlos.
- Cabeceras de formulario accesibles al desplazarse; inputs de 16 px y controles principales de al menos 44 px en pantallas pequeñas.
- En notas, estado de guardado y acciones permanecen visibles al desplazar un documento largo. El cuerpo y la barra de herramientas se adaptan al ancho; los controles secundarios se distribuyen en varias filas cuando hace falta.
- Cabecera móvil sin desbordamiento: se reduce la información redundante de navegación y se trunca visualmente el resumen de Sync conservando su texto accesible.
- Menú lateral ajustado al ancho, botón de cierre explícito, fondo bloqueado al abrir, capas por encima de la navegación inferior y desbloqueo al pasar a escritorio.
- Títulos y botones de página se distribuyen en filas en anchos pequeños; textos largos de Configuración pueden partir línea. El enlace de salto sólo se muestra cuando recibe foco.

`dvh` llegó a Chromium en 108; WebView 97 requiere una alternativa. La reducción de `VisualViewport` por teclado se comprueba separadamente del resize del layout. [Chrome 108](https://developer.chrome.com/blog/new-in-chrome-108), [comportamiento del viewport](https://developer.chrome.com/blog/viewport-resize-behavior).

## Comprobaciones

- TypeScript y lint correctos.
- 39 E2E móviles correctos, cero reintentos: cinco pruebas nuevas de layout y recorridos de notas, tareas, calendario, recordatorios y perfil. Comando: `npx playwright test --project mobile-layout --project notes-mobile --project tasks-mobile --project calendar-mobile --project reminders-mobile --project profile-mobile --workers 4 --retries 0`.
- Después de ajustar las capas del menú y el teclado en tablet, cinco pruebas de layout repetidas correctamente y dos E2E de notas de escritorio correctos. Las pruebas finales de layout incluyen también Inbox, etiquetas y búsqueda.
- Layout: 320×568, 360×640, 390×844, 640×360 horizontal y 768×1024. Se espera el contenido real de cada página antes de medir desbordamiento, no sólo el skeleton de carga. Formularios de tarea/evento/recordatorio dentro de la pantalla; nota larga con estado de guardado visible al final del scroll; altura reducida a 300 px. Tablet simula además un `VisualViewport` de 280 px sin reducir el layout.
- El menú se abre/cierra, permite acceder a Configuración en pantalla pequeña y restaura el scroll al pasar a escritorio.
- Capturas revisadas de notas, menú y Configuración. Reportes/capturas completos locales en `.toolchains/mobile-responsive/`.

La comprobación inicial del nuevo test se detuvo al intentar pulsar el centro del scrim, cubierto por el menú; se añadió un botón de cierre visible. En otra iteración el estado de guardado no permanecía visible en tablet: se amplió el comportamiento fijo hasta 800 px. También se corrigió el import del helper E2E para TypeScript y la espera de contenido antes de capturar Configuración. Se conservan los límites de cada iteración; no se atribuyen todos los resultados anteriores al código final como una única suite repetida.

## Alcance y revisión física

Las pruebas usan Chromium con emulación móvil y fixtures de Auth/Sync; no certifican Safari ni teclado, safe areas o WebView 97 físicos. La actualización del APK y revisión visual en el Redmi siguen pendientes. El dominio publicado no se actualiza en esta tarea.

Para revisar en el Redmi: actualizar conservando datos, abrir menú y Configuración, crear/editar tarea/evento/recordatorio, abrir nota larga y teclado, comprobar cierre/guardar y modo horizontal. No dar por superados los ensayos físicos anteriores sobre un APK nuevo sin registrar la versión probada. [Registro Redmi](2026-10-12-redmi-9a.md).
