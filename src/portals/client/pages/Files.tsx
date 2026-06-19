import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useClientFiles } from '@/features/files/hooks'
import { uploadFile, downloadFile } from '@/features/files/api'
import { formatBytes } from '@/lib/storage'
import { Badge } from '@/components/ui/Badge'
import { UploadButton } from '@/components/ui/UploadButton'

export function ClientFiles() {
  const { profile: user } = useAuth()
  const { folders, files, requests, loading, refresh } = useClientFiles(user?.client_id ?? null)
  const [folderFilter, setFolderFilter] = useState<string>('all')

  const ctx = user?.agency_id && user?.client_id && user?.id
    ? { agencyId: user.agency_id, clientId: user.client_id, actorId: user.id, role: 'client' as const } : null

  const shown = folderFilter === 'all' ? files : files.filter(f => f.folder_id === folderFilter)
  const folderName = (id: string | null) => folders.find(f => f.id === id)?.name ?? 'Files'
  const openRequests = requests.filter(r => r.status === 'open')

  async function handleUpload(file: File) { if (ctx) { await uploadFile(file, { folderId: null, isClientVisible: true }, ctx); await refresh() } }

  if (loading) return <div className="animate-fade-up"><div style={{ height: 300, borderRadius: 'var(--radius)', background: 'var(--lavender-soft)', opacity: 0.4 }} /></div>

  return (
    <div className="animate-fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 22, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--ink)', marginBottom: 4 }}>Files</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Files your team has shared with you, and assets you've uploaded.</p>
        </div>
        {ctx && <UploadButton onUpload={handleUpload} label="Upload a file" />}
      </div>

      {/* Requested assets */}
      {openRequests.length > 0 && (
        <div style={{ background: 'var(--lavender-soft)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: '14px 18px', marginBottom: 18 }}>
          <p style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--violet)', marginBottom: 8 }}>Requested from you</p>
          {openRequests.map(r => (
            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '6px 0' }}>
              <div><p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{r.title}</p>{r.description && <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>{r.description}</p>}</div>
              {ctx && <UploadButton onUpload={handleUpload} label="Upload" variant="outline" />}
            </div>
          ))}
        </div>
      )}

      {/* Folder filter */}
      {folders.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          <Chip label="All" active={folderFilter === 'all'} onClick={() => setFolderFilter('all')} />
          {folders.map(f => <Chip key={f.id} label={f.name} active={folderFilter === f.id} onClick={() => setFolderFilter(f.id)} />)}
        </div>
      )}

      {shown.length === 0 ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-glass)', padding: '44px 24px', textAlign: 'center' }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 7 }}>No files yet</p>
          <p style={{ fontSize: 13.5, color: 'var(--muted)' }}>Shared files and your uploads will appear here.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          {shown.map(f => (
            <div key={f.id} onClick={() => downloadFile(f, ctx ?? undefined)} style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)', padding: 16, cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--lavender-soft)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--violet)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>
                </div>
                {f.owner_role === 'client' && <Badge variant="brand">Yours</Badge>}
              </div>
              <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', wordBreak: 'break-word' }}>{f.name}</p>
              <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>{folderName(f.folder_id)} · {formatBytes(f.size_bytes)}</p>
              <p style={{ fontSize: 12, color: 'var(--violet)', fontWeight: 600, marginTop: 8 }}>Download ↓</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return <button onClick={onClick} style={{ padding: '7px 13px', borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap', border: '1px solid', borderColor: active ? 'var(--violet)' : 'var(--hairline)', background: active ? 'var(--violet)' : 'var(--surface-solid)', color: active ? '#fff' : 'var(--ink-2)' }}>{label}</button>
}
