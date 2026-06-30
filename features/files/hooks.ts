import { useCallback, useEffect, useState } from 'react'
import { ensureFolders, listFolders, listAgencyFiles, listClientFiles, listFileRequests } from './api'
import type { AssetFolder, ClientAsset, FileRequest } from '@/types'

export function useAgencyFiles(clientId: string | null | undefined) {
  const [folders, setFolders] = useState<AssetFolder[]>([])
  const [files, setFiles] = useState<ClientAsset[]>([])
  const [requests, setRequests] = useState<FileRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!clientId) { setLoading(false); return }
    try {
      setError(null)
      const [fo, fi, rq] = await Promise.all([listFolders(clientId), listAgencyFiles(clientId), listFileRequests(clientId)])
      setFolders(fo); setFiles(fi); setRequests(rq)
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load files') }
    finally { setLoading(false) }
  }, [clientId])

  useEffect(() => {
    let active = true
    async function init() { if (clientId) await ensureFolders(clientId); if (active) await refresh() }
    init()
    return () => { active = false }
  }, [clientId, refresh])

  return { folders, files, requests, loading, error, refresh }
}

export function useClientFiles(clientId: string | null | undefined) {
  const [folders, setFolders] = useState<AssetFolder[]>([])
  const [files, setFiles] = useState<ClientAsset[]>([])
  const [requests, setRequests] = useState<FileRequest[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!clientId) { setLoading(false); return }
    const [fo, fi, rq] = await Promise.all([listFolders(clientId), listClientFiles(), listFileRequests(clientId)])
    setFolders(fo); setFiles(fi); setRequests(rq)
    setLoading(false)
  }, [clientId])

  useEffect(() => {
    let active = true
    async function init() { if (clientId) await ensureFolders(clientId); if (active) await refresh() }
    init()
    return () => { active = false }
  }, [clientId, refresh])

  return { folders, files, requests, loading, refresh }
}
