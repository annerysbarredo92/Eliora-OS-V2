import type {
  OnboardingTemplate, OnboardingSection, OnboardingProgress,
  OnboardingRequiredItem, OnboardingStatus, OnboardingMissingItem,
} from '@/types'

/** A response value counts as "answered" when it has real content. */
export function isAnswered(value: unknown): boolean {
  if (value == null) return false
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'number') return true
  return String(value).trim().length > 0
}

export function dataSections(template: OnboardingTemplate | null): OnboardingSection[] {
  return (template?.sections ?? []).filter(s => s.key !== 'review').sort((a, b) => a.sort_order - b.sort_order)
}

export interface ComputedProgress {
  sections: Record<string, boolean>
  completion_pct: number
  total_sections: number
  completed_sections: number
  missing_items: OnboardingMissingItem[]
  status: OnboardingStatus
}

/**
 * Compute progress from real saved data:
 *  - section completed = explicitly saved AND all its required questions answered
 *  - completion % = completed sections / total data sections
 *  - missing = required questions unanswered + required asset items not provided
 */
export function computeProgress(
  template: OnboardingTemplate | null,
  responses: Record<string, unknown>,      // question_id -> value
  requiredItems: OnboardingRequiredItem[],
  savedSections: Record<string, boolean>,
  submitting = false,
): ComputedProgress {
  const sections = dataSections(template)
  const total = sections.length

  // section completion from saved flags
  const completedMap: Record<string, boolean> = {}
  for (const s of sections) completedMap[s.key] = savedSections[s.key] === true
  const completed = sections.filter(s => completedMap[s.key]).length

  // missing items
  const missing: OnboardingMissingItem[] = []
  for (const s of sections) {
    for (const q of s.questions) {
      if (q.is_required && !isAnswered(responses[q.id])) {
        missing.push({ section: s.title, label: q.label })
      }
    }
  }
  for (const item of requiredItems) {
    if (!item.is_provided) missing.push({ section: 'Asset Uploads', label: item.label })
  }

  const pct = total === 0 ? 0 : Math.round((completed / total) * 100)

  let status: OnboardingStatus
  if (submitting) status = 'submitted'
  else if (completed === total && total > 0) status = 'completed'
  else if (completed > 0 || Object.values(responses).some(isAnswered)) status = 'in_progress'
  else status = 'not_started'

  return { sections: completedMap, completion_pct: pct, total_sections: total, completed_sections: completed, missing_items: missing, status }
}

export function allRequiredAnswered(section: OnboardingSection, responses: Record<string, unknown>): boolean {
  return section.questions.filter(q => q.is_required).every(q => isAnswered(responses[q.id]))
}

export function statusLabel(status: OnboardingStatus): string {
  return { not_started: 'Not started', in_progress: 'In progress', completed: 'Completed', submitted: 'Submitted' }[status]
}

export function statusBadge(status: OnboardingStatus): 'default' | 'info' | 'success' | 'brand' {
  return { not_started: 'default', in_progress: 'info', completed: 'success', submitted: 'brand' }[status] as
    'default' | 'info' | 'success' | 'brand'
}

/** Stored progress -> ComputedProgress fallback shape for read-only views. */
export function readProgress(p: OnboardingProgress | null): {
  pct: number; status: OnboardingStatus; missing: OnboardingMissingItem[]; completed: number; total: number; lastSaved: string | null
} {
  return {
    pct: p?.completion_pct ?? 0,
    status: p?.status ?? 'not_started',
    missing: p?.missing_items ?? [],
    completed: p?.completed_sections ?? 0,
    total: p?.total_sections ?? 0,
    lastSaved: p?.last_saved_at ?? null,
  }
}
