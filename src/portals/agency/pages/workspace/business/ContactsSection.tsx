import { useState } from 'react'
import { DrawerPanel, DrawerFooter } from '@/components/ui/DrawerPanel'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmailComposer } from '@/features/email/EmailComposer'
import { createContact, updateContact, deleteContact, findContactByEmail } from '@/features/clients/api'
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

const COMM_OPTIONS = [
  { value: '',         label: 'Select…' },
  { value: 'email',    label: 'Email' },
  { value: 'phone',    label: 'Phone call' },
  { value: 'text',     label: 'Text / SMS' },
  { value: 'slack',    label: 'Slack' },
  { value: 'zoom',     label: 'Zoom / Video' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'in_person', label: 'In person' },
]

/* ── Grouping ────────────────────────────────────────────── */

interface ContactGroup { role: string; label: string; contacts: ClientContact[] }

function groupContacts(contacts: ClientContact[]): ContactGroup[] {
  const result: ContactGroup[] = []
  for (const { role, label } of ROLE_GROUPS) {
    const matched = contacts.filter(c => c.roles.includes(role))
    if (matched.length) result.push({ role, label, contacts: matched })
  }
  const knownRoles = new Set(ROLE_OPTIONS.map(r => r.value))
  const others = contacts.filter(c => c.roles.length === 0 || !c.roles.some(r => knownRoles.has(r)))
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
  return {
    first_name: '', last_name: '', title: '',
    email: '', phone: '', is_primary: false,
    roles: [], preferred_communication: '', birthday: '', notes: '',
  }
}

