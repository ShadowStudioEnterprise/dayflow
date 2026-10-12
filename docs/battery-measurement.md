# Medición de batería en dispositivos físicos

Estado del 12 de octubre de 2026: **pendiente de mediciones físicas**. La rama `test/physical-device-battery` parte de `dev` en `0b015e8b03775c9b8e99f5d56b2f1f1c6d93d84e`. La consulta `adb devices -l` no encontró dispositivos conectados. No se ha registrado consumo ni se ha demostrado un impacto de Dayflow.

## Criterio de cierre

La tarea se cierra cuando hay rondas válidas con y sin Dayflow en los dispositivos físicos acordados, consumo registrado y una comparación respaldada por evidencia. Debe constar el alcance: modelo, SO y aplicación nativa o PWA; un resultado Android no certifica iOS ni PWA.

Por cada dispositivo y modalidad, completa al menos una pareja de rondas de ocho horas o más, con un periodo de pantalla apagada en ambas. Repite preferiblemente tres parejas y alterna el orden (sin/con, con/sin, sin/con) para reducir el efecto del día y del orden. Una sola pareja acredita la medición solicitada, pero no permite concluir un impacto estable.

Para cerrar deben estar completos:

- La ficha del dispositivo y del build medido.
- Las condiciones y el guion reproducible, iguales dentro de cada pareja salvo la presencia y el uso definido de Dayflow.
- El registro inicial/final, duración, pantalla, actividad, avisos y consumo atribuido por el sistema, con evidencia de cada ronda.
- La comparación calculada y las incidencias, incluidas las rondas invalidadas.
- La conclusión y el enlace al registro fechado desde [verificación](verification.md) y [validación de publicación](release-validation.md).

No se ha fijado un umbral de consumo aceptable. El cierre de esta tarea acredita que se ha medido; no equivale a aprobar la eficiencia energética. Un consumo elevado se registra y da lugar a una tarea de investigación. Si no hay hardware, la tarea sigue pendiente.

## Preparación y comparabilidad

1. Usa un dispositivo de pruebas. Para la referencia nativa, Dayflow debe estar ausente; prepara esta condición sólo en un dispositivo sin datos de Dayflow que deban conservarse. No desinstales una aplicación personal para obtener la referencia. Cerrar sesión o forzar la detención no equivale a ausencia: descríbelo como otra condición si se ensaya.
2. Para PWA, usa un perfil de navegador de pruebas sin instalación, suscripción push, pestañas ni service worker de Dayflow en la referencia. Conserva el mismo navegador y versión en ambas rondas. El porcentaje de consumo del navegador incluye otros sitios; no lo atribuyas íntegramente a Dayflow.
3. Usa un build fijo conectado al backend alojado, sin servidor de desarrollo ni túneles USB. Registra SHA del código y hash del APK o identificador del despliegue. Después de instalar, iniciar sesión y sincronizar, espera a que finalice la actividad inicial antes de empezar. No cambies build, SO ni conjunto de datos durante una pareja.
4. Mantén el mismo nivel inicial (tolerancia propuesta: dos puntos porcentuales), brillo fijo, red, señal aproximada, ahorro de batería, permisos, temperatura ambiente y franja horaria. Anota modelo, antigüedad y salud de la batería si están disponibles. Evita actualizaciones, copias de seguridad y otras tareas extraordinarias durante las rondas.
5. Recarga entre rondas y deja enfriar el dispositivo. Desconecta cargador y USB antes del inicio. No uses una batería externa ni simules un estado de batería. No mantengas una conexión de depuración durante la ventana medida.
6. Fija por escrito la duración y el guion antes de empezar. Dentro de una pareja usa la misma duración (tolerancia propuesta: cinco minutos) y el mismo tiempo total de pantalla (tolerancia propuesta: cinco minutos). Si la resolución del indicador no permite apreciar una caída, amplía ambas rondas por igual.

Las tolerancias son reglas de este protocolo, no límites del sistema operativo. Cualquier desviación se conserva en el registro y exige repetir la pareja antes de usarla para el cierre.

## Guion de referencia

Ejemplo de ronda de ocho horas para medir reposo y uso breve. Puede adaptarse antes de la primera pareja; después debe mantenerse fijo:

| Intervalo                      | Sin Dayflow                                       | Con Dayflow                                                                 |
| ------------------------------ | ------------------------------------------------- | --------------------------------------------------------------------------- |
| Inicio, 10 minutos de pantalla | Actividad neutra predefinida en el dispositivo    | Abrir Hoy, revisar 10 tareas y editar una nota de prueba; sincronizar       |
| Horas restantes                | Pantalla apagada, mismo uso de otras aplicaciones | Dayflow en segundo plano, pantalla apagada, mismo uso de otras aplicaciones |
| Horas 2, 4 y 6                 | Sin avisos de Dayflow; mantener pantalla apagada  | Tres recordatorios preprogramados; no interactuar con ellos                 |
| Final, 10 minutos de pantalla  | Misma actividad neutra                            | Revisar tareas y sincronizar                                                |

La diferencia incluye el uso activo y los avisos de Dayflow definidos en el guion. No mide exclusivamente reposo. Si se necesita separar ambos efectos, realiza otra pareja con cero uso activo y cero avisos, tras dejar Dayflow preparada y en segundo plano antes del inicio. No mezcles los dos escenarios al resumir.

