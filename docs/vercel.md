# Publicación en Vercel

Dayflow se publica desde la raíz del proyecto como una SPA Vite. `vercel.json`
configura `npm ci`, `npm run build`, la salida `dist`, las rutas de la aplicación
y la caché. Los archivos que no existen fuera de esas rutas mantienen su 404;
un JavaScript ausente no recibe HTML por error.

## Primera publicación

1. Autenticarse con `npx vercel login` y vincular el proyecto con `npx vercel link`.
2. Configurar estas variables de compilación en el proyecto de Vercel, copiando
   los valores actuales de `.env.local` a **Production**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY` (publishable o anon)
   - `VITE_WEB_PUSH_PUBLIC_KEY` (la misma clave pública VAPID ya desplegada)
3. Usar Node.js 24 y publicar con `npx vercel --prod`.
4. Con la URL estable asignada, añadir en Supabase → Authentication → URL
   Configuration los destinos exactos `https://DOMINIO/` y
   `https://DOMINIO/auth/update-password`. Si Vercel pasa a ser la dirección
   principal, actualizar también Site URL. Conservar los destinos antiguos y
   los nativos durante la transición. Reflejar los cambios en
   `deployment/supabase/config.toml` antes de aplicar ese perfil remoto.
5. Comprobar acceso directo a `/profile`, `/auth/login` y
   `/auth/update-password`; `/sw.js` y `/push-worker.js` deben devolver JavaScript
   accesible sin una pantalla de acceso del proveedor. Verificar registro del
   worker y comprobación de actualizaciones en el dominio final.

`.vercelignore` excluye archivos de entorno, secretos, herramientas locales,
aplicaciones nativas, resultados de pruebas y las publicaciones anteriores.
La clave privada VAPID, el token del planificador y `service_role` permanecen
fuera de Vercel. No hace falta volver a desplegar las funciones ni crear otro
planificador: Supabase sigue siendo el backend.

## Cambio de dominio

La sesión, los datos locales y los permisos del navegador pertenecen al dominio.
Antes de cambiar, comprobar que los cambios del sitio anterior terminaron de
sincronizarse. En Vercel hay que iniciar sesión de nuevo, activar los avisos web
y, si se desea, instalar la PWA desde la nueva dirección. Los datos sincronizados
se recuperan desde la misma cuenta de Supabase. No borrar el almacenamiento del
dominio antiguo mientras queden cambios pendientes.

El cambio de alojamiento no corrige la limitación verificada de Chrome en
Windows cuando todos sus procesos están detenidos.

## Estado

Publicada el 4 de octubre de 2026:

- URL estable: https://dayflow-by-shadowstudio.vercel.app
- Acceso: https://dayflow-by-shadowstudio.vercel.app/auth/login
- Proyecto: `shadow-studio3/dayflow`, `prj_fpBaMferBZRyCQU5U8H67MF4IiKB`.
- Despliegue: `dpl_ARTjc2TziAh7hEw8EG76zuhTKVV5`, estado `READY`, producción.
- Compilación remota con Node.js 24, TypeScript y Vite superada; 73 entradas
  de precaché. Variables públicas configuradas para Production.
- Supabase actualizado: Site URL y dos retornos exactos del nuevo dominio;
  destinos anteriores conservados. Una comparación posterior no encontró
  cambios pendientes en las propiedades declaradas.
- HTTP sin credenciales: raíz, perfil y rutas de Auth devuelven 200; workers
  devuelven JavaScript con revalidación de caché. Un asset inexistente y
  `/.env.local` devuelven 404.
- Chromium aislado contra producción: `/profile` redirige a acceso; el worker
  llega a estar listo y «Comprobar actualizaciones» termina correctamente.
  Sin errores JavaScript en esos recorridos.

El dominio estable permite cargar la web sin una cuenta de Vercel; los datos
personales requieren la sesión de Dayflow. No se repitieron el envío y la
recepción manual de correos ni el alta y entrega de notificaciones en el nuevo
dominio. El acceso anterior de Sites sigue disponible con su audiencia privada.

La primera compilación remota falló porque una exclusión `supabase` también
omitía `src/services/supabase`. Se corrigió a `/supabase/` antes de la publicación
verificada. La vinculación local se guarda en `.vercel/`, excluida de Git.

## Referencias

- [Vite en Vercel](https://vercel.com/docs/frameworks/frontend/vite)
- [Configuración de Vercel](https://vercel.com/docs/project-configuration/vercel-json)
- [Inicio de sesión de la CLI](https://vercel.com/docs/cli/login)
