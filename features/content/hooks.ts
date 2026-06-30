import { useCallback, useEffect, useState } from 'react'
import { listAgencyContent, listClientContent } from './api'
import type { ContentItem } from '@/types'

export function useAgencyContent(clientId?: string) {
  const [items, setItems] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try { setError(null); setItems(await listAgencyContent(clientId)) }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to load content') }
    finally { setLoading(false) }
  }, [clientId])

  useEffect(() => { refresh() }, [refresh])
  return { items, loading, error, refresh }
}

export function useClientContent() {
  const [items, setItems] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setItems(await listClientContent())
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])
  return { items, loading, refresh }
}
