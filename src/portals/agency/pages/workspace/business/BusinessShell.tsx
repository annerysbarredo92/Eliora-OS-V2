import { useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BusinessOverview }           from './BusinessOverview'
import { CompanySection }             from './CompanySection'
import { ContactsSection }            from './ContactsSection'
import { BrandSection }               from './BrandSection'
import { DiscoverySection }           from './DiscoverySection'
import { ProductsSection }            from './ProductsSection'
import { GoalsSection }               from './GoalsSection'
import { MarketSection }              from './MarketSection'
import { BusinessSidebar, ICONS }     from './BusinessSidebar'
import { BusinessHeader }             from './BusinessHeader'
import { BusinessSectionPlaceholder } from './BusinessSectionPlaceholder'
import { BusinessErrorBoundary }      from './BusinessErrorBoundary'
import { useCompletionStatus }        from './useCompletionStatus'
import { CompletionDot }              from '@/components/ui/CompletionDot'
import type { CompletionStatus }      from '@/components/ui/CompletionDot'
import { SECTIONS, resolveSectionId, type SectionId, type SectionDef } from './sections'
import type { Client } from '@/types'

interface Props {
  client: Client
  ctx: { agencyId: string; actorId: string }
  onChanged: () => void
  onRequestAI: () => void
}

export function BusinessShell({ client, ctx, onChanged, onRequestAI }: Props) {
  const [searchParams, setSearchParams] = useSearchParams()
  const rawSection = searchParams.get('section')
  const section = resolveSectionId(rawSection)

  const completionStatus = useCompletionStatus(client)

  function changeSection(id: string) {
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev)
        next.set('section', id)
        return next
      },
      { replace: true },
    )
  }

  const activeSection = SECTIONS.find(s => s.id === section)!

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>

        {/* ── Tablet sidebar (768–1023px) ───────────────────── */}
        <aside
          aria-label="Business workspace sections"
          className="hidden md:block lg:hidden"
          style={{
            width: 168,
            flexShrink: 0,
            position: 'sticky',
            top: 'calc(var(--header-height) + 4px)',
            maxHeight: 'calc(100vh - var(--header-height) - 8px)',
            overflowY: 'auto',
            paddingRight: 4,
            scrollbarWidth: 'thin',
          }}
        >
          <BusinessSidebar
            activeSection={section}
            onSelect={(id) => changeSection(id)}
            completionStatus={completionStatus}
          />
        </aside>

        {/* ── Desktop sidebar (1024px+) ─────────────────────── */}
        <aside
          aria-label="Business workspace sections"
          className="hidden lg:block"
          style={{
            width: 200,
            flexShrink: 0,
            position: 'sticky',
            top: 'calc(var(--header-height) + 4px)',
            maxHeight: 'calc(100vh - var(--header-height) - 8px)',
            overflowY: 'auto',
            paddingRight: 8,
            scrollbarWidth: 'thin',
          }}
        >
          <BusinessSidebar
            activeSection={section}
            onSelect={(id) => changeSection(id)}
            completionStatus={completionStatus}
          />
        </aside>

        {/* ── Content column ───────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0, paddingLeft: 16 }}>

          {/* Business Header */}
          <BusinessHeader
            client={client}
            ctx={ctx}
            onRequestAI={onRequestAI}
          />

          {/* Section content */}
          <BusinessErrorBoundary sectionLabel={activeSection.label}>
            <div key={section} className="animate-fade-in business-content-padded">
              <SectionRenderer
                section={section}
                client={client}
                ctx={ctx}
                onChanged={onChanged}
                onSectionChange={changeSection}
              />
            </div>
          </BusinessErrorBoundary>
        </div>
      </div>

      {/* ── Mobile bottom nav — only on small screens ─────── */}
      <div className="block md:hidden">
        <BusinessMobileNav
          activeSection={section}
          onSelect={changeSection}
          completionStatus={completionStatus}
        />
      </div>
    </>
  )
}

/* ── Section renderer ────────────────────────────────────── */