function contactToForm(c: ClientContact): ContactFormValues {
  return {
    first_name:              c.first_name,
    last_name:               c.last_name ?? '',
    title:                   c.title ?? '',
    email:                   c.email ?? '',
    phone:                   c.phone ?? '',
    is_primary:              c.is_primary,
    roles:                   c.roles,
    preferred_communication: c.preferred_communication ?? '',
    birthday:                c.birthday ?? '',
    notes:                   c.notes ?? '',
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
  const currentPrimary = contacts.find(c => c.is_primary)

  const [drawerMode, setDrawerMode]     = useState<'add' | 'edit' | null>(null)
  const [editing, setEditing]           = useState<ClientContact | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ClientContact | null>(null)
  const [emailTarget, setEmailTarget]   = useState<ClientContact | null>(null)

  const [form, setForm]           = useState<ContactFormValues>(blankForm())
  const [saving, setSaving]       = useState(false)
  const [deleting, setDeleting]   = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Duplicate email confirmation state
  const [dupContact, setDupContact]   = useState<ClientContact | null>(null)
  const [pendingForm, setPendingForm] = useState<ContactFormValues | null>(null)

  function openAdd() {
    setForm(blankForm())
    setSaveError(null)
    setEditing(null)
    setDrawerMode('add')
  }

  function openEdit(c: ClientContact) {
    setForm(contactToForm(c))
    setSaveError(null)
    setEditing(c)
    setDrawerMode('edit')
  }

  function closeDrawer() {
    setDrawerMode(null)
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

  async function doSave(formValues: ContactFormValues) {
    setSaving(true); setSaveError(null)
    try {
      if (drawerMode === 'edit' && editing) {
        await updateContact(editing.id, client.id, formValues, ctx)
      } else {
        await createContact(client.id, formValues, ctx)
      }
      closeDrawer()
      onChanged()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save contact')
      // Refetch regardless so the list reflects actual DB state (handles partial
      // save where data fields saved but primary RPC failed).
      onChanged()
    } finally {
      setSaving(false)
    }
  }

  async function save() {
    if (!form.first_name.trim()) { setSaveError('First name is required'); return }

    // Check for duplicate email in this client (scoped by RLS + client_id filter).
    // Blank emails are never duplicates.
    if (form.email.trim()) {
      const dup = await findContactByEmail(form.email, client.id, editing?.id)
      if (dup) {
        // Surface explicit ConfirmDialog — user must choose Cancel or Save Anyway.
        setPendingForm({ ...form })
        setDupContact(dup)
        return
      }
    }

    await doSave(form)
  }

  async function confirmSaveAnyway() {
    if (!pendingForm) return
    setDupContact(null)
    await doSave(pendingForm)
    setPendingForm(null)
  }

  function cancelDupDialog() {
    setDupContact(null)
    setPendingForm(null)
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

  // When editing the current primary contact, lock the checkbox — primary can only
  // be reassigned by opening the new contact and setting them as primary (via RPC).
  const isEditingCurrentPrimary = drawerMode === 'edit' && editing?.is_primary === true

  // Reassignment warning: only shown when editing a non-primary and toggling primary on
  const primaryReassignWarning =
    drawerMode === 'edit' &&
    editing &&
    !editing.is_primary &&
    form.is_primary &&
    currentPrimary &&
    currentPrimary.id !== editing.id
      ? `This will remove the primary designation from ${fullName(currentPrimary)}.`
      : null

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>
          {contacts.length} contact{contacts.length !== 1 ? 's' : ''}
          {currentPrimary ? ` · Primary: ${fullName(currentPrimary)}` : ''}
        </p>
        <Button variant="primary" size="sm" onClick={openAdd} className="min-h-[44px]">+ Add Contact</Button>
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
          <Button variant="primary" size="sm" onClick={openAdd} className="min-h-[44px]">+ Add Contact</Button>
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
                    onDelete={() => setDeleteTarget(c)}
                    onEmail={c.email ? () => setEmailTarget(c) : undefined}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* ── Add / Edit drawer ──────────────────────────────── */}
      <DrawerPanel
        open={drawerMode !== null}
        onClose={closeDrawer}
        title={drawerMode === 'edit' ? `Edit: ${editing ? fullName(editing) : 'Contact'}` : 'Add Contact'}
        footer={
          <DrawerFooter
            onCancel={closeDrawer}
            onConfirm={save}
            confirmLabel={drawerMode === 'edit' ? 'Save changes' : 'Add contact'}
            loading={saving}
            error={saveError}
          />
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Name */}
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

          {/* Contact info */}
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

          {/* Preferred communication */}
          <Select
            label="Preferred Communication"
            value={form.preferred_communication}
            onChange={e => setField('preferred_communication', e.target.value)}
            options={COMM_OPTIONS}
          />

          {/* Birthday */}
          <Input
            label="Birthday"
            type="date"
            value={form.birthday}
            onChange={e => setField('birthday', e.target.value)}
          />

          {/* Roles */}
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 8 }}>Roles</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ROLE_OPTIONS.map(r => (
                <label
                  key={r.value}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', minHeight: 44 }}
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
          <label
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              cursor: isEditingCurrentPrimary ? 'default' : 'pointer', minHeight: 44,
              opacity: isEditingCurrentPrimary ? 0.7 : 1,
            }}
          >
            <input
              type="checkbox"
              checked={form.is_primary}
              disabled={isEditingCurrentPrimary}
              onChange={e => !isEditingCurrentPrimary && setField('is_primary', e.target.checked)}
              style={{
                width: 15, height: 15, accentColor: 'var(--violet)',
                cursor: isEditingCurrentPrimary ? 'not-allowed' : 'pointer', marginTop: 3,
              }}
            />
            <div>
              <span style={{ fontSize: 13.5, color: 'var(--ink)', fontWeight: 500 }}>Primary contact</span>
              {isEditingCurrentPrimary ? (
                <p style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 1 }}>
                  To reassign primary, open the new contact and set them as primary.
                </p>
              ) : (
                <p style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 1 }}>
                  Shown first. Only one contact can be primary.
                </p>
              )}
              {primaryReassignWarning && (
                <p style={{ fontSize: 12, color: 'var(--warning)', marginTop: 4 }}>
                  ⚠ {primaryReassignWarning}
                </p>
              )}
            </div>
          </label>

          {/* Notes */}
          <Textarea
            label="Notes"
            rows={4}
            value={form.notes}
            onChange={e => setField('notes', e.target.value)}
            placeholder="Any notes about this contact…"
          />

        </div>
      </DrawerPanel>

      {/* ── Duplicate email confirmation ────────────────────── */}
      <ConfirmDialog
        open={!!dupContact}
        variant="primary"
        title="Duplicate email address"
        description={
          dupContact
            ? `${fullName(dupContact)} (${dupContact.email ?? ''}) already uses this email address for this client. Shared email addresses are allowed — do you want to save anyway?`
            : ''
        }
        confirmLabel="Save anyway"
        cancelLabel="Cancel"
        loading={saving}
        onConfirm={confirmSaveAnyway}
        onCancel={cancelDupDialog}
      />

      {/* ── Delete confirmation ─────────────────────────────── */}
      <ConfirmDialog
        open={!!deleteTarget}
        variant="danger"
        title="Delete contact"
        description={
          deleteTarget
            ? `Delete ${fullName(deleteTarget)}?${deleteTarget.is_primary ? ' This is the primary contact — you will need to set another.' : ''} This cannot be undone.`
            : ''
        }
        confirmLabel="Yes, delete"
        cancelLabel="Cancel"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

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
  const roles  = contact.roles

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
          <Button variant="ghost" size="sm" onClick={onEdit} className="min-h-[44px]">Edit</Button>
          <button
            onClick={onDelete}
            style={{
              minHeight: 44, padding: '0 10px', borderRadius: 9999, fontSize: 12.5, fontWeight: 600,
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
        {contact.preferred_communication && (
          <p style={{ fontSize: 12, color: 'var(--muted)' }}>
            Prefers: {COMM_OPTIONS.find(o => o.value === contact.preferred_communication)?.label ?? contact.preferred_communication}
          </p>
        )}
        {contact.notes && (
          <p style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic', marginTop: 2 }}>
            {contact.notes.length > 80 ? contact.notes.slice(0, 80) + '…' : contact.notes}
          </p>
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
