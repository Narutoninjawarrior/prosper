import { Flame } from 'lucide-react'

const LINKS = [
  { href: '/review', label: 'Review' },
  { href: '/proof-log', label: 'Proof Log' },
  { href: '/route-health', label: 'Health (Beta)' },
  { href: '/forge', label: 'Forge' },
  { href: '/workbench', label: 'Workbench' },
  { href: '/explore', label: 'Explore' },
  { href: '/activity', label: 'Activity' },
  { href: '/registry', label: 'Provenance' },
  { href: '/world', label: 'World' },
  { href: '/agent-access', label: 'Agents' },
  { href: '/hall', label: 'Hall' },
  { href: '/lodge-mind', label: 'Mind (Legacy)' },
  { href: '/exchange', label: 'Exchange (Experimental)' },
  { href: '/witness', label: 'Record Trail (Beta)' },
  { href: '/operations', label: 'Operations' },
]

export default function PublicNav({ compact = false }: { compact?: boolean }) {
  const path = window.location.pathname

  return (
    <header
      className="pointer-events-auto z-40 shrink-0 border-b border-[#D4A853]/15 bg-[rgba(8,12,10,0.88)] backdrop-blur-md"
      style={{ fontFamily: 'monospace' }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2.5">
        <a href="/explore" className="flex items-center gap-2 no-underline">
          <Flame size={18} className="text-[#E8842A]" />
          <span className="text-sm font-semibold tracking-[0.2em] text-[#FAF6EF]">HEARTH</span>
        </a>
        {!compact && (
          <nav className="hidden flex-wrap items-center gap-1 md:flex">
            {LINKS.map((link) => {
              const active = path === link.href || (link.href === '/explore' && path === '/')
              return (
                <a
                  key={link.href}
                  href={link.href}
                  className="rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] no-underline transition"
                  style={{
                    color: active ? '#FAF6EF' : '#8E7E6B',
                    background: active ? 'rgba(212,168,83,0.16)' : 'transparent',
                    border: active ? '1px solid rgba(212,168,83,0.35)' : '1px solid transparent',
                  }}
                >
                  {link.label}
                </a>
              )
            })}
          </nav>
        )}
        <a
          href="/hearth"
          className="rounded-full border border-[#10b981]/35 bg-[#10b981]/12 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9ff0c4] no-underline"
        >
          Hearth OS
        </a>
      </div>
    </header>
  )
}
