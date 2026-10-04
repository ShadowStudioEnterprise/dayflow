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
- Cerrar, pulsar Listo o navegar dentro de la aplicación fuerza el guardado antes de continuar. Un error mantiene abierto el editor. Ocultar la pestaña intenta guardar; cerrar/recargar con cambios pendientes solicita el aviso nativo del navegador. Ese aviso y el guardado durante el cierre no están garantizados por todos los navegadores: antes de salir, espera al estado guardado. No se promete protección frente a cierre forzado del proceso o pérdida de alimentación durante el debounce.
- Un fallo conserva el borrador en memoria y ofrece reintento. Una versión distinta o una nota eliminada en otra pestaña no se sobrescriben: se ofrece guardar como copia con UUID nuevo. Un borrado externo no desmonta un editor abierto. Los errores persistentes de almacenamiento requieren mantener el editor abierto o copiar manualmente el texto hasta recuperar espacio/acceso.
- Fijar desde el listado actualiza la vista optimistamente y revierte ante fallo. La comprobación de versión y escritura son atómicas, incluidas eliminación y fijado. Esto evita pérdida por formularios locales obsoletos; la resolución de conflictos remotos LWW llegará con el SyncEngine en fase 6.

Las notas siguen funcionando sin red después de cargar la aplicación y el módulo. Todavía no hay sincronización remota ni caché PWA para arranque offline en frío. Los datos permanecen en IndexedDB bajo el usuario autenticado; la cola pendiente se conserva al cerrar sesión. La tabla PostgreSQL `notes` y su RLS ya existen en la migración Foundation y no requieren cambios en esta entrega.

## Comprobaciones

Vitest cubre creación, texto derivado, persistencia, aislamiento, tombstones, validación de enlaces/documentos, transacciones con rollback, concurrencia, debounce, ediciones durante un guardado, recuperación de errores y rollback optimista del fijado. React Testing Library prueba creación con Enter y conservación del título ante errores.

Playwright verifica crear → editar → recargar, formato, colores, búsqueda, checklist, enlaces, fijar/archivar/restaurar/eliminar, pantalla de 320 px, tema oscuro, offline, cambio de usuario y dos pestañas con ediciones/borrados concurrentes. Usa Auth interceptado sólo en el proceso de pruebas y operaciones reales de IndexedDB. La emulación móvil Chromium no sustituye una prueba en Safari/iOS o Android nativos.
