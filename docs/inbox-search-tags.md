# Inbox, búsqueda y etiquetas — Fase 8

## Inbox

`/inbox` captura texto de hasta 300 caracteres con Enter. Permite buscar, editar, eliminar con confirmación y convertir cada captura a tarea, nota, evento o recordatorio. La creación rápida incluye un acceso a Inbox. Las ediciones se validan por versión; un cambio concurrente no sobrescribe un borrador abierto.

La conversión mantiene el título; una nota también lo conserva como párrafo de texto, sin interpretar HTML. Las tareas nacen pendientes y sin vencimiento. Eventos y recordatorios piden fecha/hora y usan la zona de preferencias. Los eventos admiten día completo, con último día incluido en el formulario y final exclusivo en persistencia. Las utilidades existentes rechazan horas ambiguas o inexistentes por DST. Los detalles y recurrencias pueden completarse después en el editor correspondiente.

Destino, tombstone de Inbox y operaciones de cola se guardan en **una transacción IndexedDB**. Cualquier fallo revierte todo. Un UUID determinista derivado de la captura identifica el destino: repetir la conversión al mismo tipo devuelve el elemento ya creado, sin sobrescribirlo. Un destino eliminado no se resucita por reintentar. En la misma instalación, la transacción impide convertir simultáneamente a dos tipos distintos.

La sincronización remota continúa siendo por entidad, como en fase 6. No se promete una transacción SQL conjunta entre Inbox y destino. Dos instalaciones offline que eligen el mismo tipo convergen al mismo ID; si eligen **tipos diferentes**, se conservan ambos documentos para no descartar ninguna decisión. La regla LWW y las copias de conflictos existentes resuelven contenido concurrente dentro del mismo tipo. Los cambios pendientes y errores permanecen visibles en Configuración.

Los recordatorios creados por conversión utilizan la normalización del módulo de recordatorios. El runtime nativo observa la incorporación y programa según permisos; la conversión local no confirma entrega de alarmas. Web mantiene sus límites de fase 5.

## Etiquetas

`/tags` gestiona nombres y colores compartidos entre notas, tareas y eventos. Se asignan desde los editores de documentos ya guardados; la selección se guarda inmediatamente, separada del formulario del documento. «Ver elementos» abre búsqueda con la etiqueta seleccionada. Las notas archivadas requieren activar su filtro.

El servicio valida propietario de ambos extremos, versión al editar/borrar y nombres únicos sin distinguir mayúsculas en la instalación. Cada relación usa un ID determinista; quitar y volver a asignar restaura el mismo registro con una revisión posterior. También se respetan relaciones antiguas que ya existieran con otro ID.

Eliminar una etiqueta marca como borradas sus asociaciones locales en la misma transacción; no elimina documentos. Etiquetas borradas y asociaciones eliminadas no participan en búsquedas. Una asignación concurrente desde otra instalación a una etiqueta ya borrada queda oculta por esta regla. Crear o renombrar offline etiquetas diferentes con el mismo nombre puede chocar con el índice único SQL: se conserva la operación rechazada y se revisa desde Configuración; no se fusionan etiquetas automáticamente.

Se añade `repository.restore` para recuperar explícitamente asociaciones eliminadas, comprobando propietario y conservando auditoría. La operación restaura sin duplicar la fila, incrementa versión y fecha, y genera una operación de sincronización.

## Búsqueda

La navegación principal y Ctrl/Cmd+K fuera de campos de edición abren la búsqueda en un diálogo. `/search` ofrece la misma búsqueda como página; el parámetro `tag` preselecciona una etiqueta. La vista pública pide iniciar sesión y nunca consulta documentos privados.

Se buscan notas, tareas, eventos, recordatorios e Inbox. Títulos, contenido plano de notas, descripciones, lugar y nombres de etiquetas participan en la coincidencia. Se ignoran mayúsculas y acentos; todas las palabras deben estar presentes, sin exigir su orden. Las coincidencias exactas de título preceden a prefijos y contenido; el desempate usa actualización e ID estable.

Los resultados se agrupan por tipo. Se puede filtrar por tipo y etiqueta, incluir notas archivadas y abrir el editor original. Las tareas completadas/canceladas siguen localizables con su estado visible. Los borrados lógicos se excluyen siempre. Se muestran 20 resultados por grupo, ampliables; el contador refleja el total. Flecha abajo desde el campo lleva al primer resultado; arriba/abajo recorre enlaces, Enter abre y Escape cierra el diálogo.

`createSearchService` obtiene una instantánea por cuenta de Dexie; `searchRecords` es una proyección pura y no genera escrituras. `useLiveQuery` actualiza los resultados cuando cambian documentos, etiquetas o asociaciones, incluidos cambios sincronizados. Se distinguen carga, error con reintento, consulta vacía y ausencia de coincidencias. Los textos se renderizan como texto de React, nunca como HTML.

Este MVP recorre los documentos locales en memoria. No es un índice full-text ni garantiza encontrar documentos aún no descargados. La frontera de servicio permite sustituir el recorrido por un índice local/remoto más adelante. No se añaden dependencias, tablas ni migraciones en esta fase.

## Verificación

Pruebas de transacciones, rollback, versiones obsoletas, aislamiento, reintentos y conversiones concurrentes; relaciones estables, restauración y eliminación de etiquetas; búsquedas por contenido, acentos, etiquetas, archivo y orden. Una integración SQL comprueba la conversión repetida desde dos bases y la eliminación/restauración de una asociación mediante el protocolo real en PGlite. Playwright cubre los cuatro destinos, offline, editores, teclado, móvil, etiquetas compartidas y cambio de cuenta. Los resultados globales están en [verificación](verification.md).
