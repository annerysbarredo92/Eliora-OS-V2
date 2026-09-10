import { supabase } from '@/lib/supabase'

// Provider-neutral frontend API layer for Digital Integrations. Never
// queries integration_credentials or integration_oauth_states directly —
// both are default-deny to every browser role (see the Wave 5 migration
// files) and are only ever touched server-side by the Edge Functions.
// Only safe connection/resource metadata is read here.

export type IntegrationProvider = 'meta' | 'google'

/** Which kind of authorization URL to request -- see AuthorizationMode in
 * supabase/functions/_shared/integrations/core.ts for the full
 * per-provider semantics. Google Phase 1 Slice A is the first provider
 * to use anything other than the default: 'reconnect' deliberately
 * forces a full Google consent screen to re-obtain a refresh token;
 * 'initial' (the default) and 'incremental' do not. Meta ignores this
 * entirely (its adapter's getAuthorizationUrl only reads `state`). */
export type AuthorizationMode = 'initial' | 'incremental' | 'reconnect'

export interface IntegrationConnection {
  id: string
  /** NULL for an agency-scoped connection (Google) -- the connection
   * belongs to the agency, not one client. See ConnectionScope in
   * supabase/functions/_shared/integrations/core.ts. */
  client_id: string | null
  provider: IntegrationProvider
  provider_account_id: string | null
  provider_account_name: string | null
  status: 'connected' | 'needs_reconnect' | 'error' | 'disconnected'
  scopes: string[]
  connected_at: string
  last_synced_at: string | null
  last_error_code: string | null
  last_error_message: string | null
  disconnected_at: string | null
}

export interface IntegrationResource {
  id: string
  connection_id: string
  client_id: string | null
  resource_type: 'facebook_page' | 'instagram_business_account' | 'ga4_property' | 'search_console_site'
  external_resource_id: string
  name: string | null
  handle: string | null
  profile_url: string | null
  linked_channel_id: string | null
  link_status: 'unlinked' | 'linked' | 'conflict'
}

/**
 * Starts a provider OAuth connection for `clientId` and returns the
 * provider's authorization URL — never a token, never a secret. The
 * caller is expected to do a full-page navigation to the returned URL
 * (see SocialChannelsSection.tsx's "Connect Meta" action, and
 * TrackingSection.tsx's "Connect Google"/"Reconnect Google" actions)
 * rather than open a popup — this app has no existing popup/postMessage
 * precedent, and a full-page redirect is the simplest reliable flow
 * (Wave 5 Slice 2 spec §27: "reliability > polish").
 *
 * `mode` is optional and provider-specific in effect (see
 * AuthorizationMode above) — omit it for the default 'initial' behavior.
 */
export async function startIntegrationOAuth(
  clientId: string,
  provider: IntegrationProvider = 'meta',
  mode?: AuthorizationMode,
): Promise<string> {
  const returnPath = provider === 'google'
    ? `/agency/projects/${clientId}?tab=digital&dsection=tracking`
    : `/agency/projects/${clientId}?tab=digital&dsection=social-channels`
  const { data, error } = await supabase.functions.invoke('integration-oauth-start', {
    body: { client_id: clientId, provider, return_path: returnPath, ...(mode ? { mode } : {}) },
  })
  if (error) throw new Error('Could not start the connection. Please try again.')
  if (data?.error) throw new Error(data.error.message ?? 'Could not start the connection.')
  if (!data?.authorization_url) throw new Error('No authorization URL was returned.')
  return data.authorization_url as string
}

/** Safe connection metadata only — no credentials. Client-scoped
 * connections only (client_id = clientId) — this never finds an
 * agency-scoped (Google) connection, by design: `.eq('client_id', X)`
 * cannot match a NULL column. Use listAgencyIntegrationConnections for
 * those. RLS (agency_id = current_agency_id()) remains the actual tenant
 * security boundary regardless of which filter is used here.
 *
 * `provider` is optional and additive (Meta reconciliation) — every
 * existing call site predates it and keeps working unfiltered; pass it
 * when the caller cares about exactly one provider's connections, as
 * SocialChannelsSection does for 'meta' — 01-integration-connections.sql
 * deliberately allows more than one connection per client, so this can
 * return several rows even for a single provider. */
export async function listIntegrationConnections(clientId: string, provider?: IntegrationProvider): Promise<IntegrationConnection[]> {
  let q = supabase.from('integration_connections').select('*').eq('client_id', clientId)
  if (provider) q = q.eq('provider', provider)
  const { data, error } = await q.order('connected_at', { ascending: false })
  if (error) { console.error('listIntegrationConnections:', error.message); throw new Error(error.message) }
  return (data ?? []) as IntegrationConnection[]
}

