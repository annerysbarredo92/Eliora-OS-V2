import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useClients } from '@/features/clients/hooks'
import { useAgencyFiles } from '@/features/files/hooks'
import { uploadFile, setFileVisible, deleteFile, downloadFile, createFolder } from '@/features/files/api'
import { formatBytes } from '@/lib/storage'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ActionMenu } from '@/components/ui/Menu'
import { UploadButton } from '@/components/ui/UploadButton'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'

type Ctx = { agencyId: string; clientId: string; actorId: string; role: 'agency' }

export function AgencyFiles() {
  const { profile } = useAuth()
  const { clients } = useClients()
  const [clientId, setClientId] = useState('')
  const [folderFilter, setFolderFilter] = useState<string>('all')
  const [newFolder, setNewFolder] = useState(false)
  const [folderName, setFolderName] = useState('')

  useEffect(() => { if (!clientId && clients.length) setClientId(clients[0].id) }, [clients, clientId])

  const { folders, files, loading, error, refresh } = useAgencyFiles(clientId || undefined)
  const ctx: Ctx | null = profile?.agency_id && profile?.id && clientId
    ? { agencyId: profile.agency_id, clientId, actorId: profile.id, role: 'agency' } : null

  const shown = folderFilter === 'all' ? files : files.filter(f => f.folder_id === folderFilter)
  const folderName_ = (id: string | null) => folders.find(f => f.id === id)?.name ?? '—'

  async function handleUpload(file: File) { if (ctx) { await uploadFile(file, { folderId: folderFilter === 'all' ? null : folderFilter, isClientVisible: true }, ctx); await refresh() } }
  async function handleCreateFolder() { if (ctx && folderName.trim()) { await createFolder(folderName, ctx); setFolderName(''); setNewFolder(false); await refresh() } }

  return (
    <div className="animate-fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 22, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--ink)', marginBottom: 4 }}>Files & Deliverables</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Upload and share brand assets and deliverables with each client.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {clients.length > 0 && <div style={{ width: 200 }}><Select value={clientId} onChange={e => setClientId(e.target.value)} options={clients.map(c => ({ value: c.id, label: c.business_name }))} /></div>}
          {ctx && <UploadButton onUpload={handleUpload} label="Upload" />}
        </div>
      </div>

      {clients.length === 0 ? (
        <EmptyBox title="No clients yet" sub="Add a client first to manage their files." />
      ) : (
        <>
          {/* Folders */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
            <FolderChip label="All" active={folderFilter === 'all'} onClick={() => setFolderFilter('all')} />
            {folders.map(f => <FolderChip key={f.id} label={f.name} active={folderFilter === f.id} onClick={() => setFolderFilter(f.id)} />)}
            <button onClick={() => setNewFolder(true)} style={{ padding: '7px 12px', borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', border: '1px dashed var(--hairline)', background: 'transparent', color: 'var(--violet)' }}>+ Folder</button>
          </div>

          {error && <div style={{ fontSize: 13.5, color: 'var(--danger)', background: 'var(--danger-bg)', padding: '14px 16px', borderRadius: 14, marginBottom: 16 }}>{error} — make sure Wave 1 SQL has been run and Storage is enabled.</div>}

          {loading ? <Skel /> : shown.length === 0 ? (
            <EmptyBox title="No files here" sub="Upload brand assets, photos, or deliverables for this client." />
          ) : (
            <div style={{ background: 'var(--surface)', backdropFilter: 'blur(22px) saturate(1.5)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-glass)', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ textAlign: 'left', color: 'var(--muted)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  {['Name', 'Folder', 'Size', 'Owner', 'Shared', ''].map(h => <th key={h} style={{ padding: '11px 14px', fontWeight: 700, borderBottom: '1px solid var(--hairline-2)', whiteSpace: 'nowrap' }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {shown.map(f => (
                    <tr key={f.id}>
                      <td style={cell}><span style={{ fontWeight: 600, color: 'var(--ink)' }}>{f.name}</span></td>
                      <td style={{ ...cell, color: 'var(--ink-2)' }}>{folderName_(f.folder_id)}</td>
                      <td style={{ ...cell, color: 'var(--muted)' }}>{formatBytes(f.size_bytes)}</td>
                      <td style={cell}><Badge variant={f.owner_role === 'client' ? 'brand' : 'default'}>{f.owner_role === 'client' ? 'Client' : 'Agency'}</Badge></td>
                      <td style={cell}><Badge variant={f.is_client_visible ? 'success' : 'default'}>{f.is_client_visible ? 'Shared' : 'Private'}</Badge></td>
                      <td style={cell}>
                        <ActionMenu items={[
                          { label: 'Download', onClick: () => ctx && downloadFile(f, ctx) },
                          { label: f.is_client_visible ? 'Unshare' : 'Share with client', onClick: () => ctx && setFileVisible(f, !f.is_client_visible, ctx).then(refresh) },
                          { label: 'Delete', onClick: () => ctx && deleteFile(f, ctx).then(refresh), danger: true, dividerBefore: true },
                        ]} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <Modal open={newFolder} onClose={() => setNewFolder(false)} title="New folder" width={420}
        footer={<><Button variant="ghost" onClick={() => setNewFolder(false)}>Cancel</Button><Button variant="primary" onClick={handleCreateFolder} disabled={!folderName.trim()}>Create</Button></>}>
        <Input label="Folder name" value={folderName} onChange={e => setFolderName(e.target.value)} placeholder="Campaign assets" autoFocus />
      </Modal>
    </div>
  )
}

const cell: React.CSSProperties = { padding: '11px 14px', borderBottom: '1px solid var(--hairline-2)', verticalAlign: 'middle' }

function FolderChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return <button onClick={onClick} style={{ padding: '7px 13px', borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap', border: '1px solid', borderColor: active ? 'var(--violet)' : 'var(--hairline)', background: active ? 'var(--violet)' : 'var(--surface-solid)', color: active ? '#fff' : 'var(--ink-2)' }}>{label}</button>
}

function Skel() { return <div style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>{[0, 1, 2].map(i => <div key={i} style={{ height: 38, borderRadius: 12, background: 'var(--lavender-soft)', opacity: 0.5 }} />)}</div> }
function EmptyBox({ title, sub }: { title: string; sub: string }) { return <div style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-glass)', padding: '44px 24px', textAlign: 'center' }}><p style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 7 }}>{title}</p><p style={{ fontSize: 13.5, color: 'var(--muted)' }}>{sub}</p></div> }
