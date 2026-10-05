import type { ReactNode } from 'react'
import Link from 'next/link'
import SimpleHeader from '@/components/SimpleHeader'
import { backgroundImageStyle } from '@/lib/background'

// 読みもの系のページ（安全ガイド・クリエイター向けガイド・応援ページなど）の共通の枠
export default function InfoPage({
  headerLabel,
  badge,
  title,
  lead,
  children,
  related = [],
}: {
  headerLabel: string
  badge: string
  title: string
  lead: ReactNode
  children: ReactNode
  related?: { href: string; label: string }[]
}) {
  return (
    <div className="min-h-screen pb-20 relative bg-cover bg-center" style={backgroundImageStyle}>
      <div className="absolute inset-0 bg-gradient-to-b from-sky-400/20 via-sky-100/10 to-sky-900/20 backdrop-blur-[2px] pointer-events-none -z-10" />
      <SimpleHeader label={headerLabel} />

      <div className="max-w-3xl mx-auto space-y-6 py-12 px-4 sm:px-6">
        <div className="text-center space-y-3">
          <span className="inline-block px-3 py-1 bg-sky-100 text-sky-700 rounded-full text-[10px] font-black tracking-wide">{badge}</span>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-800 drop-shadow-sm">{title}</h1>
          <p className="text-sm text-slate-600 font-medium drop-shadow-sm leading-relaxed">{lead}</p>
        </div>

        {children}

        {related.length > 0 && (
          <nav className="flex flex-wrap justify-center gap-2 pt-2">
            {related.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-[11px] font-bold px-3 py-1.5 rounded-full bg-white/90 text-sky-700 border border-sky-100 hover:bg-sky-50 transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </div>
  )
}

// 見出しつきの白いカード
export function InfoSection({ emoji, title, children, id }: { emoji: string; title: string; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="scroll-mt-28 bg-white rounded-3xl p-6 shadow-sm border border-sky-100/60 space-y-4">
      <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
        <span className="text-lg">{emoji}</span> {title}
      </h2>
      {children}
    </section>
  )
}

// カードの中の小見出し＋本文
export function InfoItem({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <div className="space-y-1 pl-3 border-l-2 border-sky-100">
      <h3 className="text-xs font-black text-slate-700">{heading}</h3>
      <div className="text-xs text-slate-500 leading-relaxed space-y-1">{children}</div>
    </div>
  )
}