interface RendererProps {
  section: SectionId
  client: Client
  ctx: { agencyId: string; actorId: string }
  onChanged: () => void
  onSectionChange: (id: string) => void
}

function SectionRenderer({ section, client, ctx, onChanged, onSectionChange }: RendererProps) {
  const def = SECTIONS.find(s => s.id === section)!

  switch (section) {
    case 'overview':
      return (
        <BusinessOverview
          client={client}
          ctx={ctx}
          onSectionChange={onSectionChange}
        />
      )
    case 'company':
      return (
        <CompanySection
          client={client}
          ctx={ctx}
          onChanged={onChanged}
        />
      )
    case 'contacts':
      return (
        <ContactsSection
          client={client}
          ctx={ctx}
          onChanged={onChanged}
        />
      )
    case 'brand':
      return (
        <BrandSection
          client={client}
          ctx={ctx}
          onChanged={onChanged}
        />
      )
    case 'discovery':
      return (
        <DiscoverySection
          client={client}
          ctx={ctx}
          onChanged={onChanged}
        />
      )
    case 'products':
      return (
        <ProductsSection
          client={client}
          ctx={ctx}
          onChanged={onChanged}
        />
      )
    case 'goals':
      return (
        <GoalsSection
          client={client}
          ctx={ctx}
          onChanged={onChanged}
        />
      )
    case 'market-intelligence':
      return (
        <MarketSection
          client={client}
          ctx={ctx}
          onChanged={onChanged}
        />
      )
    default:
      return (
        <BusinessSectionPlaceholder
          section={def}
          onBack={() => onSectionChange('overview')}
        />
      )
  }
}

/* ── Mobile bottom navigation ────────────────────────────── */

const PRIMARY_SECTION_IDS: SectionId[] = ['overview', 'company', 'contacts', 'brand']

interface MobileNavProps {
  activeSection: SectionId
  onSelect: (id: string) => void
  completionStatus: Record<SectionId, CompletionStatus>
}

