import { useCallback, useEffect, useState } from 'react'
import { listProducts } from './api'
import type { ClientProductService } from '@/types'

export function useProducts(clientId: string) {
  const [products, setProducts] = useState<ClientProductService[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setProducts(await listProducts(clientId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load products')
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => { load() }, [load])
  return { products, loading, error, refresh: load }
}
