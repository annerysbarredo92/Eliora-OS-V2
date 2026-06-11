/* ── Auth & Roles ───────────────────────────────────────── */
export type UserRole =
  | 'master_admin'
  | 'agency_owner'
  | 'admin'
  | 'content_manager'
  | 'strategist'
  | 'editor'
  | 'client_success'
  | 'contractor'
  | 'team_member'
  | 'client_user'
  | 'pending'

export type PortalType = 'agency' | 'client' | 'public'

export interface UserProfile {
  id: string
  email: string
  role: UserRole
  agency_id: string | null
  client_id: string | null
  display_name: string
  avatar_url: string | null
  avatar_initials: string
  department: string | null
  job_title: string | null
  is_active: boolean
  onboarding_complete: boolean
  created_at: string
  updated_at: string
}

/* ── Agency ─────────────────────────────────────────────── */
export interface Agency {
  id: string
  name: string
  slug: string
  logo_url: string | null
  plan: 'starter' | 'growth' | 'scale' | 'enterprise'
  owner_id: string
  onboarding_step: number
  onboarding_complete: boolean
  settings: Record<string, unknown>
  created_at: string
}

/* ── Client (Phase 02) ──────────────────────────────────── */
export type ClientStatus = 'active' | 'onboarding' | 'paused' | 'archived' | 'lead'
export type ClientHealth = 'healthy' | 'at_risk' | 'critical' | 'unknown'

export interface ClientContact {
  id: string
  agency_id: string
  client_id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  title: string | null
  is_primary: boolean
  created_at: string
  updated_at: string
}

export interface Client {
  id: string
  agency_id: string
  business_name: string
  industry: string | null
  website: string | null
  business_phone: string | null
  business_address: string | null
  status: ClientStatus
  health: ClientHealth
  package_name: string | null
  portal_enabled: boolean
  internal_notes: string | null
  last_activity_at: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
  /** Embedded via Supabase relationship select. */
  client_contacts?: ClientContact[]
}

/** Convenience shape: a client with its resolved primary contact. */
export interface ClientWithPrimary extends Client {
  primary_contact: ClientContact | null
}

/* ── Activity (Phase 02) ────────────────────────────────── */
export interface ActivityLog {
  id: string
  agency_id: string
  client_id: string | null
  actor_profile_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  description: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface DashboardMetrics {
  total: number
  active: number
  onboarding: number
  archived: number
  paused: number
  lead: number
}

/* ── Operations / Onboarding (Phase 03) ─────────────────── */
export type SetupStepStatus = 'not_started' | 'in_progress' | 'completed' | 'skipped'

export interface AgencySetupStep {
  id: string
  agency_id: string
  step_key: string
  title: string
  description: string | null
  status: SetupStepStatus
  sort_order: number
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface AgencyOnboardingProgress {
  id: string
  agency_id: string
  total_steps: number
  completed_steps: number
  completion_pct: number
  readiness_score: number
  skipped: boolean
  completed_at: string | null
  created_at: string
  updated_at: string
}

export type BillingType = 'one_time' | 'monthly' | 'quarterly' | 'custom'

export interface Service {
  id: string
  agency_id: string
  name: string
  category: string | null
  description: string | null
  price_cents: number
  billing_type: BillingType
  is_active: boolean
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export type BillingFrequency = 'one_time' | 'monthly' | 'quarterly' | 'annual' | 'custom'

export interface PackageService {
  id: string
  agency_id: string
  package_id: string
  service_id: string
  created_at: string
}

export interface Package {
  id: string
  agency_id: string
  name: string
  description: string | null
  price_cents: number
  billing_frequency: BillingFrequency
  is_active: boolean
  is_default: boolean
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
  /** Embedded join rows via Supabase relationship select. */
  package_services?: PackageService[]
}

export type TemplateType =
  | 'proposal' | 'invoice' | 'report' | 'content' | 'onboarding' | 'task' | 'email'

export interface Template {
  id: string
  agency_id: string
  template_type: TemplateType
  name: string
  description: string | null
  content: Record<string, unknown>
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AgencyHealthScore {
  id: string
  agency_id: string
  metric_key: string
  score: number
  details: Record<string, unknown>
  updated_at: string
}

/* ── Navigation ─────────────────────────────────────────── */
export interface NavItem {
  id: string
  label: string
  icon: string
  path: string
  badge?: number | string
  roles?: UserRole[]
}

/* ── API Response ───────────────────────────────────────── */
export interface ApiResult<T> {
  data: T | null
  error: string | null
  ok: boolean
}
