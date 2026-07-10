import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmailComposer } from '@/features/email/EmailComposer'
import { createContact, updateContact, deleteContact } from '@/features/clients/api'
import type { ContactFormValues } from '@/features/clients/api'
import type { Client, ClientContact } from '@/types'

/* ── Role definitions ────────────────────────────────────── */

const ROLE_OPTIONS = [
  { value: 'decision_maker', label: 'Decision Maker' },
  { value: 'marketing',      label: 'Marketing' },
  { value: 'billing',        label: 'Billing' },
  { value: 'technical',      label: 'Technical' },
  { value: 'emergency',      label: 'Emergency Contact' },
]

const ROLE_GROUPS = [
  { role: 'decision_maker', label: 'Decision Makers' },
  { role: 'marketing',      label: 'Marketing Contacts' },
  { role: 'billing',        label: 'Billing Contacts' },
  { role: 'technical',      label: 'Technical Contacts' },
  { role: 'emergency',      label: 'Emergency Contacts' },
]

const ROLE_LABEL: Record<string, string> = Object.fromEntries(
  ROLE_OPTIONS.map(r => [r.value, r.label]),
)

const ROLE_BADGE: Record<string, 'default' | 'brand' | 'info' | 'warning' | 'danger'> = {
  decision_maker: 'brand',
  marketing:      'info',
  billing:        'warning',
  technical:      'default',
  emergency:      'danger',
}

/* ── Grouping ────────────────────────────────────────────── */

interface ContactGroup { role: string; label: string; contacts: ClientContact[] }

function groupContacts(contacts: ClientContact[]): ContactGroup[] {
  const result: ContactGroup[] = []

  for (const { role, label } of ROLE_GROUPS) {
    const matched = contacts.filter(c => (c.roles ?? []).includes(role))
    if (matched.length) result.push({ role, label, contacts: matched })
  }

  const knownRoles = new Set(ROLE_OPTIONS.map(r => r.value))
  const others = contacts.filter(c => {
    const roles = c.roles ?? []
    return roles.length === 0 || !roles.some(r => knownRoles.has(r))
  })
  if (others.length) result.push({ role: 'other', label: 'Other Contacts', contacts: others })

  return result
}

/* ── Helpers ─────────────────────────────────────────────── */

function initials(c: ClientContact) {
  return `${c.first_name[0] ?? ''}${c.last_name?.[0] ?? ''}`.toUpperCase() || '?'
}

function fullName(c: ClientContact) {
  return `${c.first_name} ${c.last_name ?? ''}`.trim()
}

function blankForm(): ContactFormValues {
  return { first_name: '', last_name: '', title: '', email: '', phone: '', is_primary: false, roles: [] }
}

function contactToForm(c: ClientContact): ContactFormValues {
  return {
    first_name: c.first_name,
    last_name:  c.last_name ?? '',
    title:      c.title ?? '',
    email:      c.email ?? '',
    phone:      c.phone ?? '',
    is_primary: c.is_primary,
    roles:      c.roles ?? [],
  }
}

/* ── Main component ──────────────────────────────────────── */

interface Props {
  client: Client
  ctx: { agencyId: string; actorId: string }
  onChanged: () => void
}

