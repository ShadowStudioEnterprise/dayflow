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

Actualiza los Markdown originales y la navegación en `docs/.vitepress/config.mts` al añadir una guía. Conserva `docs/README.md` como índice para lectores de GitHub. Los resultados de pruebas deben indicar commit, fecha, entorno y alcance en `verification.md`.
