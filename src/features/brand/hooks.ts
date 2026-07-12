import { useState, useEffect, useCallback } from 'react'
import type { Client, ClientAsset, BrandVisual } from '@/types'
import { getAssetById, getBrandSignedUrl, listBrandAssets } from './api'

export interface BrandAssets {
  primaryLogo: ClientAsset | null
  secondaryLogo: ClientAsset | null
  iconLogo: ClientAsset | null
  otherFiles: ClientAsset[]
  loading: boolean
  error: string | null
  refresh: () => void
}

function readLogoIds(client: Client): { primary: string | null; secondary: string | null; icon: string | null } {
  const dd = (client.discovery_data ?? {}) as Record<string, unknown>
  const bv = (dd.brand_visual ?? {}) as Partial<BrandVisual>
  return bv.logo_ids ?? { primary: null, secondary: null, icon: null }
}

export function useBrandAssets(client: Client): BrandAssets {
  const [primaryLogo, setPrimaryLogo] = useState<ClientAsset | null>(null)
  const [secondaryLogo, setSecondaryLogo] = useState<ClientAsset | null>(null)
  const [iconLogo, setIconLogo] = useState<ClientAsset | null>(null)
  const [otherFiles, setOtherFiles] = useState<ClientAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const refresh = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const logoIds = readLogoIds(client)
    const clientId = client.id

    async function load() {
      try {
        const [primary, secondary, icon, { files }] = await Promise.all([
          logoIds.primary ? getAssetById(logoIds.primary) : Promise.resolve(null),
          logoIds.secondary ? getAssetById(logoIds.secondary) : Promise.resolve(null),
          logoIds.icon ? getAssetById(logoIds.icon) : Promise.resolve(null),
          listBrandAssets(clientId),
        ])
        if (cancelled) return

        const logoIdSet = new Set([logoIds.primary, logoIds.secondary, logoIds.icon].filter(Boolean))
        setPrimaryLogo(primary)
        setSecondaryLogo(secondary)
        setIconLogo(icon)
        setOtherFiles(files.filter(f => !logoIdSet.has(f.id)))
      } catch (e) {
        if (!cancelled) setError((e as Error).message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [client, tick])

  return { primaryLogo, secondaryLogo, iconLogo, otherFiles, loading, error, refresh }
}

export function usePrimaryLogoUrl(client: Client): { url: string | null; loading: boolean } {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    const dd = (client.discovery_data ?? {}) as Record<string, unknown>
    const bv = (dd.brand_visual ?? {}) as Partial<BrandVisual>
    const primaryId = bv.logo_ids?.primary ?? null

    if (!primaryId) { setUrl(null); return }

    setLoading(true)
    getAssetById(primaryId).then(asset => {
      if (cancelled || !asset) return
      return getBrandSignedUrl(asset.storage_path).then(u => {
        if (!cancelled) setUrl(u)
      })
    }).catch(() => {
      if (!cancelled) setUrl(null)
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })

    return () => { cancelled = true }
  }, [client])

  return { url, loading }
}
