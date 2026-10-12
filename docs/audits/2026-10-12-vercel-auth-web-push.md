# Autenticación y Web Push en el dominio final de Vercel

Estado: **pendiente de prueba manual**. La evidencia de Sites del 4 de octubre
no cierra los criterios del dominio final.

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

Continuar con recuperación y Web Push en la cuenta existente. El usuario ha
acordado otra dirección para confirmación. La consulta administrativa de esa
segunda cuenta muestra creación el 12 de octubre de 2026 a las 01:59
Europe/Madrid y email confirmado. Falta el resultado manual que acredite correo
recibido, enlace abierto desde el mismo perfil y regreso al dominio final con
acceso. No se ha creado, confirmado ni eliminado ninguna cuenta mediante Admin
API durante esta revisión.

| Caso                | Estado en Vercel | Evidencia necesaria                                                                                                                                                |
| ------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Confirmación        | Pendiente        | Registro sin confirmación administrativa, correo recibido y enlace canjeado en el mismo perfil; regreso a Vercel con acceso                                        |
| Recuperación        | Pendiente        | Correo recibido, regreso a `/auth/update-password` en Vercel, cambio guardado e inicio de sesión con la nueva contraseña                                           |
| Contraseña anterior | Pendiente        | Intento de inicio de sesión nuevo tras el cambio rechazado con la contraseña anterior                                                                              |
| Web Push            | Pendiente        | Alta en Vercel, recordatorio sincronizado, recepción física con las pestañas de Dayflow cerradas y navegador ejecutándose; clic que abre el recordatorio en Vercel |

Para cada correo registrar solicitud/recepción, carpeta y resultado sin guardar
el contenido del enlace. Una cuenta que ya existía o una pantalla de correo
enviado no prueba confirmación nueva. Para Push registrar navegador/SO,
permiso, hora prevista/recibida y estado del navegador. La aceptación del
proveedor no sustituye recepción física.

Usar el procedimiento de [validación de publicación](../release-validation.md).
La tarea solo se cierra cuando los cuatro casos tengan evidencia superada en
este dominio. Conservar separada la limitación histórica de Chrome detenido en
Windows; esa condición no queda acreditada por una prueba con Chrome abierto.
