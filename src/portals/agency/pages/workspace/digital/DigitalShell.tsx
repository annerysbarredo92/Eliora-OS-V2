import { useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DigitalOverview } from './DigitalOverview'
import { WebsiteSection } from './WebsiteSection'
import { DomainsSection } from './DomainsSection'
import { BusinessListingsSection } from './BusinessListingsSection'
import { SocialChannelsSection } from './SocialChannelsSection'
import { SocialTrackerSection } from './SocialTrackerSection'
import { DigitalSidebar, DIGITAL_ICONS } from './DigitalSidebar'
import { DigitalSectionPlaceholder } from './DigitalSectionPlaceholder'
import { DigitalErrorBoundary } from './DigitalErrorBoundary'
import { CompletionDot } from '@/components/ui/CompletionDot'
import type { CompletionStatus } from '@/components/ui/CompletionDot'
import {
  DIGITAL_SECTIONS, resolveDigitalSectionId,
  type DigitalSectionId, type DigitalSectionDef,
} from './sections'
import type { Client, SocialChannel } from '@/types'

interface Props {
  client: Client
  ctx: { agencyId: string; actorId: string }
  onChanged: () => void
  onRequestAI: () => void
}

const EMPTY_COMPLETION: Record<DigitalSectionId, CompletionStatus> = {
  overview: 'complete', website: 'unknown', domains: 'unknown',
  'social-channels': 'unknown', 'social-tracker': 'unknown', 'business-listings': 'unknown',
  seo: 'unknown', 'tracking-analytics': 'unknown', 'digital-assets': 'unknown',
}

export function DigitalShell({ client, ctx, onChanged }: Props) {
  const [searchParams, setSearchParams] = useSearchParams()
  const rawSection = searchParams.get('dsection')
  const section = resolveDigitalSectionId(rawSection)

  const [completion, setCompletion] = useState<Record<DigitalSectionId, CompletionStatus>>(EMPTY_COMPLETION)

  function changeSection(id: string) {
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev)
        next.set('dsection', id)
        next.delete('dchannel')
        return next
      },
      { replace: true },
    )
  }

  // "View Tracker" on a Social Channels card jumps straight to Social
  // Tracker with that channel pre-selected, via the same URL-param
  // mechanism as section switching — no separate routing system.
  function viewChannelTracker(channel: SocialChannel) {
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev)
        next.set('dsection', 'social-tracker')
        next.set('dchannel', channel.id)
        return next
      },
      { replace: true },
    )
  }

  const initialChannelId = searchParams.get('dchannel') ?? undefined

  const activeSection = DIGITAL_SECTIONS.find(s => s.id === section)!

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>

        {/* ── Tablet sidebar (768–1023px) ───────────────────── */}
        <aside
          aria-label="Digital workspace sections"
          className="hidden md:block lg:hidden"
          style={{
            width: 168, flexShrink: 0, position: 'sticky',
            top: 'calc(var(--header-height) + 4px)',
            maxHeight: 'calc(100vh - var(--header-height) - 8px)',
            overflowY: 'auto', paddingRight: 4, scrollbarWidth: 'thin',
          }}
        >
          <DigitalSidebar activeSection={section} onSelect={changeSection} completionStatus={completion} />
        </aside>

        {/* ── Desktop sidebar (1024px+) ─────────────────────── */}
        <aside
          aria-label="Digital workspace sections"
          className="hidden lg:block"
          style={{
            width: 200, flexShrink: 0, position: 'sticky',
            top: 'calc(var(--header-height) + 4px)',
            maxHeight: 'calc(100vh - var(--header-height) - 8px)',
            overflowY: 'auto', paddingRight: 8, scrollbarWidth: 'thin',
          }}
        >
          <DigitalSidebar activeSection={section} onSelect={changeSection} completionStatus={completion} />
        </aside>

        {/* ── Content column ───────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0, paddingLeft: 16 }}>
          <DigitalErrorBoundary sectionLabel={activeSection.label}>
            <div key={section} className="animate-fade-in business-content-padded">
              <SectionRenderer
                section={section}
                client={client}
                ctx={ctx}
                onChanged={onChanged}
                onSectionChange={changeSection}
                onCompletionLoaded={setCompletion}
                onViewChannelTracker={viewChannelTracker}
                initialChannelId={initialChannelId}
              />
            </div>
          </DigitalErrorBoundary>
        </div>
      </div>

      {/* ── Mobile bottom nav — only on small screens ─────── */}
      <div className="block md:hidden">
        <DigitalMobileNav activeSection={section} onSelect={changeSection} completionStatus={completion} />
      </div>
    </>
  )
}

