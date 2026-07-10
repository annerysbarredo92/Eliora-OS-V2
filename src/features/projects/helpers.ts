import type { Client } from '@/types'
import type { StageSummary } from './api'

export const STAGE_COLORS: Record<string, string> = {
  'New Inquiry / Lead': '#6D3DE6',
  'Discovery Call':     '#4F8EF7',
  'Proposal Sent':      '#F0A443',
  'Proposal Signed':    '#10B981',
  'Onboarding':         '#9258EE',
  'Client':             '#059669',
}

export type SortKey = 'name' | 'stage' | 'value' | 'activity'
export type SortDir = 'asc' | 'desc'

export function sortProjects(
  projects: Client[],
  key: SortKey | null,
  dir: SortDir,
  stageOrder: StageSummary[],
): Client[] {
  if (!key) return projects
  const factor = dir === 'asc' ? 1 : -1
  return [...projects].sort((a, b) => {
    switch (key) {
      case 'name':
        return factor * a.business_name.localeCompare(b.business_name)
      case 'stage': {
        const ai = stageOrder.findIndex(s => s.id === a.stage_id)
        const bi = stageOrder.findIndex(s => s.id === b.stage_id)
        return factor * ((ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi))
      }
      case 'value':
        return factor * ((a.project_value_cents ?? 0) - (b.project_value_cents ?? 0))
      case 'activity': {
        const at = a.last_activity_at ? new Date(a.last_activity_at).getTime() : 0
        const bt = b.last_activity_at ? new Date(b.last_activity_at).getTime() : 0
        return factor * (at - bt)
      }
      default:
        return 0
    }
  })
}
