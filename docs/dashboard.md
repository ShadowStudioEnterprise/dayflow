# Hoy — Fase 7

La ruta privada `/` reúne datos reales de tareas, eventos y recordatorios. `/setup` mantiene la página pública de preparación; no muestra datos personales ni ejemplos que simulen una cuenta. No se añaden dependencias, tablas ni migraciones.

## Datos y acciones

`createDashboardService` obtiene tareas, subtareas, eventos y recordatorios de los repositorios existentes, dentro de una transacción de lectura Dexie. La consulta se limita al propietario y excluye tombstones. `useDashboard` observa cambios locales, incluidos los que descarga SyncEngine; la proyección no escribe entidades ni crea operaciones de cola.

La captura rápida añade una tarea pendiente con vencimiento civil en el día actual de la zona elegida. Completar usa el mismo servicio y estado optimista que Tareas, con reversión ante error y generación de sucesora recurrente. Abrir una tarea, evento o recordatorio lleva a su editor existente. Las acciones guardan localmente y utilizan la cola de sincronización habitual.

## Qué entra en Hoy

- **Vencidas:** tareas pendientes o en progreso cuyo vencimiento ya pasó. Una fecha sin hora vence al terminar ese día; un instante vence cuando pasa su hora.
- **Para hoy:** las demás tareas activas con vencimiento hoy, inicio hoy o anterior, o estado en progreso. Las pendientes sin fecha ni inicio se consultan desde «Ver todas». Una tarea vencida nunca aparece dos veces. Se conserva el orden por vencimiento y prioridad del módulo Tareas.
- **Eventos de hoy:** ocurrencias que solapan el día en la zona de preferencias. Primero los de día completo y después los que tienen hora, por inicio. Se mantienen los eventos finalizados, identificados junto a los que están en curso o por empezar. El fin de un evento es exclusivo.
- **Próximos recordatorios:** desde ahora hasta la medianoche que cierra los próximos siete días civiles, incluido hoy. Sólo la próxima ocurrencia de cada recordatorio, ordenada cronológicamente; inicialmente se muestran cinco y se pueden desplegar los demás. Los avisos desactivados se identifican, sin ocultar su recordatorio. No se promete entrega de una notificación por el mero hecho de mostrar una fecha.

El resumen cuenta tareas por atender (incluidas vencidas), ocurrencias de eventos hoy y recordatorios distintos en esa ventana. No suma tareas completadas, canceladas ni borradas. Las series inválidas muestran una advertencia y no ocultan el resto de datos.

## Fechas, errores y actualización

Se reutilizan las utilidades de fechas, expansión RRULE y zonas horarias de Calendario y Recordatorios. No se inventan ocurrencias futuras de tareas recurrentes: sólo aparecen las que ya existen. El formato horario sigue las preferencias.

`useNow` actualiza fechas y etiquetas cada 30 segundos, al recuperar foco y al cambiar la visibilidad. Así se vuelve a calcular Hoy tras medianoche o al reanudar una pestaña; el temporizador no entrega alarmas. Cambiar la zona de preferencias recalcula la proyección.

La carga inicial, el fallo de almacenamiento con reintento y los estados vacíos son distintos. No se presentan ceros como si fueran datos confirmados mientras falla la lectura. El aviso offline explica que se utilizan los datos del dispositivo; el estado remoto sigue en la barra superior. El arranque offline en frío depende aún de la PWA de fase 9.

## Verificación

Pruebas de proyección: separación y orden de tareas, límites de día, zonas horarias, eventos solapados, tombstones, recordatorios pasados, siguientes recurrencias, DST, errores de series y lectura por cuenta sin escrituras. Componentes: carga/error/reintento/vacío, medianoche, foco y cambios de zona. Playwright: captura y finalización offline, persistencia, enlaces a los tres editores, cambio de cuenta, tema oscuro y 320 px. Véase [verificación global](verification.md).
