# Autenticación y Web Push en el dominio final de Vercel

Estado: **superado; los cuatro criterios de cierre comprobados en Vercel**.
Auth y recepción/apertura del aviso están confirmados por el usuario el
12 de octubre. La evidencia de Sites se conserva como histórico separado.

- Fecha: 12 de octubre de 2026, Europe/Madrid.
- Origen probado: <https://dayflow-by-shadowstudio.vercel.app>.
- Rama: `fix/vercel-auth-web-push`, creada desde `dev`.
- Commit base: `39593d2dad4c54f6115a4d0f8696ed9247979cfc`.
- Sin publicación nueva ni cambios de configuración remota durante esta revisión.
- Cuenta de prueba acordada con el usuario; no se guardan contraseñas, tokens,
  enlaces de correo, sesiones ni datos del buzón en este registro.

## Comprobaciones reproducibles

Ejecutar `npm run test:vercel`. La configuración utiliza exclusivamente el
origen final, sin servidor local, interceptaciones ni backend simulado. No envía
correos, crea cuentas, cambia contraseñas ni solicita permisos de notificaciones.
Los tres casos pasaron sin reintentos en 14,5 segundos:

1. Raíz, perfil y las cuatro rutas de Auth devuelven HTML con HTTP 200 en el
   mismo origen. `/sw.js` y `/push-worker.js` devuelven JavaScript y caché con
   revalidación; el worker principal importa el de Push y tiene alcance `/`.
2. Registro, recuperación y cambio de contraseña muestran sus formularios;
   Supabase está configurado y `/profile` redirige a acceso sin sesión.
3. El worker publicado se activa con alcance del dominio final. La interfaz
   confirma preparación sin conexión y termina la comprobación de actualizaciones.

Los dos recorridos de navegador terminaron sin errores JavaScript. Se utilizó
Chromium de Playwright con un contexto nuevo por caso; no acredita recepción
física de avisos ni el perfil habitual del usuario.

La lectura del perfil declarado `deployment/supabase/config.toml` confirma Site
URL y destinos de confirmación y recuperación en Vercel. No sustituye una lectura
de la configuración remota ni el canje de un enlace de correo real.

Huellas SHA-256 del contenido HTTP leído a las 01:52:01 Europe/Madrid (HTTP 200):

| Recurso           | SHA-256                                                            |
| ----------------- | ------------------------------------------------------------------ |
| `/`               | `c2b514b4c21dd797d1b157b1c3457aa78dcd79f39d75539d64b7c8e192341410` |
| `/sw.js`          | `8965cf52e0111990d513aa1048cfa7f9b9bbe03e4b7076934795860620b0951a` |
| `/push-worker.js` | `f575771978235d075cb62037a321028a271cbe567cd1dc0546db786beea83818` |

Estas huellas identifican los recursos observados; no se ha atribuido el build
publicado al commit local de la rama.

## Criterios de cierre

### Resultado del intento de registro

El usuario comunica que no apareció un aviso de cuenta existente y no recibió
el correo de confirmación. Una lectura administrativa de Supabase, limitada a
la cuenta acordada, confirma que ya estaba creada y confirmada el 4 de octubre
de 2026 (12:11 Europe/Madrid). No se cambió ni eliminó la cuenta. Este intento
con una cuenta existente no acredita una nueva confirmación ni demuestra un
fallo del transporte de correo.