export function ContactsSection({ client, ctx, onChanged }: Props) {
  const contacts = client.client_contacts ?? []

  const [contactModal, setContactModal] = useState<'add' | 'edit' | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ClientContact | null>(null)
  const [editing, setEditing]   = useState<ClientContact | null>(null)
  const [emailTarget, setEmailTarget] = useState<ClientContact | null>(null)

  const [form, setForm]         = useState<ContactFormValues>(blankForm())
  const [saving, setSaving]     = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [rolesSkipped, setRolesSkipped] = useState(false)

  // Detect if roles column exists: contacts exist and first one has roles defined
  const rolesColumnMissing = contacts.length > 0 && contacts[0].roles === undefined

  function openAdd() {
    setForm(blankForm())
    setSaveError(null)
    setRolesSkipped(false)
    setEditing(null)
    setContactModal('add')
  }

  function openEdit(c: ClientContact) {
    setForm(contactToForm(c))
    setSaveError(null)
    setRolesSkipped(false)
    setEditing(c)
    setContactModal('edit')
  }

  function openDelete(c: ClientContact) {
    setDeleteTarget(c)
  }

  function closeModal() {
    setContactModal(null)
    setEditing(null)
    setSaveError(null)
  }

  function setField<K extends keyof ContactFormValues>(k: K, v: ContactFormValues[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  function toggleRole(role: string) {
    setForm(f => ({
      ...f,
      roles: f.roles.includes(role) ? f.roles.filter(r => r !== role) : [...f.roles, role],
    }))
  }

  async function save() {
    if (!form.first_name.trim()) { setSaveError('First name is required'); return }
    setSaving(true); setSaveError(null)
    try {
      let result: { rolesSkipped: boolean }
      if (contactModal === 'edit' && editing) {
        result = await updateContact(editing.id, client.id, form, ctx)
      } else {
        result = await createContact(client.id, form, ctx)
      }
      setRolesSkipped(result.rolesSkipped)
      if (!result.rolesSkipped) {
        closeModal()
        onChanged()
      } else {
        // Saved but roles were skipped — show soft warning, still refresh
        setSaveError('Saved. Note: role assignment requires the roles DB migration.')
        onChanged()
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save contact')
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteContact(deleteTarget.id, client.id, ctx)
      setDeleteTarget(null)
      onChanged()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to delete contact')
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  const groups = groupContacts(contacts)

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>
            {contacts.length} contact{contacts.length !== 1 ? 's' : ''}
          </p>
          {rolesColumnMissing && (
            <p style={{ fontSize: 12, color: 'var(--warning)', marginTop: 2 }}>
              Role grouping requires the <code>roles</code> DB migration.
            </p>
          )}
        </div>
        <Button variant="primary" size="sm" onClick={openAdd}>+ Add Contact</Button>
      </div>

      {/* ── Empty state ────────────────────────────────────── */}
      {contacts.length === 0 && (
        <div style={{
          background: 'var(--surface-solid)', border: '1px solid var(--hairline)',
          borderRadius: 'var(--radius)', padding: '48px 32px', textAlign: 'center',
        }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>No contacts yet</p>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>
            Add contacts to track who's involved with this account.
          </p>
          <Button variant="primary" size="sm" onClick={openAdd}>+ Add Contact</Button>
        </div>
      )}

      {/* ── Contact groups ─────────────────────────────────── */}
      {groups.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {groups.map(group => (
            <section key={group.role}>
              <p style={{
                fontSize: 10.5, fontWeight: 700, letterSpacing: '0.07em',
                textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 12,
              }}>
                {group.label}
              </p>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: 12,
              }}>
                {group.contacts.map(c => (
                  <ContactCard
                    key={c.id}
                    contact={c}
                    onEdit={() => openEdit(c)}
                    onDelete={() => openDelete(c)}
                    onEmail={c.email ? () => setEmailTarget(c) : undefined}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* ── Add / Edit modal ───────────────────────────────── */}
      <Modal
        open={contactModal !== null}
        onClose={closeModal}
        title={contactModal === 'edit' ? 'Edit Contact' : 'Add Contact'}
        width={520}
        footer={
          <>
            {saveError && (
              <p style={{ fontSize: 12, color: rolesSkipped ? 'var(--warning)' : 'var(--danger)', flex: 1, alignSelf: 'center' }}>
                {saveError}
              </p>
            )}
            <Button variant="ghost" size="sm" onClick={closeModal} disabled={saving}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={save} loading={saving}>
              {contactModal === 'edit' ? 'Save changes' : 'Add contact'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Input
              label="First Name *"
              value={form.first_name}
              onChange={e => setField('first_name', e.target.value)}
              placeholder="Jane"
            />
            <Input
              label="Last Name"
              value={form.last_name}
              onChange={e => setField('last_name', e.target.value)}
              placeholder="Smith"
            />
          </div>
          <Input
            label="Title / Position"
            value={form.title}
            onChange={e => setField('title', e.target.value)}
            placeholder="CEO, Marketing Director…"
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={e => setField('email', e.target.value)}
              placeholder="jane@company.com"
            />
            <Input
              label="Phone"
              value={form.phone}
              onChange={e => setField('phone', e.target.value)}
              placeholder="+1 (555) 000-0000"
            />
          </div>

          {/* Roles */}
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 8 }}>
              Roles
              {rolesColumnMissing && (
                <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 400, marginLeft: 6 }}>
                  (migration required)
                </span>
              )}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ROLE_OPTIONS.map(r => (
                <label
                  key={r.value}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                >
                  <input
                    type="checkbox"
                    checked={form.roles.includes(r.value)}
                    onChange={() => toggleRole(r.value)}
                    style={{ width: 15, height: 15, accentColor: 'var(--violet)', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 13.5, color: 'var(--ink)' }}>{r.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Primary toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.is_primary}
              onChange={e => setField('is_primary', e.target.checked)}
              style={{ width: 15, height: 15, accentColor: 'var(--violet)', cursor: 'pointer' }}
            />
            <div>
              <span style={{ fontSize: 13.5, color: 'var(--ink)', fontWeight: 500 }}>Primary contact</span>
              <p style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 1 }}>
                Shown first. Only one contact can be primary.
              </p>
            </div>
          </label>
        </div>
      </Modal>

      {/* ── Delete confirmation modal ───────────────────────── */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Contact"
        width={420}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={confirmDelete} loading={deleting}>
              Yes, delete
            </Button>
          </>
        }
      >
        <p style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.6 }}>
          Are you sure you want to delete{' '}
          <strong>{deleteTarget ? fullName(deleteTarget) : ''}</strong>?
          This cannot be undone.
        </p>
      </Modal>

      {/* ── Email Composer ──────────────────────────────────── */}
      <EmailComposer
        open={!!emailTarget}
        onClose={() => setEmailTarget(null)}
        prefill={emailTarget ? {
          email:     emailTarget.email!,
          name:      fullName(emailTarget),
          contactId: emailTarget.id,
        } : undefined}
        clientId={client.id}
        agencyId={ctx.agencyId}
        actorId={ctx.actorId}
      />
    </div>
  )
}

/* ── Contact card ────────────────────────────────────────── */

function ContactCard({
  contact,
  onEdit,
  onDelete,
  onEmail,
}: {
  contact: ClientContact
  onEdit: () => void
  onDelete: () => void
  onEmail?: () => void
}) {
  const name   = fullName(contact)
  const avatar = initials(contact)
  const roles  = contact.roles ?? []

  return (
    <div style={{
      background: 'var(--surface-solid)',
      border: '1px solid var(--hairline)',
      borderRadius: 'var(--radius)',
      padding: 16,
    }}>
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
        <AvatarCircle letters={avatar} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{name}</span>
            {contact.is_primary && <Badge variant="brand">Primary</Badge>}
          </div>
          {contact.title && (
            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{contact.title}</p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <Button variant="ghost" size="sm" onClick={onEdit}>Edit</Button>
          <button
            onClick={onDelete}
            style={{
              height: 32, padding: '0 10px', borderRadius: 9999, fontSize: 12.5, fontWeight: 600,
              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)',
              fontFamily: 'var(--font-sans)',
            }}
          >
            Delete
          </button>
        </div>
      </div>

      {/* Details */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, paddingLeft: 50 }}>
        {contact.email && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{contact.email}</span>
            {onEmail && (
              <button
                onClick={onEmail}
                style={{
                  fontSize: 11, fontWeight: 600, color: 'var(--violet)',
                  background: 'var(--lavender-soft)', borderRadius: 6,
                  padding: '2px 7px', border: 'none', cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                Send Email →
              </button>
            )}
          </div>
        )}
        {contact.phone && (
          <p style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{contact.phone}</p>
        )}
        {roles.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
            {roles.map(r => (
              <Badge key={r} variant={ROLE_BADGE[r] ?? 'default'}>
                {ROLE_LABEL[r] ?? r}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function AvatarCircle({ letters }: { letters: string }) {
  return (
    <div style={{
      width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
      background: 'var(--lavender-soft)', display: 'grid', placeItems: 'center',
    }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--violet)', letterSpacing: '0.02em' }}>
        {letters}
      </span>
    </div>
  )
}