## Captura en Android e iOS

Registra manualmente el porcentaje inicial y final y sus horas con zona/offset. Conserva capturas de los indicadores y de la vista de batería del sistema. En Android registra el consumo atribuido al paquete probado; en iOS, a Dayflow o al navegador para PWA. Copia exactamente la unidad y la ventana temporal mostradas, así como el tiempo de actividad si aparece.

Comprueba que la ventana del informe cubre la ronda y no mezcla consumo de una ronda anterior. Si el sistema no ofrece consumo de la aplicación para ese intervalo, indica **no disponible** y el motivo; el descenso total sigue siendo medible, pero no hay atribución individual fiable. No sustituyas el dato por cero. No interpretes el porcentaje atribuido a una aplicación como puntos de batería del dispositivo, ni lo conviertas a mAh sin una medida en esa unidad.

Las capturas no deben exponer nombres de recordatorios, cuentas ni notificaciones personales. Usa datos de pruebas y recorta la evidencia a los indicadores necesarios. Guarda los originales de forma privada; publica sólo la evidencia revisada.

## Plantilla de registro

Copia esta ficha para cada dispositivo y escenario. Los campos vacíos son pendientes, no resultados.

| Campo                                                                | Valor     |
| -------------------------------------------------------------------- | --------- |
| ID de campaña / responsable                                          | Pendiente |
| Dispositivo físico / modelo / SO y versión                           | Pendiente |
| Estado, antigüedad y salud de batería                                | Pendiente |
| Modalidad / paquete o navegador y versión / WebView si aplica        | Pendiente |
| Versión de Dayflow / SHA / hash APK o despliegue                     | Pendiente |
| Backend / datos de prueba / sincronización inicial terminada         | Pendiente |
| Escenario y guion acordado / duración / pantalla apagada prevista    | Pendiente |
| Nivel inicial objetivo / brillo / red y señal / ahorro / temperatura | Pendiente |
| Permisos y avisos programados / estado de app y navegador            | Pendiente |

Una fila por ronda. Horas en ISO 8601 con offset; zona de referencia `Europe/Madrid`. El identificador de pareja agrupa exclusivamente el mismo dispositivo, modalidad y escenario.

| Pareja / ronda / condición (sin o con) | Inicio / fin | Batería inicial / final (%) | Duración (h) | Pantalla total / apagada / Dayflow activo (min) | Avisos previstos / recibidos | Carga o USB durante ronda | Consumo atribuido / unidad / ventana del sistema | Evidencia inicial / final / consumo | Incidencias / válida o invalidada |
| -------------------------------------- | ------------ | --------------------------- | ------------ | ----------------------------------------------- | ---------------------------- | ------------------------- | ------------------------------------------------ | ----------------------------------- | --------------------------------- |
| Pendiente                              |              |                             |              |                                                 |                              |                           |                                                  |                                     |                                   |

Para referencia sin Dayflow nativa, el uso activo y los avisos de Dayflow son cero y el consumo atribuido es **no aplicable: aplicación ausente**. En PWA, registra también el navegador de referencia.

Invalida una ronda si hubo carga/USB, cambio de configuración, reinicio, actividad extraordinaria, incumplimiento del guion o evidencia insuficiente de niveles y horarios. Conserva el registro y el motivo, y repite la pareja. Una ronda de emulador no cuenta como evidencia física.

## Cálculo y conclusión

Para cada ronda válida:

- `descenso_pp = batería_inicial − batería_final` (puntos porcentuales).
- `duración_h = (fin − inicio) / 3600000`, usando las marcas temporales en milisegundos.
- `tasa_pp_h = descenso_pp / duración_h`.

Por pareja, calcula `incremento_pp_h = tasa_con − tasa_sin`. Un valor positivo indica mayor descenso durante la ronda con Dayflow; uno negativo puede reflejar variabilidad. Si existen varias parejas comparables, presenta cada diferencia y su mediana y rango. No combines dispositivos ni modalidades.

Ejemplo **ficticio**, sólo para explicar el cálculo: sin Dayflow, 80 → 72 % en 8 h = 1 pp/h; con Dayflow, 80 → 70 % en 8 h = 1,25 pp/h; diferencia = 0,25 pp/h. Estos números no constituyen evidencia del producto.

El informe fechado debe incluir esta tabla por escenario:

| Dispositivo / modalidad | Parejas válidas / invalidadas | Tasas sin / con (pp/h) | Diferencias por pareja (pp/h) | Mediana / rango | Consumo atribuido por el sistema | Conclusión / límites / evidencia |
| ----------------------- | ----------------------------- | ---------------------- | ----------------------------- | --------------- | -------------------------------- | -------------------------------- |
| Pendiente               | 0 / 0                         | No medido              | No medido                     | No medido       | No medido                        | Pendiente de hardware            |

No extrapoles autonomía completa desde una ronda corta ni presentes la diferencia como consumo exclusivo de Dayflow: incluye variaciones del dispositivo y el escenario ensayado. Registra el estado de la tarea como **superado** únicamente cuando se haya cumplido el criterio de medición; documenta por separado cualquier incidencia de consumo.
