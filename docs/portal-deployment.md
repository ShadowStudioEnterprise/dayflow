# Portal de documentación

El portal utiliza VitePress y los Markdown existentes de `docs/` como fuente. Incluye búsqueda local sin servicios externos, navegación por áreas, índice de página, tema claro y oscuro y enlaces de edición en GitHub.

## Desarrollo

Desde la raíz del repositorio, con Node.js 24:

```sh
npm ci
npm run docs:dev
```

## Comprobación y compilación

```sh
npm run docs:check
npm run test:docs
npm run docs:build
npm run docs:preview
```

El resultado está en `docs/.vitepress/dist`. No se necesita Supabase ni variables privadas para construir el portal.

## Publicar en Vercel

Crea un **proyecto separado para documentación**, conectado a este repositorio y con Root Directory en `docs` y habilita **Include source files outside of the Root Directory**. En Build & Development Settings establece:

| Ajuste           | Valor                |
| ---------------- | -------------------- |
| Framework Preset | Other                |
| Install Command  | `npm ci`             |
| Build Command    | `npm run docs:build` |
| Output Directory | `.vitepress/dist`    |
| Node.js          | 24.x                 |

El archivo `docs/vercel.json` configura este proyecto de documentación de forma independiente. La configuración de la aplicación React permanece en la raíz. No necesitas variables de entorno para el portal.

Comprueba la portada, una ruta profunda como `/sync`, la búsqueda y el cambio de tema en la URL publicada. Asigna el dominio de documentación en Vercel una vez validado el despliegue.

## Mantener el contenido

### Fuente única y sincronización automática

`main` es la fuente de verdad. Los cambios documentales se revisan e integran
en `main` junto con el código. `docs-portal` es una rama de publicación: no se
edita directamente ni recibe cherry-picks. El proyecto Vercel `dayflow-docs`
(`prj_8UXbcwkl5aujWjILtWMDYgNIBzpI`) conserva `docs-portal` como rama de
producción y `docs` como raíz, con acceso a las fuentes fuera de esa raíz.
El portal estable es <https://dayflow-docs.vercel.app>.

El [workflow de publicación](https://github.com/ShadowStudioEnterprise/dayflow/blob/main/.github/workflows/docs-portal.yml)
se ejecuta con cada push a `main`, incluso si cambian dependencias o scripts
fuera de `docs`. Instala dependencias, valida documentación, ejecuta sus pruebas
y compila el portal. Después avanza `docs-portal` al **mismo SHA** mediante
fast-forward. No usa force push, no crea commits de sincronización y no borra
la historia. Una ejecución antigua se omite si `main` ya avanzó; la siguiente
publica la versión nueva. Las publicaciones se serializan.

La integración Git de Vercel compila el avance de `docs-portal` y asigna el
dominio de producción. El workflow usa `GITHUB_TOKEN` con `contents: write`
para actualizar esa rama; no requiere tokens de Vercel. El push del token no
inicia otro workflow de GitHub Actions, por lo que no genera un bucle. La
compilación Vercel se inicia desde su integración Git.

### Criterio de cierre y recuperación

Un cambio documental integrado llega al portal cuando el workflow termina
correctamente y `/portal-version.json` del dominio estable informa el SHA de
`main`. El build genera ese archivo con SHA y fecha; el workflow lo consulta
durante hasta cinco minutos y comprueba también `/verification`. Un push de
rama o un preview READY por sí solos no cierran la publicación.

Si falla la validación, corregir en `main`; `docs-portal` conserva la versión
anterior. Si la rama diverge, el workflow falla sin sobrescribir: integrar los
cambios exclusivos mediante PR a `main` y volver a ejecutar. Si Vercel falla o
no actualiza el dominio, revisar el proyecto, su rama de producción y el
despliegue, y reejecutar el workflow desde **main** con `workflow_dispatch`.
Una actualización de rama sin cambio de SHA no dispara necesariamente otro
build: en ese caso reintentar el despliegue fallido en Vercel y volver a verificar.

No se exige que la CI completa de la aplicación haya terminado para publicar
el portal; este workflow comprueba documentación y su compilación. Las pruebas
de aplicación y backend mantienen su alcance independiente.

Actualiza los Markdown originales y la navegación en `docs/.vitepress/config.mts` al añadir una guía. Conserva `docs/README.md` como índice para lectores de GitHub. Los resultados de pruebas deben indicar commit, fecha, entorno y alcance en `verification.md`.