/** Safe connection metadata only — no credentials. Agency-scoped
 * connections only (client_id IS NULL) for one provider — this is how
 * the frontend finds a Google connection, since it has no single owning
 * client. `agencyId` is used purely as a query-narrowing convenience
 * (the caller's own agency, already available from ctx) — RLS (agency_id
 * = current_agency_id()) is the real, session-based tenant security
 * boundary; this filter cannot be used to see another agency's rows
 * regardless of what value is passed. */
export async function listAgencyIntegrationConnections(agencyId: string, provider: IntegrationProvider): Promise<IntegrationConnection[]> {
  const { data, error } = await supabase
    .from('integration_connections').select('*')
    .eq('agency_id', agencyId).eq('provider', provider).is('client_id', null)
    .order('connected_at', { ascending: false })
  if (error) { console.error('listAgencyIntegrationConnections:', error.message); throw new Error(error.message) }
  return (data ?? []) as IntegrationConnection[]
}

/** Discovered provider resources for one connection — used to show a
 * truthful count ("X resources discovered") right after a successful
 * connect, before the user has looked at (or linked) any of them. */
export async function listIntegrationResources(connectionId: string): Promise<IntegrationResource[]> {
  const { data, error } = await supabase
    .from('integration_resources').select('*').eq('connection_id', connectionId)
    .order('discovered_at', { ascending: true })
  if (error) { console.error('listIntegrationResources:', error.message); throw new Error(error.message) }
  return (data ?? []) as IntegrationResource[]
}

/** Every discovered resource for this client + provider, across however
 * many connections exist (01-integration-connections.sql deliberately
 * allows more than one) — unlinked and linked alike. This is what powers
 * the actual resource-selection UI (Meta reconciliation, Phase 6/7):
 * SocialChannelsSection filters this to link_status = 'unlinked' for the
 * "select a Page/Instagram account to import" list, and to 'linked' to
 * show what a channel is already backed by. */
export async function listClientIntegrationResources(clientId: string, provider: IntegrationProvider): Promise<IntegrationResource[]> {
  const { data, error } = await supabase
    .from('integration_resources').select('*').eq('client_id', clientId).eq('provider', provider)
    .order('discovered_at', { ascending: true })
  if (error) { console.error('listClientIntegrationResources:', error.message); throw new Error(error.message) }
  return (data ?? []) as IntegrationResource[]
}

/**
 * Explicitly links one discovered, unlinked resource into social_channels
 * — the Phase 6/7 "no silent auto-linking" flow. Two modes:
 *   - `target.mode === 'existing'`: attach to an already-manually-created
 *     channel. Only allowed when that channel has no external_account_id
 *     yet, or already has exactly this resource's external_resource_id
 *     (an idempotent re-link) — anything else is a genuine identity
 *     ambiguity (Phase 6: "do not merge by display name / handle alone")
 *     and is rejected here, client-side, with a clear message, before
 *     ever reaching the database (though the deployed
 *     check_integration_resource_tenant_match trigger's Direction A/B
 *     logic is the real, authoritative backstop either way — see
 *     02-integration-resources.sql).
 *   - `target.mode === 'new'`: create a brand-new social_channels row
 *     from the resource's own discovered metadata (name/handle/profile
 *     URL become the channel's initial values — a starting point, not a
 *     lock; the user can still edit them normally afterward).
 *
 * Sequenced as channel-write-then-resource-write (not a single
 * transaction — PostgREST does not expose one to the browser): if the
 * second write fails after the first succeeds, the channel exists but
 * the resource is simply not yet marked linked, which is safely
 * retryable (re-running this function again is idempotent for the
 * 'existing' branch, and for 'new' the caller should pass `target.mode:
 * 'existing'` with the just-created channel's id on retry).
 *
 * Cross-client/cross-agency linking is impossible by construction here
 * (clientId is the resource's own client_id, never taken from the
 * browser independently) and is additionally enforced by RLS + the
 * deployed tenant-match trigger.
 */
export type LinkResourceTarget =
  | { mode: 'existing'; channelId: string }
  | { mode: 'new' }

