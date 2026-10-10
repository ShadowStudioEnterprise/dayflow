# Notas — Fase 3

`/notes` requiere sesión. `/setup/notes` informa de la disponibilidad del módulo sin consultar datos personales. La creación rápida abre el mismo formulario y editor; no introduce otra ruta de persistencia.

## Edición y organización

TipTap 3 usa StarterKit y TaskList/TaskItem. Admite párrafos, títulos H1/H2/H3 mediante atajos Markdown (H2 también en la barra), negrita, cursiva, listas con viñetas/numeradas, checklist anidada, enlaces, citas y código. Deshacer/rehacer actúa sobre el contenido de la sesión de edición. Las casillas tienen etiquetas accesibles; el diálogo mantiene el foco y Escape guarda antes de cerrar. La selección visible se conserva al pulsar la barra en móvil.

Las notas tienen cinco colores, fijado, archivo y restauración. Las fijadas aparecen primero; dentro de cada grupo se ordenan por última edición. La búsqueda consulta título y texto derivado sin distinguir mayúsculas o acentos. El borrado requiere confirmación y genera un tombstone; no hay papelera ni purgado en esta fase.

## Persistencia y autoguardado

- `note-service.ts` reutiliza el repositorio de notas, valida metadatos con Zod y normaliza contenido antes de escribir.
- `note-document.ts` concentra extensiones y validación de JSON contra el esquema de ProseMirror. `plainTextContent` se deriva del documento, nunca del texto suministrado por otro cliente. No se renderiza HTML arbitrario mediante `dangerouslySetInnerHTML`.
- El documento admite hasta 1 MB de JSON en UTF-8 y 50 niveles de anidación. Superar un límite informa de error sin truncar. Las imágenes, archivos y tablas quedan para futuras extensiones y Storage.
- Los enlaces aceptan direcciones completas `https:`, `http:` o `mailto:`. La barra y el servicio rechazan protocolos ejecutables y URLs relativas. Al pegar, TipTap sólo conserva los nodos/marcas que admite su esquema. Los enlaces no navegan al pulsarlos dentro del editor.
- `NoteAutosave` espera 600 ms desde el último cambio. Sólo hay una escritura simultánea; los cambios ocurridos durante ella se guardan después con la nueva versión. El estado «Guardado en este dispositivo» aparece tras el commit de nota y operación de cola.
- Cada cambio del editor (y del título de una nota nueva) escribe una copia de emergencia síncrona en `localStorage`, independiente de IndexedDB y anterior al debounce. El formato está versionado y separado por cuenta y por instancia de editor para preservar borradores de distintas pestañas. No se guarda una copia de todas las notas: sólo los cambios pendientes. Se elimina la copia tras confirmar el commit o guardar como copia; un fallo conserva el borrador de emergencia.
- Al reabrir `/notes`, «Borradores sin guardar» permite recuperar título, documento con formato, color, fijado y archivo, incluso si la lista de IndexedDB no se puede cargar. La recuperación conserva la versión original y requiere guardar con Listo. Una versión distinta o una nota eliminada no se sobrescriben: se ofrece guardar como copia con UUID nuevo. Un borrador de una nota aún no creada también puede conservarse como copia. Los registros corruptos se ignoran sin bloquear la página.
- Cerrar, pulsar Listo o navegar dentro de la aplicación fuerza el guardado antes de continuar. Un error mantiene abierto el editor. Ocultar la pestaña intenta guardar; cerrar/recargar con cambios pendientes solicita el aviso nativo del navegador. La recuperación no depende de estos eventos de cierre: el último cambio ya tiene su copia de emergencia.
- Si `localStorage` también falla (cuota, permisos o almacenamiento bloqueado), se informa de que la reapertura no está protegida y el texto sigue en memoria para copiarlo o reintentar el guardado. La copia no garantiza supervivencia a borrado de datos del navegador, fin de una sesión privada o pérdida de alimentación antes de que el navegador escriba físicamente los datos. No se solicita almacenamiento persistente: protege frente a evicción, pero no sustituye la escritura síncrona ni resuelve un fallo de IndexedDB.
- Fijar desde el listado actualiza la vista optimistamente y revierte ante fallo. La comprobación de versión y escritura son atómicas, incluidas eliminación y fijado. Esto evita pérdida por formularios locales obsoletos; la resolución de conflictos remotos LWW llegará con el SyncEngine en fase 6.

Las notas siguen funcionando sin red después de cargar la aplicación y el módulo. Todavía no hay sincronización remota ni caché PWA para arranque offline en frío. Los datos permanecen en IndexedDB bajo el usuario autenticado; la cola pendiente se conserva al cerrar sesión. La tabla PostgreSQL `notes` y su RLS ya existen en la migración Foundation y no requieren cambios en esta entrega.

## Comprobaciones

Vitest cubre creación, texto derivado, persistencia, aislamiento, tombstones, validación de enlaces/documentos, transacciones con rollback, concurrencia, debounce, ediciones durante un guardado, recuperación de errores y rollback optimista del fijado. También comprueba recuperación antes del debounce, fallos de IndexedDB/localStorage, copias corruptas, aislamiento de cuentas/pestañas y limpieza sólo tras guardar. React Testing Library prueba creación con Enter y conservación del título ante errores.

Playwright verifica crear → editar → recargar, formato, colores, búsqueda, checklist, enlaces, fijar/archivar/restaurar/eliminar, pantalla de 320 px, tema oscuro, offline, cambio de usuario y dos pestañas con ediciones/borrados concurrentes. Comprueba también fallo de escritura en IndexedDB → último cambio → cierre sin `beforeunload` → nueva pestaña → recuperación → guardado → recarga. Usa Auth interceptado sólo en el proceso de pruebas y operaciones reales de IndexedDB. La emulación móvil Chromium no sustituye una prueba en Safari/iOS o Android nativos.
