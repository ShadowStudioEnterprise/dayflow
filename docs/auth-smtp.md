# SMTP para ampliar la beta

Estado del 12 de octubre de 2026: **preparación disponible; activación y entrega externa pendientes**. El propietario confirmó que aún no tiene proveedor ni credenciales SMTP. La validación previa de Auth en Vercel no acredita envío a destinatarios ajenos al equipo. No abrir el registro externo hasta completar la prueba de esta guía.

Supabase Auth envía confirmación y recuperación. Su correo predeterminado restringe destinatarios al equipo del proyecto. Configurar SMTP propio significa conectar un proveedor de correo transaccional a Supabase; no requiere crear un servidor de correo en Dayflow ni cambiar sus llamadas de Auth.

## Obtener el servicio y el remitente

1. Elegir un proveedor con SMTP que permita enviar a destinatarios externos. Supabase enumera, entre otros, Resend, Brevo, Postmark y Amazon SES. Revisar su cuota y comprobar que la cuenta no está limitada a un sandbox o a destinatarios verificados.
2. Usar un dominio o subdominio propio para el remitente, por ejemplo `auth.tudominio.com`. Las direcciones de alojamiento de Vercel y Sites no conceden control DNS para autenticar correo. Hace falta un dominio administrable y acceso a su DNS.
3. Publicar los registros SPF y DKIM indicados por el proveedor y configurar DMARC. Esperar a que el proveedor confirme el dominio; evitar duplicar registros SPF. Elegir una dirección de remitente autorizada y nombre **Dayflow**.
4. Obtener host, puerto TLS, usuario y contraseña SMTP. Para proveedores que conservan los enlaces originales, se puede mantener el flujo por enlace. Brevo confirmó que en esta cuenta SMTP no puede desactivar la reescritura de enlaces. Para Dayflow con Brevo, usar las plantillas con código y sin enlaces.

## Cambiar a códigos con Brevo

Publicar primero una versión de Dayflow con el formulario de código. Comprobar que está disponible en la web y que las instalaciones PWA y Android que usen el mismo proyecto se han actualizado o pueden seguir el flujo en la web. Las versiones antiguas no tienen un campo para el código. Durante la transición, la interfaz nueva acepta códigos y conserva el retorno de enlaces anteriores. Para revertir, restaurar primero las plantillas por enlace y usar un proveedor que preserve las URLs.

En **Authentication → Emails → Templates**, copiar el HTML de [Confirm sign up](../deployment/supabase/templates/confirmation.html) y [Reset password](../deployment/supabase/templates/recovery.html) al mensaje correspondiente. Mantener la confirmación obligatoria y comprobar que la longitud del código sea de seis cifras, como en el entorno local. No incluir `ConfirmationURL` ni `TokenHash` en los mensajes de Brevo. Mantener el código fuera de URLs, registros y evidencias.

El alta termina al introducir el código y abrir Dayflow. La recuperación pide la nueva contraseña en la misma pantalla que verificó el código. Si se recarga o se abandona esa pantalla antes de guardar, hay que solicitar otro código. La sesión que permite guardar la contraseña se conserva solo en memoria y queda separada del acceso habitual a Dayflow. Los códigos requieren conexión a Supabase.

## Configurar Supabase

Destino actual: proyecto `spfrfvpexfnnhwpfinrq`, web `https://dayflow-by-shadowstudio.vercel.app/`. El dominio remitente puede ser distinto del de la web.

Puede configurarse desde **Authentication → Email / SMTP Settings** en el dashboard: activar Custom SMTP y rellenar remitente, host, puerto, usuario y contraseña. Mantener confirmación por email activa. Revisar la cuota de envío de Auth y la del proveedor conjuntamente.

Para aplicar la misma configuración mediante Management API:

```powershell
Copy-Item deployment/supabase/smtp.env.example .env.smtp.local
# Editar .env.smtp.local con datos reales y token de administración de Supabase.
npm run smtp:apply
npm run smtp:check
```

El token se obtiene en la configuración de la cuenta de Supabase; una clave publishable o service_role no lo sustituye. También se puede suministrar mediante la variable de entorno `SUPABASE_ACCESS_TOKEN`. El archivo privado queda ignorado por Git. Nunca usar prefijo `VITE_`, guardar credenciales en el perfil TOML ni añadirlas al frontend o a Vercel.

