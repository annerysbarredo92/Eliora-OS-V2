import { Modal } from '@/components/ui/Modal'

const PREVIEWS = [
  { title: 'Dashboard',     desc: 'Live metrics, recent activity, and setup progress.', accent: 'var(--violet)' },
  { title: 'Client Portal', desc: 'A premium portal your clients log into.',            accent: 'var(--iris)' },
  { title: 'Content Studio', desc: 'Plan, create, and approve content workflows.',      accent: 'var(--lilac)' },
  { title: 'Reports',       desc: 'Branded performance reports for every client.',       accent: 'var(--rose)' },
  { title: 'Invoices',      desc: 'Send invoices and track payments in one place.',      accent: 'var(--gold)' },
]

interface WorkspacePreviewModalProps {
  open: boolean
  onClose: () => void
}

export function WorkspacePreviewModal({ open, onClose }: WorkspacePreviewModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Workspace preview" subtitle="A glimpse of what your clients and team will use as Eliora grows." width={680}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 12 }}>
        {PREVIEWS.map(p => (
          <div key={p.title} style={{ border: '1px solid var(--hairline)', borderRadius: 16, overflow: 'hidden', background: 'var(--surface-solid)' }}>
            <div style={{ height: 78, background: `linear-gradient(135deg, ${p.accent}, transparent)`, position: 'relative' }}>
              <div style={{ position: 'absolute', inset: 0, opacity: 0.16, background: 'var(--irid)' }} />
              {/* faux UI lines */}
              <div style={{ position: 'absolute', left: 14, bottom: 12, right: 14, display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={{ height: 6, width: '55%', borderRadius: 4, background: 'rgba(255,255,255,0.85)' }} />
                <div style={{ height: 6, width: '80%', borderRadius: 4, background: 'rgba(255,255,255,0.55)' }} />
              </div>
            </div>
            <div style={{ padding: '12px 14px' }}>
              <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{p.title}</p>
              <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3, lineHeight: 1.5 }}>{p.desc}</p>
            </div>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 16, textAlign: 'center' }}>
        Preview only — these modules unlock in later phases.
      </p>
    </Modal>
  )
}
