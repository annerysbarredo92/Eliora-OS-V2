import { createBrowserRouter, Navigate, useParams } from 'react-router-dom'

// Layouts
import { PublicLayout }  from '@/layouts/PublicLayout'
import { AgencyLayout }  from '@/layouts/AgencyLayout'
import { ClientLayout }  from '@/layouts/ClientLayout'
import { AuthLayout }    from '@/layouts/AuthLayout'

// Guards
import { RequireAuth }     from '@/app/guards/RequireAuth'
import { RequireAgency }   from '@/app/guards/RequireAgency'
import { RequireClient }   from '@/app/guards/RequireClient'

// Public pages
import { LandingPage }     from '@/pages/public/LandingPage'
import { PricingPage }     from '@/pages/public/PricingPage'

// Auth pages
import { LoginPage }       from '@/pages/auth/LoginPage'
import { SignupPage }      from '@/pages/auth/SignupPage'
import { ForgotPage }      from '@/pages/auth/ForgotPage'

// Agency pages
import { AgencyHome }           from '@/portals/agency/pages/Home'
import { AgencyHQ }             from '@/portals/agency/pages/AgencyHQ'
import { AgencyInbox }          from '@/portals/agency/pages/Inbox'
import { AgencyProjects }       from '@/portals/agency/pages/Pipeline'
import { AgencyWorkspace }      from '@/portals/agency/pages/ClientProfile'
import { AgencyContent }        from '@/portals/agency/pages/Content'
import { AgencyCalendar }       from '@/portals/agency/pages/Calendar'
import { AgencyTasks }          from '@/portals/agency/pages/Tasks'
import { AgencyFiles }          from '@/portals/agency/pages/Files'
import { AgencyReports }        from '@/portals/agency/pages/Reports'
import { AgencyAiStudio }       from '@/portals/agency/pages/AiStudio'

function RedirectClientToProject() {
  const { clientId } = useParams<{ clientId: string }>()
  return <Navigate to={`/agency/projects/${clientId}`} replace />
}

// Client pages
import { ClientDashboard }      from '@/portals/client/pages/Dashboard'
import { ClientContent }        from '@/portals/client/pages/Content'
import { ClientApproved }       from '@/portals/client/pages/Approved'
import { ClientFiles }          from '@/portals/client/pages/Files'
import { ClientReports }        from '@/portals/client/pages/Reports'
import { ClientBilling }        from '@/portals/client/pages/Billing'
import { ClientMessages }       from '@/portals/client/pages/Messages'
import { ClientOnboarding }     from '@/portals/client/pages/Onboarding'
import { ClientSettings }       from '@/portals/client/pages/Settings'

export const router = createBrowserRouter([
  /* ── Public ─────────────────────────────────────────── */
  {
    element: <PublicLayout />,
    children: [
      { path: '/',        element: <LandingPage /> },
      { path: '/pricing', element: <PricingPage /> },
    ],
  },

  /* ── Auth ───────────────────────────────────────────── */
  {
    element: <AuthLayout />,
    children: [
      { path: '/login',   element: <LoginPage /> },
      { path: '/signup',  element: <SignupPage /> },
      { path: '/forgot',  element: <ForgotPage /> },
    ],
  },

  /* ── Agency Portal ──────────────────────────────────── */
  {
    path: '/agency',
    element: (
      <RequireAuth>
        <RequireAgency>
          <AgencyLayout />
        </RequireAgency>
      </RequireAuth>
    ),
    children: [
      /* Default landing */
      { index: true,                   element: <Navigate to="home" replace /> },

      /* Primary nav pages */
      { path: 'home',                  element: <AgencyHome /> },
      { path: 'projects',              element: <AgencyProjects /> },
      { path: 'projects/:projectId',   element: <AgencyWorkspace /> },
      { path: 'agency',                element: <AgencyHQ /> },
      { path: 'agency/:tab',           element: <AgencyHQ /> },
      { path: 'inbox',                 element: <AgencyInbox /> },
      { path: 'ai',                    element: <AgencyAiStudio /> },

      /* Utility pages (not in sidebar, still accessible) */
      { path: 'content',               element: <AgencyContent /> },
      { path: 'calendar',              element: <AgencyCalendar /> },
      { path: 'tasks',                 element: <AgencyTasks /> },
      { path: 'files',                 element: <AgencyFiles /> },
      { path: 'reports',               element: <AgencyReports /> },

      /* ── Legacy redirects ── */
      { path: 'dashboard',             element: <Navigate to="/agency/home"           replace /> },
      { path: 'notifications',         element: <Navigate to="/agency/inbox"          replace /> },
      { path: 'operations',            element: <Navigate to="/agency/agency"         replace /> },
      { path: 'operations/:tab',       element: <Navigate to="/agency/agency"         replace /> },
      { path: 'team',                  element: <Navigate to="/agency/agency/team"    replace /> },
      { path: 'billing',               element: <Navigate to="/agency/agency/billing" replace /> },
      { path: 'settings',              element: <Navigate to="/agency/agency/settings" replace /> },
      { path: 'pipeline',              element: <Navigate to="/agency/projects"       replace /> },
      { path: 'clients',               element: <Navigate to="/agency/projects"       replace /> },
      { path: 'clients/:clientId',     element: <RedirectClientToProject /> },
    ],
  },

  /* ── Client Portal ──────────────────────────────────── */
  {
    path: '/portal',
    element: (
      <RequireAuth>
        <RequireClient>
          <ClientLayout />
        </RequireClient>
      </RequireAuth>
    ),
    children: [
      { index: true,          element: <Navigate to="dashboard" replace /> },
      { path: 'dashboard',    element: <ClientDashboard /> },
      { path: 'content',      element: <ClientContent /> },
      { path: 'approved',     element: <ClientApproved /> },
      { path: 'files',        element: <ClientFiles /> },
      { path: 'reports',      element: <ClientReports /> },
      { path: 'billing',      element: <ClientBilling /> },
      { path: 'messages',     element: <ClientMessages /> },
      { path: 'onboarding',   element: <ClientOnboarding /> },
      { path: 'settings',     element: <ClientSettings /> },
    ],
  },

  /* ── Fallback ───────────────────────────────────────── */
  { path: '*', element: <Navigate to="/" replace /> },
])
