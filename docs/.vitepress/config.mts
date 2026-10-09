import { defineConfig } from 'vitepress'

const group = (text: string, pages: [string, string][]) => ({
  text,
  collapsed: false,
  items: pages.map(([text, slug]) => ({ text, link: `/${slug}` })),
})
export default defineConfig({
  lang: 'es-ES',
  title: 'Dayflow Docs',
  description:
    'Arquitectura, producto y operación de Dayflow. Documentación técnica de la aplicación local-first.',
  cleanUrls: true,
  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'Dayflow / Docs',
    nav: [
      { text: 'Guías', link: '/architecture' },
      { text: 'Validación', link: '/verification' },
      { text: 'Auditoría', link: '/audits/2026-10-09' },
      { text: 'Publicar', link: '/portal-deployment' },
    ],
    sidebar: [
      group('Fundamentos', [
        ['Dossier técnico', 'technical-dossier'],
        ['Arquitectura', 'architecture'],
        ['Base de datos', 'database'],
        ['Sincronización', 'sync'],
      ]),
      group('Producto', [
        ['Hoy', 'dashboard'],
        ['Tareas', 'tasks'],
        ['Notas', 'notes'],
        ['Calendario', 'calendar'],
        ['Recordatorios', 'reminders'],
        ['Bandeja, búsqueda y etiquetas', 'inbox-search-tags'],
        ['Relaciones', 'relations'],
      ]),
      group('Plataformas y servicios', [
        ['PWA y aplicaciones nativas', 'pwa-native'],
        ['Android local', 'android-local'],
        ['Backend local', 'local-backend'],
        ['Backend alojado', 'hosted-backend'],
        ['Web Push', 'web-push'],
        ['Política de notificaciones', 'notifications-policy'],
      ]),
      group('Calidad y publicación', [
        ['Verificación', 'verification'],
        ['Validación de versiones', 'release-validation'],
        ['Evaluación web', 'web-evaluation'],
        ['Plan de implementación', 'implementation-plan'],
        ['Vercel: aplicación', 'vercel'],
        ['Vercel: documentación', 'portal-deployment'],
        ['Auditoría · 09/10/2026', 'audits/2026-10-09'],
      ]),
    ],
    search: {
      provider: 'local',
      options: {
        locales: {
          root: {
            translations: {
              button: {
                buttonText: 'Buscar',
                buttonAriaLabel: 'Buscar documentación',
              },
              modal: {
                noResultsText: 'Sin resultados para',
                resetButtonTitle: 'Limpiar búsqueda',
                footer: {
                  selectText: 'seleccionar',
                  navigateText: 'navegar',
                  closeText: 'cerrar',
                },
              },
            },
          },
        },
      },
    },
    outline: { label: 'En esta página', level: [2, 3] },
    docFooter: { prev: 'Anterior', next: 'Siguiente' },
    editLink: {
      pattern:
        'https://github.com/ShadowStudioEnterprise/dayflow/edit/main/docs/:path',
      text: 'Editar en GitHub',
    },
    socialLinks: [
      {
        icon: 'github',
        link: 'https://github.com/ShadowStudioEnterprise/dayflow',
      },
    ],
    footer: {
      message:
        'Dayflow 0.9.0 · Beta. La evidencia fechada distingue lo verificado de lo pendiente.',
      copyright: 'ShadowStudioEnterprise',
    },
  },
})
