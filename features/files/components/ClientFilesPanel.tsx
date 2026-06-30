import { useAgencyFiles } from '../hooks'
import { uploadFile, setFileVisible, deleteFile, downloadFile } from '../api'
import { formatBytes } from '@/lib/storage'
import { Badge } from '@/components/ui/Badge'
import { ActionMenu } from '@/components/ui/Menu'
import { UploadButton } from '@/components/ui/UploadButton'
import type { FilesCtx } from '../api'

/** Agency view of a single client's files, used inside the Client Profile. */
export function ClientFilesPanel({ ctx }: { ctx: FilesCtx }) {
  const { files, loading, error, refresh } = useAgencyFiles(ctx.clientId)

  async function handleUpload(file: File) { await uploadFile(file, { folderId: null, isClientVisible: true }, ctx); await refresh() }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 12 }}>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>Files and deliverables for this client.</p>
        <UploadButton onUpload={handleUpload} label="Upload" />
      </div>

      {error && <p style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 12 }}>{error}</p>}

      {loading ? <Skel /> : files.length === 0 ? (
        <p style={{ fontSize: 13.5, color: 'var(--muted)', padding: '24px 0', textAlign: 'center' }}>No files yet. Upload brand assets or deliverables.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {files.map(f => (
            <div key={f.id} style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 14, padding: '11px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{f.name}</p>
                <p style={{ fontSize: 12, color: 'var(--muted)' }}>{formatBytes(f.size_bytes)} · {f.owner_role === 'client' ? 'Client upload' : 'Agency'}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Badge variant={f.is_client_visible ? 'success' : 'default'}>{f.is_client_visible ? 'Shared' : 'Private'}</Badge>
                <ActionMenu items={[
                  { label: 'Download', onClick: () => downloadFile(f, ctx) },
                  { label: f.is_client_visible ? 'Unshare' : 'Share', onClick: () => setFileVisible(f, !f.is_client_visible, ctx).then(refresh) },
                  { label: 'Delete', onClick: () => deleteFile(f, ctx).then(refresh), danger: true, dividerBefore: true },
                ]} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Skel() { return <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[0, 1, 2].map(i => <div key={i} style={{ height: 44, borderRadius: 14, background: 'var(--lavender-soft)', opacity: 0.5 }} />)}</div> }