function BusinessMobileNav({ activeSection, onSelect, completionStatus }: MobileNavProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const sheetRef     = useRef<HTMLDivElement>(null)
  const moreButtonRef = useRef<HTMLButtonElement>(null)

  const primarySections = PRIMARY_SECTION_IDS.map(id => SECTIONS.find(s => s.id === id)!)
  const moreSections    = SECTIONS.filter(s => !PRIMARY_SECTION_IDS.includes(s.id))
  const isActiveInMore  = moreSections.some(s => s.id === activeSection)

  const strategyGroup = moreSections.filter(s => s.group === 'strategy')
  const accountGroup  = moreSections.filter(s => s.group === 'account')

  useEffect(() => {
    if (!sheetOpen) return

    document.body.style.overflow = 'hidden'

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { closeSheet(); return }
      if (e.key === 'Tab' && sheetRef.current) {
        const focusable = Array.from(
          sheetRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
          ),
        ).filter(el => !el.hasAttribute('disabled'))
        if (!focusable.length) return
        const first = focusable[0]
        const last  = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault(); last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault(); first.focus()
        }
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
      {/* Fixed bottom bar */}
      <nav
        aria-label="Business workspace navigation"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          background: 'rgba(255,255,255,0.96)',
          backdropFilter: 'blur(16px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
          borderTop: '1px solid var(--hairline)',
          display: 'flex',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {primarySections.map(def => {
          const isActive = activeSection === def.id
          const Icon = ICONS[def.id]
          return (
            <button
              key={def.id}
              onClick={() => handleSelect(def.id)}
              aria-current={isActive ? 'page' : undefined}
              aria-label={def.ariaLabel}
              style={{
                flex: 1,
                minHeight: 56,
                border: 'none',
                background: 'none',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                cursor: 'pointer',
                color: isActive ? 'var(--violet)' : 'var(--muted)',
                fontFamily: 'var(--font-sans)',
                borderTop: isActive ? '2px solid var(--violet)' : '2px solid transparent',
                padding: '8px 4px',
              }}
            >
              <Icon size={18} aria-hidden="true" />
              <span style={{ fontSize: 10, fontWeight: isActive ? 600 : 400, whiteSpace: 'nowrap', lineHeight: 1 }}>
                {def.label}
              </span>
            </button>
          )
        })}

        {/* More button */}
        <button
          ref={moreButtonRef}
          onClick={() => setSheetOpen(true)}
          aria-expanded={sheetOpen}
          aria-haspopup="dialog"
          aria-label="More business sections"
          style={{
            flex: 1,
            minHeight: 56,
            border: 'none',
            background: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 3,
            cursor: 'pointer',
            color: isActiveInMore ? 'var(--violet)' : 'var(--muted)',
            fontFamily: 'var(--font-sans)',
            borderTop: isActiveInMore ? '2px solid var(--violet)' : '2px solid transparent',
            padding: '8px 4px',
          }}
        >
          {/* Three dots icon */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="5"  cy="12" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="19" cy="12" r="2" />
          </svg>
          <span style={{ fontSize: 10, fontWeight: isActiveInMore ? 600 : 400, lineHeight: 1 }}>More</span>
        </button>
      </nav>

      {/* Bottom sheet backdrop */}
      {sheetOpen && (
        <div
          role="presentation"
          onMouseDown={closeSheet}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            background: 'rgba(26,20,48,0.4)',
            backdropFilter: 'blur(4px)',
          }}
        >
          {/* Sheet */}
          <div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label="More business sections"
            tabIndex={-1}
            onMouseDown={e => e.stopPropagation()}
            className="animate-slide-up"
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              background: 'var(--surface-solid)',
              borderRadius: '20px 20px 0 0',
              maxHeight: '76vh',
              overflowY: 'auto',
              outline: 'none',
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            }}
          >
            {/* Sheet header */}
            <div style={{
              position: 'sticky',
              top: 0,
              zIndex: 1,
              background: 'var(--surface-solid)',
              padding: '16px 20px 12px',
              borderBottom: '1px solid var(--hairline-2)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.02em' }}>
                More sections
              </span>
              <button
                onClick={closeSheet}
                aria-label="Close section list"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  border: '1px solid var(--hairline)',
                  background: 'var(--surface-solid)',
                  cursor: 'pointer',
                  display: 'grid',
                  placeItems: 'center',
                  color: 'var(--muted)',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Strategy group */}
            <SheetGroup
              label="STRATEGY"
              sections={strategyGroup}
              activeSection={activeSection}
              completionStatus={completionStatus}
              onSelect={handleSelect}
            />

            {/* Account group */}
            <SheetGroup
              label="ACCOUNT"
              sections={accountGroup}
              activeSection={activeSection}
              completionStatus={completionStatus}
              onSelect={handleSelect}
            />
          </div>
        </div>
      )}
    </>
  )
}

function SheetGroup({
  label,
  sections,
  activeSection,
  completionStatus,
  onSelect,
}: {
  label: string
  sections: SectionDef[]
  activeSection: SectionId
  completionStatus: Record<SectionId, CompletionStatus>
  onSelect: (id: string) => void
}) {
  return (
    <div style={{ padding: '12px 20px 4px' }}>
      <p style={{
        fontSize: 9.5,
        fontWeight: 700,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: 'var(--muted)',
        marginBottom: 4,
        marginTop: 8,
      }}>
        {label}
      </p>
      {sections.map(s => {
        const Icon = ICONS[s.id]
        const isActive = activeSection === s.id
        return (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            aria-current={isActive ? 'page' : undefined}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '14px 0',
              border: 'none',
              borderBottom: '1px solid var(--hairline-2)',
              background: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              color: isActive ? 'var(--violet)' : 'var(--ink)',
              textAlign: 'left',
            }}
          >
            <Icon size={16} color={isActive ? 'var(--violet)' : 'var(--muted)'} aria-hidden="true" />
            <span style={{ flex: 1, fontSize: 14, fontWeight: isActive ? 600 : 400 }}>
              {s.label}
            </span>
            <CompletionDot status={completionStatus[s.id]} />
            {/* Chevron right */}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        )
      })}
    </div>
  )
}
