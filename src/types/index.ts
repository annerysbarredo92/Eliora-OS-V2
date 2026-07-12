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

/* ── Client / Project (unified record) ──────────────────── */
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
  roles: string[]
  preferred_communication: string | null
  birthday: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Client {
  id: string
  agency_id: string
  business_name: string
  industry: string | null
  sub_industry: string | null
  website: string | null
  business_email: string | null
  business_phone: string | null
  business_address: string | null
  timezone: string | null
  company_description: string | null
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
  /* ── Project / Pipeline fields (wave-projects-workspace) ── */
  stage_id: string | null
  project_value_cents: number
  lead_source: string | null
  estimated_budget_cents: number
  close_probability: number | null
  decision_maker: string | null
  next_follow_up_at: string | null
  sales_owner_id: string | null
  account_manager_id: string | null
  lead_score: number | null
  expected_close_date: string | null
  client_since: string | null
  location: string | null
  next_action: string | null
  lead_info: Record<string, unknown>
  discovery_data: Record<string, unknown>
  /** Embedded via Supabase relationship select. */
  client_contacts?: ClientContact[]
  /** Embedded pipeline stage via FK join. */
  pipeline_stages?: PipelineStage
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

/* ── Client Portal (Phase 04) ───────────────────────────── */
export interface ClientPortalProfile {
  id: string
  agency_id: string
  client_id: string
  company_name: string | null
  company_size: string | null
  industry: string | null
  website: string | null
  business_phone: string | null
  business_address: string | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  contact_title: string | null
  brand_colors: unknown[]
  brand_voice: string | null
  logo_url: string | null
  brand_notes: string | null
  social_accounts: Record<string, string>
  business_goals: string | null
  target_audience: string | null
  created_at: string
  updated_at: string
}

export interface ClientPortalSettings {
  id: string
  agency_id: string
  client_id: string
  communication_channel: string
  communication_frequency: string
  communication_notes: string | null
  approval_workflow: string
  approval_turnaround: string
  approver_name: string | null
  notify_email: boolean
  notify_content: boolean
  notify_reports: boolean
  notify_messages: boolean
  timezone: string
  created_at: string
  updated_at: string
}

export interface ClientOnboardingProgress {
  id: string
  agency_id: string
  client_id: string
  sections: Record<string, boolean>
  completion_pct: number
  skipped: boolean
  completed_at: string | null
  created_at: string
  updated_at: string
}

/* ── Onboarding system (Phase 05) ───────────────────────── */
export type OnboardingQuestionType =
  | 'text' | 'textarea' | 'url' | 'email' | 'phone' | 'number'
  | 'select' | 'multiselect' | 'social' | 'upload'

export type OnboardingStatus = 'not_started' | 'in_progress' | 'completed' | 'submitted'

export interface OnboardingQuestion {
  id: string
  agency_id: string
  template_id: string
  section_id: string
  key: string
  label: string
  help_text: string | null
  question_type: OnboardingQuestionType
  options: string[]
  is_required: boolean
  sort_order: number
}

export interface OnboardingSection {
  id: string
  agency_id: string
  template_id: string
  key: string
  title: string
  description: string | null
  sort_order: number
  questions: OnboardingQuestion[]
}

export interface OnboardingTemplate {
  id: string
  agency_id: string
  name: string
  description: string | null
  is_default: boolean
  is_active: boolean
  sections: OnboardingSection[]
}

export interface OnboardingResponse {
  id: string
  client_id: string
  question_id: string
  value: unknown
}

export interface OnboardingMissingItem {
  section: string
  label: string
}

export interface OnboardingProgress {
  id: string
  agency_id: string
  client_id: string
  template_id: string | null
  status: OnboardingStatus
  sections: Record<string, boolean>
  completion_pct: number
  total_sections: number
  completed_sections: number
  missing_items: OnboardingMissingItem[]
  started_at: string | null
  last_saved_at: string | null
  submitted_at: string | null
  created_at: string
  updated_at: string
}

export interface OnboardingRequiredItem {
  id: string
  agency_id: string
  client_id: string
  key: string
  label: string
  is_provided: boolean
  provided_at: string | null
  sort_order: number
}

export interface OnboardingActivity {
  id: string
  agency_id: string
  client_id: string | null
  actor_profile_id: string | null
  action: string
  description: string | null
  metadata: Record<string, unknown>
  created_at: string
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

/* ── Wave 1: Content (Phase 06/09) ──────────────────────── */
export type ContentType = 'static_post' | 'carousel' | 'reel' | 'story' | 'video' | 'blog' | 'email' | 'custom'
export type ContentPlatform = 'instagram' | 'facebook' | 'tiktok' | 'linkedin' | 'pinterest' | 'youtube' | 'google_business' | 'custom'
export type ContentStatus = 'idea' | 'filming' | 'editing' | 'draft' | 'internal_review' | 'client_review' | 'approved' | 'revision_requested' | 'rejected' | 'scheduled' | 'published' | 'archived'
export type ContentApprovalAction = 'approve' | 'request_changes' | 'reject' | 'comment'
export type FileOwnerRole = 'agency' | 'client'

export interface ContentItem {
  id: string
  agency_id: string
  client_id: string
  title: string
  content_type: ContentType
  platform: ContentPlatform
  campaign: string | null
  caption: string | null
  cta: string | null
  hashtags: string | null
  scheduled_date: string | null
  status: ContentStatus
  internal_notes: string | null
  client_notes: string | null
  comment_count: number
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export interface ContentComment {
  id: string
  agency_id: string
  client_id: string
  content_id: string
  author_id: string | null
  author_role: FileOwnerRole
  body: string
  is_internal: boolean
  created_at: string
}

export interface ContentApproval {
  id: string
  agency_id: string
  client_id: string
  content_id: string
  action: ContentApprovalAction
  note: string | null
  actor_id: string | null
  created_at: string
}

export interface ContentAsset {
  id: string
  agency_id: string
  client_id: string
  content_id: string
  file_id: string | null
  storage_path: string | null
  file_name: string | null
  mime_type: string | null
  created_at: string
}

/* ── Wave 1: Files (Phase 07) ───────────────────────────── */
export interface AssetFolder {
  id: string
  agency_id: string
  client_id: string
  name: string
  is_default: boolean
  sort_order: number
  created_at: string
}

export interface ClientAsset {
  id: string
  agency_id: string
  client_id: string
  folder_id: string | null
  name: string
  storage_path: string
  mime_type: string | null
  size_bytes: number
  owner_role: FileOwnerRole
  is_client_visible: boolean
  internal_notes: string | null
  is_archived: boolean
  created_at: string
  updated_at: string
}

export interface FileRequest {
  id: string
  agency_id: string
  client_id: string
  title: string
  description: string | null
  status: 'open' | 'completed' | 'cancelled'
  created_at: string
}

/* ── Wave 1: Reports (Phase 08) ─────────────────────────── */
export interface Report {
  id: string
  agency_id: string
  client_id: string
  title: string
  period_label: string | null
  description: string | null
  storage_path: string | null
  file_name: string | null
  mime_type: string | null
  size_bytes: number
  is_client_visible: boolean
  status: 'active' | 'archived'
  internal_notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface Notification {
  id: string
  agency_id: string
  recipient_profile_id: string
  client_id: string | null
  type: string
  title: string
  body: string | null
  entity_type: string | null
  entity_id: string | null
  is_read: boolean
  created_at: string
}

/* ── Wave 2: Team & Permissions ─────────────────────────── */
export interface PermissionSet {
  id: string; agency_id: string; name: string; description: string | null
  is_preset: boolean; permissions: Record<string, string[]>
  created_at: string; updated_at: string
}
export type TeamMemberStatus = 'invited' | 'active' | 'deactivated'
export interface TeamMembership {
  id: string; agency_id: string; profile_id: string; title: string | null
  status: TeamMemberStatus; permission_set_id: string | null
  overrides: Record<string, unknown>; created_at: string; updated_at: string
}
export type TeamInviteStatus = 'pending' | 'accepted' | 'expired' | 'revoked'
export interface TeamInvitation {
  id: string; agency_id: string; email: string; role: UserRole; title: string | null
  permission_set_id: string | null; token: string; status: TeamInviteStatus
  invited_by: string | null; expires_at: string | null; accepted_at: string | null; created_at: string
}

/* ── Wave 2: Pipeline & Leads ───────────────────────────── */
export interface PipelineStage {
  id: string; agency_id: string; name: string; sort_order: number; probability: number; is_default: boolean
}
export type LeadStatus = 'open' | 'won' | 'lost' | 'archived'
export interface Lead {
  id: string; agency_id: string; name: string | null; business_name: string
  email: string | null; phone: string | null; website: string | null; source: string | null
  status: LeadStatus; stage_id: string | null; estimated_value_cents: number
  owner_id: string | null; notes: string | null; converted_client_id: string | null
  created_by: string | null; updated_by: string | null; created_at: string; updated_at: string
}
export interface LeadNote { id: string; agency_id: string; lead_id: string; author_id: string | null; body: string; created_at: string }
export interface LeadActivity { id: string; agency_id: string; lead_id: string; actor_id: string | null; type: string; description: string | null; metadata: Record<string, unknown>; created_at: string }

/* ── Wave 2: Proposals & Contracts ──────────────────────── */
export type ProposalStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'declined' | 'expired' | 'archived'
export interface Proposal {
  id: string; agency_id: string; lead_id: string | null; client_id: string | null
  title: string; status: ProposalStatus; total_cents: number; version: number
  share_token: string | null; expires_at: string | null; sent_at: string | null
  viewed_at: string | null; decided_at: string | null; created_by: string | null
  created_at: string; updated_at: string
}
export interface ProposalSection { id: string; agency_id: string; proposal_id: string; kind: string; title: string; body: string | null; sort_order: number }
export interface ProposalLineItem {
  id: string; agency_id: string; proposal_id: string; service_id: string | null; package_id: string | null
  name: string; description: string | null; quantity: number; unit_price_cents: number
  billing_kind: 'one_time' | 'recurring'; sort_order: number
}
export type ContractStatus = 'draft' | 'sent' | 'signed' | 'declined' | 'expired' | 'archived'
export interface ContractTemplate { id: string; agency_id: string; name: string; body: string | null; is_default: boolean; created_at: string; updated_at: string }
export interface Contract {
  id: string; agency_id: string; proposal_id: string | null; lead_id: string | null; client_id: string | null
  template_id: string | null; title: string; body: string | null; status: ContractStatus
  share_token: string | null; sent_at: string | null; signed_at: string | null; expires_at: string | null
  created_by: string | null; created_at: string; updated_at: string
}
export interface ContractSignature { id: string; agency_id: string; contract_id: string; signer_name: string; signer_email: string | null; signature_text: string; is_client: boolean; signed_at: string }

/* ── Wave 2: Portal settings, messaging, requests ───────── */
export interface AgencyPortalSettings {
  id: string; agency_id: string; enable_messaging: boolean; enable_content_requests: boolean
  enable_file_uploads: boolean; enable_report_access: boolean; enable_invoice_access: boolean
  auto_approval: boolean; created_at: string; updated_at: string
}
export interface MessageThread { id: string; agency_id: string; client_id: string; subject: string | null; status: string; last_message_at: string | null; created_at: string }
export type MessageKind = 'chat' | 'email' | 'meeting_note' | 'announcement' | 'internal_note'
export interface Message { id: string; agency_id: string; client_id: string; thread_id: string; author_id: string | null; author_role: FileOwnerRole; body: string; kind: MessageKind; subject: string | null; is_client_visible: boolean; created_at: string }
export type RequestType = 'content' | 'file' | 'campaign' | 'strategy' | 'support' | 'meeting'
export type RequestStatus = 'submitted' | 'in_review' | 'in_progress' | 'waiting' | 'completed' | 'closed'
export interface ClientRequest {
  id: string; agency_id: string; client_id: string; type: RequestType; title: string; description: string | null
  status: RequestStatus; assignee_id: string | null; created_by: string | null; created_at: string; updated_at: string
}
export interface RequestComment { id: string; agency_id: string; client_id: string; request_id: string; author_id: string | null; author_role: FileOwnerRole; body: string; created_at: string }

/* ── Wave 3: Billing ────────────────────────────────────── */
export type InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'partially_paid' | 'paid' | 'overdue' | 'void' | 'archived'
export type PaymentMethod = 'credit_card' | 'ach' | 'bank_transfer' | 'manual'
export interface Invoice {
  id: string; agency_id: string; client_id: string; proposal_id: string | null
  number: string | null; title: string | null; status: InvoiceStatus; is_recurring: boolean; recurrence: string | null
  subtotal_cents: number; tax_cents: number; total_cents: number; amount_paid_cents: number; deposit_cents: number
  due_date: string | null; issued_at: string | null; paid_at: string | null; notes: string | null
  is_client_visible: boolean; created_at: string; updated_at: string
}
export interface InvoiceItem { id: string; agency_id: string; client_id: string; invoice_id: string; name: string; description: string | null; quantity: number; unit_price_cents: number; sort_order: number }
export interface Payment { id: string; agency_id: string; client_id: string; invoice_id: string | null; amount_cents: number; method: PaymentMethod; note: string | null; recorded_at: string }

/* ── Wave 3: Performance, KPIs, Calendar, Tasks ─────────── */
export interface ContentMetrics { id: string; agency_id: string; client_id: string; content_id: string; views: number; reach: number; engagement: number; clicks: number; likes: number; comments: number; shares: number; saves: number; recorded_at: string }
export type GoalStatus = 'on_track' | 'at_risk' | 'achieved' | 'missed'
export interface Goal {
  id: string; agency_id: string; client_id: string | null
  title: string; description: string | null
  target_value: number; current_value: number
  due_date: string | null; time_period: string | null
  status: GoalStatus; owner: string | null
  is_client_visible: boolean; is_archived: boolean; archived_at: string | null
  created_by: string | null; updated_by: string | null
  created_at: string; updated_at: string
}
export interface Kpi {
  id: string; agency_id: string; client_id: string | null
  name: string; description: string | null; metric_key: string | null
  target_value: number; current_value: number; unit: string | null; period: string
  goal_id: string | null; owner: string | null
  status: 'active' | 'needs_attention' | 'achieved' | 'inactive'
  is_client_visible: boolean; is_archived: boolean; archived_at: string | null
  created_by: string | null; updated_by: string | null
  created_at: string; updated_at: string
}

/* ── Wave 3 Strategy: Products & Services ───────────────── */
export type ProductType    = 'product' | 'service' | 'package' | 'membership' | 'subscription' | 'course' | 'program'
export type PricingType    = 'fixed' | 'range' | 'starting_at' | 'custom' | 'free'
export type ProductStatus  = 'active' | 'inactive' | 'seasonal' | 'discontinued'

export interface ClientProductService {
  id: string; agency_id: string; client_id: string
  name: string; type: ProductType; description: string | null
  target_audience: string | null; benefits: string[]
  pricing_type: PricingType; price_cents: number | null
  price_min_cents: number | null; price_max_cents: number | null
  price_label: string | null; status: ProductStatus
  seasonal_availability: string | null; include_in_ai_context: boolean
  sort_order: number
  primary_asset_id: string | null
  created_by: string | null; updated_by: string | null
  created_at: string; updated_at: string
}

/* ── Wave 3 Strategy: Market Intelligence ───────────────── */
export interface ClientCompetitor {
  id: string; agency_id: string; client_id: string
  name: string; website: string | null; description: string | null
  social_profiles: Record<string, string>
  strengths: string[]; weaknesses: string[]; notes: string | null
  ai_summary: string | null; ai_summary_generated_at: string | null
  created_by: string | null; updated_by: string | null
  created_at: string; updated_at: string
}

export interface MarketSWOT {
  strengths: string[]; weaknesses: string[]
  opportunities: string[]; threats: string[]
}

export interface MarketPosition {
  positioning_statement: string; differentiators: string[]
  white_space: string[]; industry_notes: string
}

/* ── Wave 3 Strategy: Discovery Notes ───────────────────── */
export type DiscoveryNoteSource = 'call' | 'meeting' | 'email' | 'document' | 'workshop' | 'other'

export interface DiscoveryNote {
  id: string; agency_id: string; client_id: string
  title: string; body: string
  source: DiscoveryNoteSource | null; author_id: string | null
  created_at: string; updated_at: string
}

/* ── Wave 3 Strategy: Brand JSONB Domains ───────────────── */
export interface BrandColor { hex: string; name: string; role: string }
export interface BrandFont  { name: string; role: string }

export interface BrandVisual {
  colors: BrandColor[]
  fonts: BrandFont[]
  photo_style: string
  logo_ids: { primary: string | null; secondary: string | null; icon: string | null }
}

export interface BrandVoiceDomain {
  voice_descriptor: string
  tone_guidelines: string
  approved_language: string[]
  prohibited_language: string[]
  writing_example: string
}

export interface BrandStrategyDomain {
  mission: string; vision: string; values: string[]
  positioning: string; uvp: string; taglines: string[]
  approved_messaging: string[]; hashtags: string[]; keywords: string[]
}

/* ── Wave 3 Strategy: Discovery JSONB Domains ───────────── */
export interface DiscoveryBusiness {
  challenges: string; priorities: string; business_model: string
  revenue_model: string; seasonality: string
  operational_constraints: string; service_area: string; customer_journey: string
}

export interface DiscoveryAudience {
  primary_audience: string; segments: string; demographics: string
  psychographics: string; pain_points: string; motivations: string
  objections: string; buying_triggers: string
}

export interface DiscoveryMarketing {
  current_channels: string; past_performance: string; current_campaigns: string
  challenges: string; content_maturity: string; paid_media_history: string
  seo_maturity: string; conversion_process: string
}

export interface DiscoveryAISummary { summary: string; generated_at: string }
export type CalendarEventType = 'content' | 'discovery_call' | 'client_meeting' | 'internal_meeting' | 'deadline' | 'invoice_due' | 'proposal_expiration' | 'task'
export interface CalendarEvent { id: string; agency_id: string; client_id: string | null; title: string; type: CalendarEventType; start_at: string | null; end_at: string | null; all_day: boolean; is_client_visible: boolean; content_id: string | null; assigned_to: string[]; notes: string | null; created_at: string }
export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'
export interface Task { id: string; agency_id: string; client_id: string | null; title: string; description: string | null; status: TaskStatus; priority: TaskPriority; due_date: string | null; assigned_to: string | null; created_by: string | null; created_at: string; updated_at: string }

/* ── Email Messaging Phase 1 ────────────────────────────── */
export interface AgencyEmailSettings {
  id: string
  agency_id: string
  sender_name: string
  reply_to_email: string | null
  email_signature: string | null
  email_mode: 'shared' | 'custom'
  sending_enabled: boolean
  custom_sender_email: string | null
  custom_domain_status: string | null
  created_at: string
  updated_at: string
}

export type EmailMessageStatus = 'draft' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed'

export interface EmailMessage {
  id: string
  agency_id: string
  client_id: string | null
  contact_id: string | null
  to_email: string
  to_name: string | null
  from_email: string
  from_name: string | null
  subject: string
  body_html: string | null
  body_text: string | null
  provider_message_id: string | null
  status: EmailMessageStatus
  opened_at: string | null
  clicked_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface EmailEvent {
  id: string
  agency_id: string
  email_message_id: string
  provider: string
  event_type: string
  event_payload: Record<string, unknown>
  occurred_at: string
  created_at: string
}

/* ── Wave 4 Business Workspace: Retainers ───────────────── */
export type RetainerStatus    = 'active' | 'paused' | 'completed' | 'cancelled'
export type RetainerFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annually' | 'custom'

export interface Retainer {
  id: string
  agency_id: string
  client_id: string
  title: string
  description: string | null
  status: RetainerStatus
  frequency: RetainerFrequency
  amount_cents: number
  start_date: string | null
  end_date: string | null
  next_billing_date: string | null
  is_auto_renew: boolean
  notes: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

/* ── Wave 4: AI & Automation ────────────────────────────── */
export interface AiResult { captions: string[]; hooks: string[]; hashtags: string[]; ideas: string[]; creative_direction: string; visual_suggestions: string[] }
export interface AiGeneration { id: string; agency_id: string; client_id: string | null; actor_id: string | null; kind: string; model: string | null; brief: Record<string, unknown>; result: Record<string, unknown>; created_at: string }
export interface AiPromptTemplate { id: string; agency_id: string; name: string; kind: string; template: string; created_at: string }
export interface AiSavedOutput { id: string; agency_id: string; client_id: string | null; generation_id: string | null; title: string; content: Record<string, unknown>; created_at: string }
export type AutomationTrigger = 'date' | 'status' | 'manual'
export interface Automation { id: string; agency_id: string; name: string; description: string | null; trigger_type: AutomationTrigger; trigger_config: Record<string, unknown>; action_type: string; action_config: Record<string, unknown>; is_active: boolean; created_at: string; updated_at: string }
export interface AutomationRun { id: string; agency_id: string; automation_id: string; status: 'success' | 'failed' | 'retrying'; attempt: number; error: string | null; created_at: string }
