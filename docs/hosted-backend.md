# Dayflow con Supabase alojado

Esta guía conecta la aplicación existente a un proyecto Supabase por HTTPS. El backend Docker y sus datos permanecen separados: cambiar la URL no migra cuentas ni documentos locales al proyecto alojado.

## Estado configurado — 3 de octubre de 2026

- Proyecto: **Dayflow**, referencia `spfrfvpexfnnhwpfinrq`, región `eu-central-1`.
- API: `https://spfrfvpexfnnhwpfinrq.supabase.co`.
- Las cuatro migraciones están aplicadas y coinciden con el historial local. Las 17 tablas públicas tienen RLS y `sync_heads` pertenece a la publicación Realtime.
- `.env.local` usa una clave publishable y no muestra el buzón Docker. La configuración anterior está conservada en `.env.docker-backup-20261003-142406.local`, ignorada por Git.
- El registro, email/contraseña y confirmación de email están activos. Se aplicaron los retornos web/nativos, mínimo de 12 caracteres y cambio seguro de contraseña.
- Vite reinició al cambiar las variables y el build web/PWA terminó correctamente con la URL alojada.
- Se verificaron login, escritura RPC, WebSocket, convergencia offline, RLS entre cuentas y logout usando cuentas temporales, eliminadas al terminar. La entrega de email y recuperación por correo siguen pendientes: las cuentas de prueba se confirmaron por Admin API.

La configuración remota reproducible está en `deployment/supabase/config.toml`, separada del perfil Docker. Solo declara las propiedades de Auth que administra Dayflow; el resto de ajustes remotos se conserva. Para revisar o reaplicar ese perfil desde la raíz:

```powershell
npx --no-install supabase config diff --workdir D:/Projects/dayflow/deployment --project-ref spfrfvpexfnnhwpfinrq
npx --no-install supabase config push --workdir D:/Projects/dayflow/deployment --project-ref spfrfvpexfnnhwpfinrq
```

Esta configuración permite probar la web en `http://127.0.0.1:5173/`. No publica la web ni cambia los APK existentes. Cuando haya un dominio web HTTPS habrá que actualizar Site URL y los retornos de este perfil.

## Datos y acceso necesarios

Desde **Connect** en el proyecto, copia la URL y una clave pública `sb_publishable_...`. La variable de Dayflow sigue llamándose `VITE_SUPABASE_ANON_KEY`, pero acepta esa clave; también admite la clave pública `anon` anterior. No uses claves `secret` o `service_role` en la aplicación.

La clave pública permite conectar la aplicación, pero no aplicar migraciones ni administrar Auth. Para eso inicia sesión en la CLI desde una terminal de este ordenador:

```powershell
Set-Location D:\Projects\dayflow
npx --no-install supabase login
```

Completa el acceso en el navegador. Si se solicita una contraseña de base de datos al enlazar, introdúcela directamente en la terminal, sin incorporarla a archivos del frontend ni compartirla en el chat.

## Revisar y aplicar el esquema

Sustituye `REFERENCIA_DEL_PROYECTO` por el identificador de tu proyecto. Comprueba primero que es el proyecto destinado a Dayflow y revisa si ya contiene tablas o migraciones de otra aplicación. Las migraciones iniciales crean tablas con nombres como `profiles`, `notes` y `tasks`; no se deben ejecutar sobre un esquema incompatible.

```powershell
npx --no-install supabase link --project-ref REFERENCIA_DEL_PROYECTO
npx --no-install supabase migration list --linked
npx --no-install supabase db push --linked --dry-run --skip-vault
```

En un proyecto nuevo deben aparecer estas cuatro migraciones pendientes, en este orden:

1. `202609200001_foundation.sql`
2. `202609200002_task_recurrence.sql`
3. `202609240003_reminder_timezone.sql`
4. `202609240004_sync.sql`

Una vez revisado el destino y las migraciones pendientes:

```powershell
npx --no-install supabase db push --linked --skip-vault
npx --no-install supabase migration list --linked
```

La cuarta migración configura las RPC de sincronización, sus permisos y la publicación Realtime de `public.sync_heads`. El esquema incluye RLS. No es necesario habilitar todas las tablas en Realtime. No uses `db reset --linked`: borraría el esquema remoto. No ejecutes `config push` con el archivo actual, que contiene ajustes específicos del backend Docker.

## Autenticación para probar desde este ordenador

En **Authentication → URL Configuration**, usa inicialmente:

- Site URL: `http://127.0.0.1:5173/`
- Redirect URLs:
  - `http://127.0.0.1:5173/`
  - `http://127.0.0.1:5173/auth/update-password`
  - `http://localhost:5173/`
  - `http://localhost:5173/auth/update-password`
  - `dayflow://auth/callback`
  - `dayflow://auth/callback?next=recovery`

Activa email/contraseña, registro y confirmación por email. Configura una contraseña mínima de 12 caracteres. Cuando publiques la web, cambia Site URL al dominio HTTPS e incorpora sus dos rutas de retorno: `/` y `/auth/update-password`. No uses como Site URL la URL de la API de Supabase.

El envío de correo predeterminado está limitado a direcciones del equipo del proyecto y tiene límites reducidos. Para registro y recuperación de otros usuarios, configura **Custom SMTP**. No desactives la confirmación para ocultar un problema de envío. Los correos del proyecto alojado no aparecen en Mailpit local.

## Conectar la aplicación

Conserva una copia de la configuración local fuera del control de versiones y actualiza `.env.local`:

```dotenv
VITE_SUPABASE_URL=https://REFERENCIA_DEL_PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_CLAVE_PUBLICA
VITE_LOCAL_MAILBOX_URL=
```

Reinicia Vite después del cambio. Para las primeras comprobaciones utiliza otro perfil de navegador, evitando mezclar sesiones y cambios pendientes del backend Docker. Las cuentas del backend local no existen automáticamente en el proyecto alojado.

```powershell
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Un build incorpora las variables del momento de compilación: los APK y builds web anteriores continúan apuntando a su backend anterior hasta recompilarlos. `native:android:local` genera deliberadamente la variante para Docker/ADB y no sirve para distribuir la conexión alojada.

## Comprobación de conexión

1. Crear una cuenta de prueba y confirmar el email en el mismo navegador/perfil donde se solicitó el registro (PKCE).
2. Crear una tarea y comprobar en Configuración que se sincroniza sin errores.
3. Iniciar sesión en un segundo perfil, verificar la tarea y editarla; comprobar la actualización en el primero.
4. Desconectar un perfil, modificar una tarea, reconectar y verificar la convergencia.
5. Probar recuperación de contraseña y cierre de sesión.
6. Comprobar que otra cuenta no puede leer los datos de la primera.

Estas verificaciones requieren el proyecto conectado y correos reales. `test:local` sigue destinado a Docker y Mailpit; no acredita la configuración del proyecto alojado.

## Referencias

- [Claves públicas y dónde obtenerlas](https://supabase.com/docs/guides/getting-started/api-keys).
- [Despliegue de migraciones](https://supabase.com/docs/guides/deployment/database-migrations).
- [URLs de retorno de Auth](https://supabase.com/docs/guides/auth/redirect-urls).
- [Correo y SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