Supabase documenta que un registro de una cuenta confirmada puede devolver un
usuario ofuscado sin error según la configuración de confirmaciones:
[referencia de signUp](https://supabase.com/docs/reference/javascript/auth-signup).
Dayflow mostraba «Revisa tu correo para confirmar tu cuenta» ante cualquier
respuesta sin sesión, lo que inducía a esperar un correo también en ese caso.
La rama cambia el texto por un mensaje condicional y ofrece acceso a recuperación
desde el registro. Esta corrección todavía no está publicada en Vercel.

Se propuso recuperación y Web Push en la cuenta existente. El usuario ha
acordado otra dirección para confirmación. La consulta administrativa de esa
segunda cuenta muestra creación el 12 de octubre de 2026 a las 01:59
Europe/Madrid y email confirmado. El usuario confirma después que recibió el
correo, abrió el enlace y regresó a Vercel con acceso. Con este resultado manual
y el estado remoto, la confirmación queda superada en el dominio final. No se
comunicaron por separado hora de recepción, carpeta ni perfil del navegador.
No se ha creado, confirmado ni eliminado ninguna cuenta mediante Admin API
durante esta revisión.

| Caso                | Estado en Vercel | Evidencia registrada                                                                                                                                           |
| ------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Confirmación        | Superado         | Usuario confirma recepción del correo, apertura del enlace y regreso a Vercel con acceso; nueva cuenta confirmada en Supabase, sin confirmación administrativa |
| Recuperación        | Superado         | Resultado manual confirmado por el usuario tras solicitar cambio de contraseña e inicio de sesión con la nueva en Vercel                                       |
| Contraseña anterior | Superado         | Usuario confirma la comprobación solicitada de rechazo de la contraseña anterior después del cambio                                                            |
| Web Push            | Superado         | Usuario confirma recepción del aviso de las 02:16 y apertura del recordatorio en Vercel; Supabase registra aceptación del proveedor en un intento              |

Para cada correo registrar solicitud/recepción, carpeta y resultado sin guardar
el contenido del enlace. Una cuenta que ya existía o una pantalla de correo
enviado no prueba confirmación nueva. Para Push registrar navegador/SO,
permiso, hora prevista/recibida y estado del navegador. La aceptación del
proveedor no sustituye recepción física.

Usar el procedimiento de [validación de publicación](../release-validation.md).
La respuesta «Comprobados» se interpretó inicialmente como cierre también de
Web Push. Tras la aclaración del usuario («Quedaba el web push?» y «probemos el
aviso»), se corrige esa interpretación: solo acredita las comprobaciones de
Auth. No hay todavía confirmación de recepción/apertura de un aviso en Vercel.
En ese momento la tarea seguía abierta por Web Push, hasta la repetición de
las 02:16 documentada debajo. No se comunicaron por separado cuenta
usada en recuperación, horas ni carpeta de correo. Es evidencia manual
comunicada, no observación automatizada de esos recorridos.

## Prueba de aviso en curso

Se indicó activar avisos web en el navegador habitual del dominio final, crear
«Prueba Push Vercel» sin repetición para tres minutos después, esperar a cero
operaciones pendientes y cerrar las pestañas de Dayflow dejando Chrome abierto
y el equipo despierto. Registrar cuenta, hora programada/recibida y resultado
del clic. No hay navegador conectado a las herramientas de control en esta
sesión; preparación y recepción requieren la comprobación manual del usuario.

### Intento de las 02:09 Europe/Madrid

El usuario comunica que no hubo aviso y precisa la hora programada: 02:09 del
12 de octubre. La consulta remota de solo lectura a las 02:12 confirma:

- La cuenta de prueba existe y tiene **cero suscripciones Web Push** al consultar.
- «Prueba Push Vercel» llegó al servidor: creado a las 02:07:01, vencimiento
  02:09:00, avisos activados, sin repetición y sin borrar. Su última modificación
  es de las 02:11:47, posterior al vencimiento.
- No hay registros de intentos de entrega para esa cuenta en las últimas dos horas.
- Las ejecuciones de Cron de las 02:10, 02:11 y 02:12 figuran `succeeded`.
  Esto acredita ejecución del trabajo, no aceptación del proveedor ni recepción.

Resultado del intento: **fallido, sin aviso recibido**. La precondición de
suscripción activa no está satisfecha al inspeccionar. No se atribuye el fallo
a Chrome detenido ni a un rechazo del proveedor; no se comunicó aún el estado
local del navegador o el permiso. Se solicita activar avisos en Vercel y obtener
el texto exacto del estado o error antes de programar un nuevo aviso futuro.
Web Push permanece pendiente de repetición y recepción real.

### Activación posterior

El usuario indica que el permiso del navegador figura «Permitido». La consulta
remota de las 02:13:11 confirma ahora **una suscripción** para la cuenta,
creada/actualizada a las 02:12:43, después del vencimiento del primer aviso.
Permiso y alta de suscripción son comprobaciones distintas. Se solicita
reprogramar «Prueba Push Vercel» a tres minutos vista, esperar sincronización y
cerrar las pestañas de Dayflow manteniendo Chrome abierto y el equipo despierto.
Alta superada; entrega y apertura del aviso todavía pendientes.

### Repetición de las 02:16: superada

El usuario reprograma el aviso para las 02:16 del 12 de octubre, Europe/Madrid.
La lectura de las 02:14:05 confirma ese vencimiento, avisos activados, recordatorio
sin borrar, última actualización a las 02:13:48 y una suscripción registrada.
Se indicó cerrar las pestañas de Dayflow conservando Chrome ejecutándose.

Tras el vencimiento el usuario confirma expresamente: **«Llegó y abrió el
recordatorio en Vercel»**. La consulta remota de las 02:16:24 muestra:

- Ocurrencia: 02:16:00.
- Intento: 02:16:00.540058, un único intento.
- Aceptación del proveedor: 02:16:00.642.

La diferencia de 642 ms mide aceptación del proveedor, no llegada a pantalla.
Recepción y apertura se acreditan por la confirmación manual del usuario; no
se comunicó una hora exacta de recepción ni se inspeccionó el estado de ventanas
o procesos del equipo durante esta repetición. El aviso y el retorno al dominio
final quedan superados. Con Auth ya comprobado, se cumplen los cuatro criterios
de cierre de la tarea.

Conservar separada la limitación histórica de Chrome detenido en Windows;
no se extiende este resultado a navegador detenido, suspensión u otras plataformas.

## Comprobación de permisos al activar avisos

Tras la prueba real, el usuario solicita comprobar los permisos de notificaciones
al activar avisos web. La rama consulta el permiso antes de suscribir:

- Pendiente: solicita permiso desde el clic; cancelación o rechazo impiden el alta.
- Concedido: registra el navegador sin repetir la solicitud de permiso.
- Bloqueado: indica cómo permitir notificaciones en los ajustes del sitio y no
  intenta registrar una suscripción.

Configuración muestra permiso y estado de suscripción por separado, y explica
que permiso concedido aún requiere activar avisos para la cuenta. Reconsulta al
volver a la ventana, después de activar/desactivar y cuando el worker queda listo.
Este último paso corrige un estado de comprobación atascado observado en la
primera ejecución de la prueba móvil, antes de la preparación del worker.

Validación de la corrección: 10 pruebas del servicio y 4 E2E PWA de Web Push
(escritorio y vista móvil) superados; TypeScript, lint y documentación correctos.
Las pruebas PWA usan el worker real con suscripción/HTTP simulados; la recepción
física ya documentada corresponde al despliegue anterior a esta corrección.
Los cambios de interfaz y permisos permanecen en la rama, sin publicar.
