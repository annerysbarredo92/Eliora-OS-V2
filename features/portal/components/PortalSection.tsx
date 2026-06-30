import { useState } from 'react'
import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

interface PortalSectionProps {
  index: number
  title: string
  description?: string
  done: boolean
  children: ReactNode
  onSave: () => Promise<void>
}

export function PortalSection({ index, title, description, done, children, onSave }: PortalSectionProps) {
  const [saving, setSaving] = useState(false)
  const [savedTick, setSavedTick] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await onSave()
      setSavedTick(true)
      setTimeout(() => setSavedTick(false), 1800)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--hairline-2)' }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center',
          fontSize: 12, fontWeight: 700,
          background: done ? 'var(--success)' : 'var(--lavender-soft)', color: done ? '#fff' : 'var(--violet)',
        }}>
          {done ? '✓' : index}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{title}</h3>
            {done && <Badge variant="success">Saved</Badge>}
          </div>
          {description && <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>{description}</p>}
        </div>
      </div>
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {children}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
          {savedTick && <span style={{ fontSize: 12.5, color: 'var(--success)', fontWeight: 600 }}>Saved ✓</span>}
          <Button variant="primary" size="sm" onClick={handleSave} loading={saving}>{done ? 'Update' : 'Save section'}</Button>
        </div>
      </div>
    </section>
  )
}
