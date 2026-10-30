# SMTP para ampliar la beta

Estado del 12 de octubre de 2026: **preparación disponible; activación y entrega externa pendientes**. El propietario confirmó que aún no tiene proveedor ni credenciales SMTP. La validación previa de Auth en Vercel no acredita envío a destinatarios ajenos al equipo. No abrir el registro externo hasta completar la prueba de esta guía.

Supabase Auth envía confirmación y recuperación. Su correo predeterminado restringe destinatarios al equipo del proyecto. Configurar SMTP propio significa conectar un proveedor de correo transaccional a Supabase; no requiere crear un servidor de correo en Dayflow ni cambiar sus llamadas de Auth.

## Obtener el servicio y el remitente

1. Elegir un proveedor con SMTP que permita enviar a destinatarios externos. Supabase enumera, entre otros, Resend, Brevo, Postmark y Amazon SES. Revisar su cuota y comprobar que la cuenta no está limitada a un sandbox o a destinatarios verificados.
2. Usar un dominio o subdominio propio para el remitente, por ejemplo `auth.tudominio.com`. Las direcciones de alojamiento de Vercel y Sites no conceden control DNS para autenticar correo. Hace falta un dominio administrable y acceso a su DNS.
3. Publicar los registros SPF y DKIM indicados por el proveedor y configurar DMARC. Esperar a que el proveedor confirme el dominio; evitar duplicar registros SPF. Elegir una dirección de remitente autorizada y nombre **Dayflow**.
4. Obtener host, puerto TLS, usuario y contraseña SMTP. Desactivar seguimiento de enlaces en estos mensajes para conservar los enlaces de Auth. Conservar las plantillas con su enlace de confirmación original.

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
2. Abrir el enlace en el mismo navegador y perfil donde se solicitó (PKCE). Comprobar regreso al dominio correcto y acceso a Dayflow. Cerrar sesión e iniciar sesión con la contraseña elegida.
3. Solicitar recuperación desde `/auth/reset-password`. Comprobar recepción del correo y abrirlo en el mismo navegador/perfil. Verificar la llegada a `/auth/update-password`, cambiar la contraseña y cerrar sesión.
4. Comprobar que la contraseña anterior se rechaza y la nueva permite entrar. Registrar errores y contrastar con los logs de Auth y del proveedor. Aceptación SMTP no equivale a recepción.
5. Eliminar las cuentas de prueba cuando ya no sean necesarias. No conservar en evidencia pública contraseñas, tokens, enlaces completos de Auth ni direcciones personales.

Si aparece `Email address not authorized`, comprobar que se usa el proyecto esperado y que SMTP quedó configurado. Si no llega el mensaje, revisar credenciales, remitente verificado, sandbox, cuota, logs del proveedor y spam. Una respuesta genérica de recuperación no prueba envío. Mantener la confirmación obligatoria durante la investigación.

La tarea se cierra cuando **confirmación y recuperación están completadas por destinatarios ajenos al equipo**. Mientras falten proveedor, dominio, credenciales o esa evidencia, su estado permanece pendiente.

| Evidencia                                                | Resultado actual |
| -------------------------------------------------------- | ---------------- |
| Proveedor, dominio autenticado y cuenta fuera de sandbox | Pendiente        |
| Ajustes remotos SMTP leídos tras aplicar                 | Pendiente        |
| Correo de confirmación recibido por cuenta externa       | Pendiente        |
| Enlace de confirmación y acceso desde Vercel             | Pendiente        |
| Recuperación recibida y cambio completado                | Pendiente        |
| Contraseña anterior rechazada y nueva aceptada           | Pendiente        |

Para cada ronda conservar fecha y zona Europe/Madrid, SHA de la app, proyecto, dominio web, proveedor de buzón, identificadores de mensajes sin contenido personal y resultado observado. `test:local` con Mailpit y las pruebas unitarias del configurador no sustituyen esta evidencia.

## Referencias

- [Supabase: SMTP propio, restricciones y autenticación del dominio](https://supabase.com/docs/guides/auth/auth-smtp).
- [Supabase: cuotas de Auth](https://supabase.com/docs/guides/auth/rate-limits).
- [Supabase: configuración de Auth mediante Management API](https://supabase.com/docs/reference/api/v1-update-auth-service-config).
- [Validación de publicación](release-validation.md).
