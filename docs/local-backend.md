# Dayflow con Supabase local

Este entorno permite crear una cuenta y usar Dayflow sin un proyecto alojado ni una cuenta de Supabase. PostgreSQL, Auth, Realtime y el buzón de pruebas funcionan en Docker en este ordenador. Requiere Node.js 24 y Docker Desktop en ejecución con contenedores Linux.

## Arrancar

Desde la carpeta del proyecto:

```sh
npm ci
npm run backend:start
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

La primera descarga puede tardar varios minutos. El comando aplica las migraciones pendientes al arrancar y configura `.env.local` con la URL y la clave pública locales. Si ese archivo apunta a otro proyecto, lo conserva y detiene la configuración: usa una copia separada del repositorio para desarrollo local. Reinicia Vite después de cambiar variables.

- Aplicación: <http://127.0.0.1:5173>
- Correo local (Mailpit): <http://127.0.0.1:54324>
- Base de datos y usuarios (Studio): <http://127.0.0.1:54323>

En Dayflow, pulsa **Crear cuenta**, introduce nombre, email y una contraseña de al menos 12 caracteres. Abre **Correo local** y sigue el enlace de confirmación en el mismo navegador y perfil donde solicitaste el registro. Los correos se capturan aquí; no se envían al buzón externo del email indicado. La recuperación de contraseña usa el mismo buzón y navegador por el flujo PKCE.

Para comprobar la sincronización, inicia sesión con esa cuenta en dos perfiles de navegador. En **Configuración → Sincronización** puedes ver el estado y sincronizar manualmente. Cada perfil mantiene su propia base IndexedDB.

## Detener y volver a usar

Detén Vite con Ctrl+C. Para parar el backend:

```sh
npm run backend:stop
```

Los volúmenes y cuentas se conservan. Para volver, abre Docker Desktop y ejecuta `npm run backend:start` y `npm run dev`. `npm run backend:configure` permite regenerar sólo la configuración pública si el backend ya está activo. No necesitas restablecer la base de datos.

## Verificación real

```sh
npx playwright install chromium
npm run test:local
```

La suite arranca su propio servidor web en el puerto 4181 y usa los servicios locales sin interceptar HTTP. Crea cuentas de prueba con prefijo `dayflow-e2e-` y correos en Mailpit. Comprueba confirmación, recuperación, logout, RPC, mensajes Realtime, convergencia entre perfiles, cambios offline y RLS entre cuentas. Las cuentas y sus datos de prueba permanecen en la base local; no elimina otros datos.

Los logs del CLI quedan en `.supabase-local.log`, ignorado por Git; pueden incluir credenciales administrativas locales, por lo que no deben compartirse. La aplicación recibe sólo la clave pública. Las pruebas desactivan las trazas para no almacenar los enlaces de acceso en ellas.

## Alcance

Este arranque sirve para desarrollo y uso en el mismo ordenador. Para desarrollar con Android puedes usar [Dayflow Local y un túnel ADB por USB/emulador](android-local.md). Las direcciones `127.0.0.1` por sí solas no conectan un teléfono físico con este backend. Para distribuir una PWA o app móvil, configura antes un backend HTTPS accesible desde esos dispositivos y sus URLs de retorno. El APK habitual de la fase 9 conserva su compilación anterior; Dayflow Local se genera por separado.

`npm run build` usa las variables actuales de `.env.local`. Un build configurado con este backend sólo es útil en este ordenador. Para una vista previa local, usa `npm run preview -- --host 127.0.0.1 --port 4178 --strictPort`; ese origen ya está permitido para Auth.

Referencias: [Supabase CLI y desarrollo local](https://supabase.com/docs/guides/local-development/cli/getting-started), [claves públicas](https://supabase.com/docs/guides/getting-started/api-keys) y [buzón Mailpit](https://mailpit.axllent.org/docs/integration/).
