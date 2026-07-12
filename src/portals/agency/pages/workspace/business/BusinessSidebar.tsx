import {
  LayoutDashboard, Building2, Users, Palette, Compass,
  Package, Target, TrendingUp, FileText, FileCheck,
  Receipt, CreditCard, RefreshCcw,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { CompletionDot } from '@/components/ui/CompletionDot'
import type { CompletionStatus } from '@/components/ui/CompletionDot'
import {
  SECTIONS, SECTION_GROUP_LABELS,
  type SectionId, type SectionDef,
} from './sections'

export const ICONS: Record<SectionId, LucideIcon> = {
  'overview':           LayoutDashboard,
  'company':            Building2,
  'contacts':           Users,
  'brand':              Palette,
  'discovery':          Compass,
  'products':           Package,
  'goals':              Target,
  'market-intelligence':TrendingUp,
  'proposals':          FileText,
  'contracts':          FileCheck,
  'invoices':           Receipt,
  'payments':           CreditCard,
  'retainers':          RefreshCcw,
}

interface Props {
  activeSection: SectionId
  onSelect: (id: SectionId) => void
  completionStatus: Record<SectionId, CompletionStatus>
}

export function BusinessSidebar({ activeSection, onSelect, completionStatus }: Props) {
  const groups = groupSections()

  return (
    <nav
      aria-label="Business workspace navigation"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        paddingBottom: 24,
      }}
    >
      {groups.map(({ groupKey, groupLabel, sections }) => (
        <div key={groupKey} style={{ marginBottom: groupKey === 'root' ? 12 : 0 }}>
          {groupLabel && (
            <p style={{
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--muted)',
              padding: '12px 12px 6px',
              userSelect: 'none',
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
              Icon={ICONS[s.id]}
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
  section: SectionDef
  isActive: boolean
  onClick: () => void
  status: CompletionStatus
  Icon: LucideIcon
}) {
  const completedCount = getCompletedCount(status)

  return (
    <button
      onClick={onClick}
      aria-current={isActive ? 'page' : undefined}
      aria-label={section.ariaLabel}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        padding: '8px 12px',
        borderRadius: 10,
        border: 'none',
        cursor: 'pointer',
        fontFamily: 'var(--font-sans)',
        fontSize: 13,
        fontWeight: isActive ? 600 : 400,
        color: isActive ? 'var(--violet)' : 'var(--ink-2)',
        background: isActive ? 'var(--lavender-soft)' : 'transparent',
        textAlign: 'left',
        transition: 'all 140ms ease',
        position: 'relative',
      }}
      onMouseEnter={e => {
        if (!isActive) {
          const el = e.currentTarget
          el.style.background = 'var(--lavender-soft)'
          el.style.color = 'var(--ink)'
        }
      }}
      onMouseLeave={e => {
        if (!isActive) {
          const el = e.currentTarget
          el.style.background = 'transparent'
          el.style.color = 'var(--ink-2)'
        }
      }}
    >
      {/* Active bar */}
      {isActive && (
        <span style={{
          position: 'absolute',
          left: 0,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 3,
          height: 18,
          borderRadius: 9999,
          background: 'var(--violet)',
        }} />
      )}

      {/* Icon */}
      <Icon
        size={15}
        color={isActive ? 'var(--violet)' : 'var(--muted)'}
        aria-hidden="true"
        style={{ flexShrink: 0 }}
      />

      {/* Label */}
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {section.label}
      </span>

      {/* Completion dot */}
      <CompletionDot
        status={status}
        tooltip={completedCount}
      />
    </button>
  )
}

function getCompletedCount(status: CompletionStatus): string {
  if (status === 'complete') return 'Section complete'
  if (status === 'partial') return 'Partially complete'
  return 'No data yet'
}

interface SectionGroup {
  groupKey: string
  groupLabel: string
  sections: SectionDef[]
}

function groupSections(): SectionGroup[] {
  const groups: SectionGroup[] = []
  const seen = new Set<string>()

  for (const s of SECTIONS) {
    if (!seen.has(s.group)) {
      seen.add(s.group)
      groups.push({
        groupKey: s.group,
        groupLabel: SECTION_GROUP_LABELS[s.group],
        sections: [],
      })
    }
    groups[groups.length - 1].sections.push(s)
  }

  return groups
}