export async function linkIntegrationResource(
  resource: IntegrationResource,
  target: LinkResourceTarget,
  ctx: { agencyId: string; actorId: string },
): Promise<{ channelId: string }> {
  if (!resource.client_id) throw new Error('This resource has no owning client yet and cannot be linked.')
  const platform = resource.resource_type === 'instagram_business_account' ? 'instagram' : 'facebook'

  let channelId: string
  if (target.mode === 'existing') {
    const { data: channel, error: chErr } = await supabase
      .from('social_channels').select('id, external_account_id').eq('id', target.channelId).single()
    if (chErr || !channel) throw new Error('Channel not found.')
    if (channel.external_account_id && channel.external_account_id !== resource.external_resource_id) {
      throw new Error('This channel is already linked to a different external account — link this resource to a new channel instead, or unlink the existing one first.')
    }
    const { error: updateErr } = await supabase.from('social_channels').update({
      external_account_id: resource.external_resource_id,
      integration_status: 'connected',
      updated_by: ctx.actorId,
    }).eq('id', target.channelId)
    if (updateErr) throw new Error(updateErr.message)
    channelId = target.channelId
  } else {
    const { data: created, error: createErr } = await supabase.from('social_channels').insert({
      agency_id: ctx.agencyId, client_id: resource.client_id,
      platform, handle: resource.handle, profile_url: resource.profile_url,
      external_account_id: resource.external_resource_id,
      ownership_status: 'unknown', integration_status: 'connected', is_active: true,
      created_by: ctx.actorId, updated_by: ctx.actorId,
    }).select('id').single()
    if (createErr || !created) throw new Error(createErr?.message ?? 'Failed to create channel.')
    channelId = created.id
  }

  const { error: linkErr } = await supabase.from('integration_resources').update({
    linked_channel_id: channelId, link_status: 'linked',
  }).eq('id', resource.id)
  if (linkErr) throw new Error(linkErr.message)

  return { channelId }
}

/** Runs (or re-runs) a Meta metrics sync for every linked Meta resource
 * belonging to this client, or — when `resourceId` is passed — just the
 * one resource (used right after linkIntegrationResource, per Phase 9's
 * "initial sync after explicit linkage"). Metrics land in
 * social_channel_snapshots with source = 'integration'; unsupported/
 * deprecated/unavailable fields are left null by the Edge Function's own
 * verified v26.0 metric mapping (meta.ts) — never a fabricated 0. */
export async function syncMetaResources(clientId: string, resourceId?: string): Promise<{ synced: number; failed: number }> {
  const { data, error } = await supabase.functions.invoke('integration-meta-sync', {
    body: { client_id: clientId, ...(resourceId ? { resource_id: resourceId } : {}) },
  })
  if (error) throw new Error('Could not run the sync. Please try again.')
  if (data?.error) throw new Error(data.error.message ?? 'Could not run the sync.')
  return { synced: data?.synced ?? 0, failed: data?.failed ?? 0 }
}

/** Disconnects a connection (any provider) — marks it disconnected and
 * best-effort removes its Vault-stored credentials server-side. Never
 * touches integration_resources, social_channels, or
 * social_channel_snapshots (Phase 10: history and linkage survive
 * disconnect). */
export async function disconnectIntegrationConnection(connectionId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('integration-disconnect', {
    body: { connection_id: connectionId },
  })
  if (error) throw new Error('Could not disconnect. Please try again.')
  if (data?.error) throw new Error(data.error.message ?? 'Could not disconnect.')
}

/** Maps the callback's safe `reason` query param to user-facing copy —
 * never the raw provider error. */
export const OAUTH_FAILURE_REASON_LABELS: Record<string, string> = {
  authorization_denied: 'Meta authorization was cancelled or denied.',
  missing_code: 'Meta did not return an authorization code. Please try again.',
  token_exchange_failed: 'Meta could not verify the authorization. Please try again.',
  identity_resolution_failed: 'Could not verify the connected Meta account. Please try again.',
  resource_discovery_failed: 'Connected, but could not look up Facebook Pages / Instagram accounts yet. You can try again from here.',
  invalid_request: 'This connection request was invalid. Please start again.',
  invalid_state: 'This connection link has expired or was already used. Please start again.',
}

/**
 * Same purpose as OAUTH_FAILURE_REASON_LABELS above, but provider-neutral
 * — Meta's map is left untouched (its wording and call sites are
 * unchanged) since it hardcodes "Meta" in the copy. Google's Slice A
 * "Connect Google" action (TrackingSection.tsx) uses this one instead so
 * a Google failure is never described with Meta's product name. Reasons
 * not specific to Google (e.g. resource_discovery_failed, which Slice A
 * can never actually produce — Google's adapter does not implement
 * discovery yet) are included anyway for forward compatibility with
 * later slices, without being reachable today.
 */
export function googleOauthFailureMessage(reason: string | null): string {
  switch (reason) {
    case 'authorization_denied': return 'Google authorization was cancelled or denied.'
    case 'missing_code': return 'Google did not return an authorization code. Please try again.'
    case 'token_exchange_failed': return 'Google could not verify the authorization. Please try again.'
    case 'identity_resolution_failed': return 'Could not verify the connected Google account. Please try again.'
    case 'credential_storage_failed': return 'Connected, but the credential could not be saved securely. Please try again.'
    case 'resource_discovery_failed': return 'Connected, but a follow-up step could not complete. You can try again from here.'
    case 'provider_unavailable': return 'Google is not available right now. Please try again later.'
    case 'invalid_request': return 'This connection request was invalid. Please start again.'
    case 'invalid_state': return 'This connection link has expired or was already used. Please start again.'
    default: return 'The Google connection could not be completed.'
  }
}
