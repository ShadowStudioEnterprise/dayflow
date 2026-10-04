# Relaciones entre notas, tareas y eventos

Los editores de elementos guardados incluyen **Elementos relacionados**. Pulsa **Vincular un elemento**, busca por título o filtra por tipo y selecciona una nota, tarea o evento. La relación aparece en ambos extremos y permite abrir el otro editor. También se pueden vincular notas archivadas, que se identifican como tales.

Las relaciones se guardan inmediatamente, independientemente del botón de guardar del formulario. Funcionan sin conexión una vez cargada la aplicación y restaurada la sesión. **Desvincular** retira la relación y conserva los dos elementos. Si el destino se elimina, aparece como no disponible y se puede desvincular sin abrirlo.

Al seguir un vínculo, tareas y eventos con cambios pendientes piden guardar o descartar antes de salir; las notas mantienen su flujo de autoguardado. Cancelar el descarte permite seguir editando el borrador.

Se reutilizan la entidad `links`, los repositorios y la cola de sincronización existentes, sin nuevas tablas, dependencias ni migraciones. El servicio valida la disponibilidad y el propietario de ambos extremos, rechaza autorrelaciones y guarda la relación y su operación pendiente en una misma transacción. Un ID determinista independiente de la dirección evita duplicados nuevos entre dispositivos; desvincular también retira duplicados antiguos de ambas direcciones.

Las pruebas de servicio cubren bidireccionalidad, restauración, IDs entre bases independientes, aislamiento, destinos eliminados y rollback si falla la cola. Las pruebas de navegador recorren los tres editores, persistencia, búsqueda y filtros, protección de borradores, autoguardado, desvinculación offline y anchura de 320 px. Usan Auth interceptado y almacenamiento local real. Además, el 3 de octubre se verificó contra Supabase alojado una relación nota–tarea recibida en otro navegador y su retirada offline propagada al reconectar. Consulta [la evaluación web](web-evaluation.md).
