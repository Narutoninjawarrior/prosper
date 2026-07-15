import { Flame } from 'lucide-react'

const LINKS = [
  { href: '/projects', label: 'Projects' },
  { href: '/review', label: 'Review' },
  { href: '/activity', label: 'Activity' },
  { href: '/workbench', label: 'Workbench' },
  { href: '/operations', label: 'Operations' },
  { href: '/proof-log', label: 'Proof Log' },
  { href: '/route-health', label: 'Health (Beta)' },
]

export default function PublicNav({ compact = false }: { compact?: boolean }) {
  const path = window.location.pathname

  return (
    <header
      className="pointer-events-auto sticky top-0 z-50 shrink-0 border-b border-[#D4A853]/25 bg-[rgba(5,8,6,0.92)] backdrop-blur-xl shadow-[0_4px_20px_rgba(0,0,0,0.5)]"
      style={{ fontFamily: 'monospace' }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2.5">
        <a href="/" className="flex items-center gap-2 rounded-full border border-[#E8842A]/50 bg-[#E8842A]/15 px-3.5 py-1.5 no-underline shadow-[0_0_15px_rgba(232,132,42,0.25)] transition hover:bg-[#E8842A]/25">
          <Flame size={18} className="text-[#E8842A]" />
          <span className="text-xs font-bold tracking-[0.2em] text-[#FAF6EF]">PROSPER</span>
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
          Workspace
        </a>
      </div>
    </header>
  )
}
