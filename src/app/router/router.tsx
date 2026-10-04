import { createBrowserRouter, Link } from 'react-router-dom'
import AppLayout from '../layouts/AppLayout'
import { LazyBoundary, Loading, RequireAuth } from './RouteBoundaries'

const privatePages = {
  profile: () => import('../../features/profile/ProfilePage'),
  tasks: () => import('../../features/tasks/pages/TasksPage'),
  notes: () => import('../../features/notes/pages/NotesPage'),
  calendar: () => import('../../features/calendar/pages/CalendarPage'),
  reminders: () => import('../../features/reminders/pages/RemindersPage'),
  inbox: () => import('../../features/inbox/InboxPage'),
  tags: () => import('../../features/tags/TagsPage'),
  search: () => import('../../features/search/SearchPage'),
}

const children = [
  {
    index: true,
    lazy: async () => ({
      Component: (await import('../../features/dashboard/FoundationPage'))
        .default,
    }),
  },
  {
    path: 'settings',
    lazy: async () => ({
      Component: (await import('../../features/settings/SettingsPage')).default,
    }),
  },
  {
    path: 'profile',
    lazy: async () => ({
      Component: (await import('../../features/profile/ProfilePage')).default,
    }),
  },
  ...['tasks', 'notes', 'calendar', 'reminders', 'inbox', 'tags'].map(
    (path) => ({
      path,
      lazy: async () => ({
        Component: (await import('../../shared/components/PlannedPage'))
          .default,
      }),
    }),
  ),
]
export const router = createBrowserRouter([
  {
    element: <LazyBoundary />,
    hydrateFallbackElement: <Loading />,
    children: [
      {
        element: <RequireAuth />,
        children: [
          {
            path: '/',
            element: <AppLayout />,
            children: [
              {
                index: true,
                lazy: async () => ({
                  Component: (
                    await import('../../features/dashboard/DashboardPage')
                  ).default,
                }),
              },
              children[1]!,
              ...Object.entries(privatePages).map(([path, load]) => ({
                path,
                lazy: async () => ({ Component: (await load()).default }),
              })),
            ],
          },
        ],
      },
      { path: '/setup', element: <AppLayout preview />, children },
      ...['login', 'register', 'reset-password', 'update-password'].map(
        (action) => ({
          path: `/auth/${action}`,
          lazy: async () => ({
            Component: (await import('../../features/auth/AuthPage')).default,
          }),
        }),
      ),
      {
        path: '*',
        element: (
          <main className="fatal">
            <h1>Este espacio no existe.</h1>
            <Link className="button primary" to="/">
              Volver a Dayflow
            </Link>
          </main>
        ),
      },
    ],
  },
])