/* ── Section renderer ────────────────────────────────────── */

function SectionRenderer({
  section, client, ctx, onChanged, onSectionChange, onCompletionLoaded, onViewChannelTracker, initialChannelId,
}: {
  section: DigitalSectionId
  client: Client
  ctx: { agencyId: string; actorId: string }
  onChanged: () => void
  onSectionChange: (id: string) => void
  onCompletionLoaded: (c: Record<DigitalSectionId, CompletionStatus>) => void
  onViewChannelTracker: (channel: SocialChannel) => void
  initialChannelId?: string
}) {
  const def = DIGITAL_SECTIONS.find(s => s.id === section)!

  switch (section) {
    case 'overview':
      return (
        <DigitalOverview
          clientId={client.id}
          onSectionChange={onSectionChange}
          onCompletionLoaded={onCompletionLoaded}
        />
      )
    case 'website':
      return <WebsiteSection client={client} ctx={ctx} onChanged={onChanged} />
    case 'domains':
      return <DomainsSection client={client} ctx={ctx} onChanged={onChanged} />
    case 'social-channels':
      return <SocialChannelsSection client={client} ctx={ctx} onChanged={onChanged} onViewTracker={onViewChannelTracker} />
    case 'social-tracker':
      return <SocialTrackerSection client={client} ctx={ctx} onChanged={onChanged} onGoToChannels={() => onSectionChange('social-channels')} initialChannelId={initialChannelId} />
    case 'business-listings':
      return <BusinessListingsSection client={client} ctx={ctx} onChanged={onChanged} />
    default:
      return <DigitalSectionPlaceholder section={def} onBack={() => onSectionChange('overview')} />
  }
}

/* ── Mobile bottom navigation ────────────────────────────── */

const PRIMARY_SECTION_IDS: DigitalSectionId[] = ['overview', 'website', 'domains', 'social-channels']

