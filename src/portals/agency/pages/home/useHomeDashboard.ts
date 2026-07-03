import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useClients } from '@/features/clients/hooks'
import { useActivity } from '@/features/activity/hooks'
import { useSetup } from '@/features/operations/hooks'
import { listInvoices, computeBillingMetrics, getMonthlyRevenue } from '@/features/billing/api'
import { getPipelineSummary } from '@/features/projects/api'
import { listAgencyContent } from '@/features/content/api'
import { listTasks, listEvents } from '@/features/tasks/api'
import { listRequests } from '@/features/requests/api'
import { listProposals } from '@/features/proposals/api'
import { getTodaysBrief } from '@/features/ai/api'
import type { Invoice, ContentItem, Task, CalendarEvent, Proposal, ClientRequest, AiGeneration } from '@/types'
import type { BillingMetrics } from '@/features/billing/api'
import type { StageSummary } from '@/features/projects/api'

export interface HomeDashboardData {
  invoices:        Invoice[]
  content:         ContentItem[]
  tasks:           Task[]
  events:          CalendarEvent[]
  requests:        ClientRequest[]
  proposals:       Proposal[]
  pipelineSummary: StageSummary[]
  todaysBrief:     AiGeneration | null
  monthlyRevenue:  number
  billingMetrics:  BillingMetrics
  loading:         boolean
  error:           string | null
  refresh:         () => void
}

const EMPTY_METRICS: BillingMetrics = { monthly: 0, outstanding: 0, collected: 0, overdue: 0 }

export function useHomeDashboard() {
  const { profile } = useAuth()
  const clientsState = useClients()
  const activity     = useActivity({ limit: 8 })
  const setup        = useSetup(profile?.agency_id ?? null)

  const [data, setData] = useState<Omit<HomeDashboardData, 'loading' | 'error' | 'refresh'>>({
    invoices: [], content: [], tasks: [], events: [], requests: [],
    proposals: [], pipelineSummary: [], todaysBrief: null,
    monthlyRevenue: 0, billingMetrics: EMPTY_METRICS,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const load = useCallback(async () => {
    const agencyId = profile?.agency_id
    if (!agencyId) return
    setLoading(true)
    setError(null)
    try {
      const [invoices, content, tasks, events, requests, proposals, pipelineSummary, todaysBrief, monthlyRevenue] =
        await Promise.all([
          listInvoices(),
          listAgencyContent(),
          listTasks(),
          listEvents(),
          listRequests(),
          listProposals(),
          getPipelineSummary(agencyId),
          getTodaysBrief(),
          getMonthlyRevenue(),
        ])
      setData({
        invoices, content, tasks, events, requests, proposals,
        pipelineSummary, todaysBrief, monthlyRevenue,
        billingMetrics: computeBillingMetrics(invoices),
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }, [profile?.agency_id])

  useEffect(() => { load() }, [load])

  // Refresh when returning to the tab, debounced 500ms
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden) {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(load, 500)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [load])

  return {
    ...data,
    clients:       clientsState.clients,
    clientMetrics: clientsState.metrics,
    clientsLoading: clientsState.loading,
    refreshClients: clientsState.refresh,
    activity,
    setup,
    loading,
    error,
    refresh: load,
  }
}
