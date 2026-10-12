# Redmi 9A: pérdida de edición de nota tras reinicio offline

Fecha: 12 de octubre de 2026, Europe/Madrid. Rama: `investigation/redmi-note-offline-restart`.
Estado: **fallo físico reportado; investigación abierta**. No se ha identificado una causa ni se ha aplicado una corrección.

## Caso observado

APK corregido de compatibilidad, código `beeca6a54ccdda0048c84498713b2aafbfe57f30`, SHA-256 `0FF52D83F174B4163E9C26D7513AF2DA07C250AF76019918490239A1D7E4181B`, instalado manualmente según el usuario. Redmi 9A, Android 11/API 30, WebView 97.0.4692.98. La copia instalada no se ha verificado por ADB.

Procedimiento solicitado: crear y sincronizar «Nota Redmi reinicio», activar modo avión y desactivar Wi-Fi, añadir «Edición guardada sin red», esperar guardado, reiniciar y abrir Dayflow sin red.

El usuario informó: «Falta el contenido añadido al reiniciar sin conexion a internet». Se pidió recuperar la conexión sin editar de nuevo la nota; respondió «No reaparece; había visto el estado Guardado». La edición sigue ausente después de reconectar. No se dispone de captura del estado de guardado, registros de base de datos ni hora precisa. No inferir que falló también la recuperación de sesión o que desapareció toda la nota.

El resultado bloquea el cierre de la variante de edición offline de AND-06 y del arranque tras reinicio de AND-07. Los casos anteriores de creación offline, reapertura desde Recientes y reconexión correcta se conservan: cubren recorridos distintos.

## Investigación disponible

Revisión del recorrido: Tiptap `onUpdate` → `NoteAutosave.change` → respaldo síncrono en localStorage → debounce de 600 ms → `note-service.save` → transacción IndexedDB de nota + cola → estado «Guardado en este dispositivo» y retirada del respaldo. Al cerrar con Listo se espera `flush`; al ocultarse/unmount también se solicita guardado. La implementación revisada no acredita qué eventos ni escrituras ocurrieron en el teléfono.

Pruebas sobre el producto actual, sin cambios de código:

- `npm run test -- --pool=vmThreads --maxWorkers=1 src/features/notes/services/note-autosave.test.ts src/features/notes/services/note-service.test.ts`: **20/20 correctas**, 5,39 s.
- `npx playwright test --project notes-desktop --project notes-mobile --workers 2 --retries 0 --grep "offline|crea, edita formato|recupera"`: **10/10 correctos**, 43,4 s, cero reintentos. Cubren autoguardado/recarga, cierre offline y recuperación tras fallo de IndexedDB.

Estos tests no reinician un Android físico ni usan WebView 97. Su acierto no descarta el fallo reportado. ADB apareció transitoriamente autorizado tras el reinicio y volvió a offline; no se pudo abrir una sesión de inspección del WebView ni obtener evidencia de la nota. No se ha exportado almacenamiento de la cuenta ni se han borrado datos.

## Siguiente prueba discriminante

Ensayo de control sin reinicio: sin red, añadir «Control antes de reiniciar» a la misma nota, pulsar Listo y volver a abrirla. El usuario confirmó «Sí, aparece después de cerrar y volver a abrir la nota». La escritura y lectura locales de ese texto quedan comprobadas manualmente antes del reinicio. No acredita aún persistencia después de terminar el proceso ni demuestra la causa del fallo original.

Siguiente paso solicitado: cerrar de nuevo con Listo, no editar más, mantener modo avión/Wi-Fi apagado, reiniciar y comprobar ese mismo texto en la misma nota. **Pendiente de respuesta**. Separar este ensayo con editor cerrado del intento inicial y de «Edición guardada sin red», que no se recuperó.

Mantener este caso abierto hasta reproducir/localizar la causa, corregir si procede y repetir físicamente. No marcar recuperación de notas como superada sólo porque las suites de Chromium pasen. Registro principal: [Redmi 9A](2026-10-12-redmi-9a.md).
