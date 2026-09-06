import {
  LayoutDashboard, Globe, Link2, Share2, TrendingUp,
  MapPin, Search, BarChart3, Image as ImageIcon,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { CompletionDot } from '@/components/ui/CompletionDot'
import type { CompletionStatus } from '@/components/ui/CompletionDot'
import {
  DIGITAL_SECTIONS, DIGITAL_SECTION_GROUP_LABELS,
  type DigitalSectionId, type DigitalSectionDef,
} from './sections'

export const DIGITAL_ICONS: Record<DigitalSectionId, LucideIcon> = {
  'overview':            LayoutDashboard,
  'website':             Globe,
  'domains':             Link2,
  'social-channels':     Share2,
  'social-tracker':      TrendingUp,
  'business-listings':   MapPin,
  'seo':                 Search,
  'tracking-analytics':  BarChart3,
  'digital-assets':      ImageIcon,
}

interface Props {
  activeSection: DigitalSectionId
  onSelect: (id: DigitalSectionId) => void
  completionStatus: Record<DigitalSectionId, CompletionStatus>
}

export function DigitalSidebar({ activeSection, onSelect, completionStatus }: Props) {
  const groups = groupSections()

  return (
    <nav
      aria-label="Digital workspace navigation"
      style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingBottom: 24 }}
    >
      {groups.map(({ groupKey, groupLabel, sections }) => (
        <div key={groupKey} style={{ marginBottom: groupKey === 'root' ? 12 : 0 }}>
          {groupLabel && (
            <p style={{
              fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
              color: 'var(--muted)', padding: '12px 12px 6px', userSelect: 'none',
            }}>
              {groupLabel}
            </p>
          )}
          {sections.map(s => (
            <SidebarItem
              key={s.id}
              section={s}
              isActive={activeSection === s.id}
              onClick={() => onSelect(s.id)}
              status={completionStatus[s.id]}
              Icon={DIGITAL_ICONS[s.id]}
            />
          ))}
        </div>
      ))}
    </nav>
  )
}

function SidebarItem({
  section, isActive, onClick, status, Icon,
}: {
  section: DigitalSectionDef
  isActive: boolean
  onClick: () => void
  status: CompletionStatus
  Icon: LucideIcon
}) {
  return (
    <button
      onClick={onClick}
      aria-current={isActive ? 'page' : undefined}
      aria-label={section.ariaLabel}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 9,
        padding: '8px 12px', borderRadius: 10, border: 'none', cursor: 'pointer',
        fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: isActive ? 600 : 400,
        color: isActive ? 'var(--violet)' : 'var(--ink-2)',
        background: isActive ? 'var(--lavender-soft)' : 'transparent',
        textAlign: 'left', transition: 'all 140ms ease', position: 'relative',
      }}
      onMouseEnter={e => {
        if (!isActive) { e.currentTarget.style.background = 'var(--lavender-soft)'; e.currentTarget.style.color = 'var(--ink)' }
      }}
      onMouseLeave={e => {
        if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink-2)' }
      }}
    >
      {isActive && (
        <span style={{
          position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
          width: 3, height: 18, borderRadius: 9999, background: 'var(--violet)',
        }} />
      )}
      <Icon size={15} color={isActive ? 'var(--violet)' : 'var(--muted)'} aria-hidden="true" style={{ flexShrink: 0 }} />
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {section.label}
      </span>
      <CompletionDot status={status} tooltip={completionTooltip(status)} />
    </button>
  )
}

function completionTooltip(status: CompletionStatus): string {
  if (status === 'complete') return 'Section complete'
  if (status === 'partial') return 'Partially complete'
  if (status === 'unknown') return 'Status unavailable'
  return 'No data yet'
}

interface SectionGroup { groupKey: string; groupLabel: string; sections: DigitalSectionDef[] }

function groupSections(): SectionGroup[] {
  const groups: SectionGroup[] = []
  const seen = new Set<string>()
  for (const s of DIGITAL_SECTIONS) {
    if (!seen.has(s.group)) {
      seen.add(s.group)
      groups.push({ groupKey: s.group, groupLabel: DIGITAL_SECTION_GROUP_LABELS[s.group], sections: [] })
    }
    groups[groups.length - 1].sections.push(s)
  }
  return groups
}