Los comandos aceptan otro archivo privado como argumento, por ejemplo `npm run smtp:apply -- D:/secrets/dayflow-smtp.env`. Comprueban que la referencia coincide con `VITE_SUPABASE_URL` en `.env.local`. `apply` valida datos, consulta el estado, aplica únicamente SMTP, confirmación y cuota, y vuelve a leerlos. `check` es solo lectura y requiere referencia y token, pero no contraseña SMTP. Un Send Email Hook activo bloquea ambos comandos porque puede sustituir SMTP.

La plantilla propone 30 correos/hora como punto inicial para una beta pequeña; ajustar al volumen y cuota contratada. Confirmaciones y recuperaciones comparten ese presupuesto. El comando no modifica URLs, registro, migraciones ni datos. `smtpConfigured: true` verifica ajustes; `externalDeliveryVerified: false` recuerda que todavía hay que probar recepción. La contraseña puede estar oculta en la lectura de Supabase y solo un envío real valida sus credenciales.

El perfil `deployment/supabase/config.toml` sigue administrando URLs y política de Auth; SMTP se administra aparte. No usar el perfil Docker de la raíz para configurar el proyecto alojado.

## Prueba de cierre con destinatarios externos

Usar una cuenta de prueba controlada que **no pertenezca al equipo de la organización Supabase**. Registrar su condición de externa sin publicar su dirección. Repetir en un segundo proveedor de buzón para ampliar la evidencia de entregabilidad.

1. Desde la web de Vercel, registrar la cuenta. Verificar que no puede iniciar sesión antes de confirmar y que llega el correo; revisar también spam. No confirmar la cuenta mediante Admin API.
2. Con Brevo, comprobar que llega el código de confirmación, introducirlo en Dayflow y comprobar el acceso. En un despliegue que use plantillas por enlace, abrirlo en el mismo navegador y perfil donde se solicitó (PKCE) y verificar el retorno. Cerrar sesión e iniciar sesión con la contraseña elegida.
3. Solicitar recuperación desde `/auth/reset-password`. Comprobar recepción e introducir el código para mostrar el formulario de nueva contraseña. Para la variante por enlace, abrirlo en el mismo navegador y perfil y verificar la llegada a `/auth/update-password`. Guardar y comprobar que Dayflow requiere iniciar sesión otra vez.
4. Comprobar que la contraseña anterior se rechaza y la nueva permite entrar. Registrar errores y contrastar con los logs de Auth y del proveedor. Aceptación SMTP no equivale a recepción.
5. Eliminar las cuentas de prueba cuando ya no sean necesarias. No conservar en evidencia pública contraseñas, tokens, enlaces completos de Auth ni direcciones personales.

Si aparece `Email address not authorized`, comprobar que se usa el proyecto esperado y que SMTP quedó configurado. Si no llega el mensaje, revisar credenciales, remitente verificado, sandbox, cuota, logs del proveedor y spam. Una respuesta genérica de recuperación no prueba envío. Mantener la confirmación obligatoria durante la investigación.

La tarea se cierra cuando **confirmación y recuperación están completadas por destinatarios ajenos al equipo**. Mientras falten proveedor, dominio, credenciales o esa evidencia, su estado permanece pendiente.

| Evidencia                                                | Resultado actual |
| -------------------------------------------------------- | ---------------- |
| Proveedor, dominio autenticado y cuenta fuera de sandbox | Pendiente        |
| Ajustes remotos SMTP leídos tras aplicar                 | Pendiente        |
| Correo de confirmación recibido por cuenta externa       | Pendiente        |
| Confirmación por código con Brevo y acceso desde Vercel  | Pendiente        |
| Recuperación recibida y cambio completado                | Pendiente        |
| Contraseña anterior rechazada y nueva aceptada           | Pendiente        |

Para cada ronda conservar fecha y zona Europe/Madrid, SHA de la app, proyecto, dominio web, proveedor de buzón, identificadores de mensajes sin contenido personal y resultado observado. `test:local` con Mailpit y las pruebas unitarias del configurador no sustituyen esta evidencia.

## Referencias

- [Supabase: SMTP propio, restricciones y autenticación del dominio](https://supabase.com/docs/guides/auth/auth-smtp).
- [Supabase: cuotas de Auth](https://supabase.com/docs/guides/auth/rate-limits).
- [Supabase: configuración de Auth mediante Management API](https://supabase.com/docs/reference/api/v1-update-auth-service-config).
- [Validación de publicación](release-validation.md).
