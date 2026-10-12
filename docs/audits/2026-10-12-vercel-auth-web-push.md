# Autenticación y Web Push en el dominio final de Vercel

Estado: **Auth superado; Web Push pendiente de prueba real en Vercel**.
Los resultados manuales de Auth se comunicaron el 12 de octubre; la evidencia
de Sites se conserva como histórico separado.

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
| Web Push            | Pendiente        | Prueba real solicitada: recordatorio sincronizado, recepción con Dayflow cerrado y Chrome ejecutándose, y clic que abre el recordatorio en Vercel              |

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
La tarea sigue abierta por Web Push. No se comunicaron por separado cuenta
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

Conservar separada la limitación histórica de Chrome detenido en Windows;
no se extiende este resultado a navegador detenido, suspensión u otras plataformas.
