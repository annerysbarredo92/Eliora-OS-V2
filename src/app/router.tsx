import { createBrowserRouter, Navigate } from 'react-router-dom'

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
import { AgencyDashboard }      from '@/portals/agency/pages/Dashboard'
import { AgencyClients }        from '@/portals/agency/pages/Clients'
import { AgencyClientProfile }  from '@/portals/agency/pages/ClientProfile'
import { AgencyContent }        from '@/portals/agency/pages/Content'
import { AgencyCalendar }       from '@/portals/agency/pages/Calendar'
import { AgencyTasks }          from '@/portals/agency/pages/Tasks'
import { AgencyFiles }          from '@/portals/agency/pages/Files'
import { AgencyReports }        from '@/portals/agency/pages/Reports'
import { AgencyBilling }        from '@/portals/agency/pages/Billing'
import { AgencyPipeline }       from '@/portals/agency/pages/Pipeline'
import { AgencyOperations }     from '@/portals/agency/pages/Operations'
import { AgencyAiStudio }       from '@/portals/agency/pages/AiStudio'
import { AgencyTeam }           from '@/portals/agency/pages/Team'
import { AgencyNotifications }  from '@/portals/agency/pages/Notifications'
import { AgencySettings }       from '@/portals/agency/pages/Settings'

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
      { index: true,              element: <Navigate to="dashboard" replace /> },
      { path: 'dashboard',        element: <AgencyDashboard /> },
      { path: 'clients',          element: <AgencyClients /> },
      { path: 'clients/:clientId', element: <AgencyClientProfile /> },
      { path: 'content',          element: <AgencyContent /> },
      { path: 'calendar',         element: <AgencyCalendar /> },
      { path: 'tasks',            element: <AgencyTasks /> },
      { path: 'files',            element: <AgencyFiles /> },
      { path: 'reports',          element: <AgencyReports /> },
      { path: 'billing',          element: <AgencyBilling /> },
      { path: 'pipeline',         element: <AgencyPipeline /> },
      { path: 'operations',       element: <AgencyOperations /> },
      { path: 'operations/:tab',  element: <AgencyOperations /> },
      { path: 'ai',               element: <AgencyAiStudio /> },
      { path: 'team',             element: <AgencyTeam /> },
      { path: 'notifications',    element: <AgencyNotifications /> },
      { path: 'settings',         element: <AgencySettings /> },
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
