import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClientFormModal } from '@/features/clients/components/ClientFormModal'
import { ContentModal } from '@/features/content/components/ContentModal'
import { createClient } from '@/features/clients/api'
import { createContent } from '@/features/content/api'
import type { ClientFormValues } from '@/features/clients/api'
import type { ContentFormValues } from '@/features/content/api'
import type { Client } from '@/types'

interface Props {
  agencyId:  string
  actorId:   string
  clients:   Client[]
  onRefresh: () => void
}

type ActionKey = 'project' | 'client' | 'task' | 'meeting' | 'content' | 'invoice' | 'file'

const ACTIONS: { key: ActionKey; label: string }[] = [
  { key: 'project', label: 'New Project'  },
  { key: 'client',  label: 'New Client'   },
  { key: 'task',    label: 'New Task'     },
  { key: 'meeting', label: 'New Meeting'  },
  { key: 'content', label: 'New Content'  },
  { key: 'invoice', label: 'New Invoice'  },
  { key: 'file',    label: 'Upload File'  },
]

export function NewActionDropdown({ agencyId, actorId, clients, onRefresh }: Props) {
  const navigate  = useNavigate()
  const [open, setOpen]   = useState(false)
  const [modal, setModal] = useState<'client' | 'content' | null>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  function handleAction(key: ActionKey) {
    setOpen(false)
    switch (key) {
      case 'project': navigate('/agency/projects?create=true'); break
      case 'client':  setModal('client');  break
      case 'task':    navigate('/agency/tasks');    break
      case 'meeting': navigate('/agency/calendar'); break
      case 'content': setModal('content'); break
      case 'invoice': navigate('/agency/billing');  break
      case 'file':    navigate('/agency/files');    break
    }
  }

  async function handleClientSubmit(values: ClientFormValues): Promise<void> {
    await createClient(values, { agencyId, actorId })
    onRefresh()
  }

  async function handleContentSubmit(values: ContentFormValues): Promise<void> {
    await createContent(values, { agencyId, actorId, role: 'agency' })
    onRefresh()
  }

  return (
    <>
      <div ref={dropRef} style={{ position: 'relative' }}>
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            padding: '8px 16px', borderRadius: 8, border: '1.5px solid var(--violet)',
            background: open ? 'var(--violet)' : 'transparent',
            color: open ? '#fff' : 'var(--violet)',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'var(--font-sans)', transition: 'all 150ms ease',
            letterSpacing: '-0.01em',
          }}
          onMouseEnter={e => { if (!open) { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(109,61,230,0.08)' } }}
          onMouseLeave={e => { if (!open) { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' } }}
        >
          + New {open ? '▴' : '▾'}
        </button>

        {open && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 100,
            background: 'var(--surface-solid)', border: '1px solid var(--hairline)',
            borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.14)', minWidth: 180,
            overflow: 'hidden',
          }}>
            {ACTIONS.map((action, i) => (
              <button
                key={action.key}
                onClick={() => handleAction(action.key)}
                style={{
                  display: 'block', width: '100%', padding: '10px 14px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: 'var(--font-sans)', textAlign: 'left',
                  fontSize: 13, color: 'var(--ink)', fontWeight: 500,
                  transition: 'background 100ms',
                  borderBottom: i < ACTIONS.length - 1 ? '1px solid var(--hairline-2)' : 'none',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--lavender-soft)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <ClientFormModal
        open={modal === 'client'}
        mode="create"
        onClose={() => setModal(null)}
        onSubmit={handleClientSubmit}
      />

      {modal === 'content' && (
        <ContentModal
          open
          mode="create"
          clients={clients}
          onClose={() => setModal(null)}
          onSubmit={handleContentSubmit}
        />
      )}
    </>
  )
}