function DigitalMobileNav({
  activeSection, onSelect, completionStatus,
}: {
  activeSection: DigitalSectionId
  onSelect: (id: string) => void
  completionStatus: Record<DigitalSectionId, CompletionStatus>
}) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)
  const moreButtonRef = useRef<HTMLButtonElement>(null)

  const primarySections = PRIMARY_SECTION_IDS.map(id => DIGITAL_SECTIONS.find(s => s.id === id)!)
  const moreSections = DIGITAL_SECTIONS.filter(s => !PRIMARY_SECTION_IDS.includes(s.id))
  const isActiveInMore = moreSections.some(s => s.id === activeSection)

  useEffect(() => {
    if (!sheetOpen) return
    document.body.style.overflow = 'hidden'
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { closeSheet(); return }
      if (e.key === 'Tab' && sheetRef.current) {
        const focusable = Array.from(
          sheetRef.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
        ).filter(el => !el.hasAttribute('disabled'))
        if (!focusable.length) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    window.addEventListener('keydown', onKey)
    requestAnimationFrame(() => sheetRef.current?.focus())
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [sheetOpen])

  function closeSheet() {
    setSheetOpen(false)
    requestAnimationFrame(() => moreButtonRef.current?.focus())
  }

  function handleSelect(id: string) {
    onSelect(id)
    closeSheet()
  }

  return (
    <>
      <nav
        aria-label="Digital workspace navigation"
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
          background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(16px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(16px) saturate(1.4)', borderTop: '1px solid var(--hairline)',
          display: 'flex', paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {primarySections.map(def => {
          const isActive = activeSection === def.id
          const Icon = DIGITAL_ICONS[def.id]
          return (
            <button
              key={def.id}
              onClick={() => handleSelect(def.id)}
              aria-current={isActive ? 'page' : undefined}
              aria-label={def.ariaLabel}
              style={{
                flex: 1, minHeight: 56, border: 'none', background: 'none',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
                cursor: 'pointer', color: isActive ? 'var(--violet)' : 'var(--muted)', fontFamily: 'var(--font-sans)',
                borderTop: isActive ? '2px solid var(--violet)' : '2px solid transparent', padding: '8px 4px',
              }}
            >
              <Icon size={18} aria-hidden="true" />
              <span style={{ fontSize: 10, fontWeight: isActive ? 600 : 400, whiteSpace: 'nowrap', lineHeight: 1 }}>{def.label}</span>
            </button>
          )
        })}

        <button
          ref={moreButtonRef}
          onClick={() => setSheetOpen(true)}
          aria-expanded={sheetOpen}
          aria-haspopup="dialog"
          aria-label="More digital sections"
          style={{
            flex: 1, minHeight: 56, border: 'none', background: 'none',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
            cursor: 'pointer', color: isActiveInMore ? 'var(--violet)' : 'var(--muted)', fontFamily: 'var(--font-sans)',
            borderTop: isActiveInMore ? '2px solid var(--violet)' : '2px solid transparent', padding: '8px 4px',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
          </svg>
          <span style={{ fontSize: 10, fontWeight: isActiveInMore ? 600 : 400, lineHeight: 1 }}>More</span>
        </button>
      </nav>

      {sheetOpen && (
        <div
          role="presentation"
          onMouseDown={closeSheet}
          style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(26,20,48,0.4)', backdropFilter: 'blur(4px)' }}
        >
          <div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label="More digital sections"
            tabIndex={-1}
            onMouseDown={e => e.stopPropagation()}
            className="animate-slide-up"
            style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              background: 'var(--surface-solid)', borderRadius: '20px 20px 0 0',
              maxHeight: '76vh', overflowY: 'auto', outline: 'none',
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            }}
          >
            <div style={{
              position: 'sticky', top: 0, zIndex: 1, background: 'var(--surface-solid)',
              padding: '16px 20px 12px', borderBottom: '1px solid var(--hairline-2)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.02em' }}>More sections</span>
              <button
                onClick={closeSheet}
                aria-label="Close section list"
                style={{
                  width: 44, height: 44, borderRadius: '50%', border: '1px solid var(--hairline)',
                  background: 'var(--surface-solid)', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--muted)',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <SheetGroup label="MORE" sections={moreSections} activeSection={activeSection} completionStatus={completionStatus} onSelect={handleSelect} />
          </div>
        </div>
      )}
    </>
  )
}

function SheetGroup({
  label, sections, activeSection, completionStatus, onSelect,
}: {
  label: string
  sections: DigitalSectionDef[]
  activeSection: DigitalSectionId
  completionStatus: Record<DigitalSectionId, CompletionStatus>
  onSelect: (id: string) => void
}) {
  return (
    <div style={{ padding: '12px 20px 4px' }}>
      <p style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4, marginTop: 8 }}>
        {label}
      </p>
      {sections.map(s => {
        const Icon = DIGITAL_ICONS[s.id]
        const isActive = activeSection === s.id
        return (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            aria-current={isActive ? 'page' : undefined}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0',
              border: 'none', borderBottom: '1px solid var(--hairline-2)', background: 'none',
              cursor: 'pointer', fontFamily: 'var(--font-sans)',
              color: isActive ? 'var(--violet)' : 'var(--ink)', textAlign: 'left',
            }}
          >
            <Icon size={16} color={isActive ? 'var(--violet)' : 'var(--muted)'} aria-hidden="true" />
            <span style={{ flex: 1, fontSize: 14, fontWeight: isActive ? 600 : 400 }}>{s.label}</span>
            <CompletionDot status={completionStatus[s.id]} />
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        )
      })}
    </div>
  )
}
